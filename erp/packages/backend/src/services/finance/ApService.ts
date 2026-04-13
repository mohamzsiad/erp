import { PrismaClient } from '@prisma/client';
import { JournalService } from './JournalService.js';
import { AccountMappingService } from './AccountMappingService.js';
import { getNextDocNo } from '../../utils/DocNumberService.js';

const MATCH_TOLERANCE_PCT = 0.005; // 0.5%

function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0)  return 'Current';
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '>90';
}

export class ApService {
  private journal: JournalService;
  private mapping: AccountMappingService;

  constructor(private prisma: PrismaClient) {
    this.journal = new JournalService(prisma);
    this.mapping = new AccountMappingService(prisma);
  }

  // ── List invoices with aging ───────────────────────────────────────────────
  async listInvoices(companyId: string, params: {
    status?: string; supplierId?: string; dateFrom?: string; dateTo?: string;
    page?: number; limit?: number;
  }) {
    const { status, supplierId, dateFrom, dateTo, page = 1, limit = 50 } = params;
    const where: any = { companyId };
    if (status)     where.status     = status;
    if (supplierId) where.supplierId = supplierId;
    if (dateFrom || dateTo) {
      where.invoiceDate = {};
      if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
      if (dateTo)   where.invoiceDate.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.apInvoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: { supplier: { select: { name: true, code: true } } },
      }),
      this.prisma.apInvoice.count({ where }),
    ]);

    const today = new Date();
    const enriched = items.map((inv) => {
      const due = new Date(inv.dueDate);
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      return {
        ...inv,
        supplierName: (inv as any).supplier?.name,
        daysOverdue:  days,
        agingBucket:  agingBucket(days),
      };
    });

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getInvoiceById(id: string, companyId: string) {
    const inv = await this.prisma.apInvoice.findFirst({
      where: { id, companyId },
      include: {
        supplier: { select: { name: true, code: true } },
        po:       { select: { docNo: true, totalAmount: true } },
        grn:      { select: { docNo: true } },
        allocations: true,
      },
    });
    if (!inv) throw Object.assign(new Error('AP Invoice not found'), { statusCode: 404 });
    return inv;
  }

  // ── Register supplier invoice ──────────────────────────────────────────────
  async createInvoice(companyId: string, data: {
    supplierId: string;
    poId?: string;
    grnId?: string;
    supplierInvoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    taxAmount?: number;
    expenseAccountId?: string;
  }, userId: string) {
    const totalAmount = data.amount + (data.taxAmount ?? 0);

    // ── 3-Way Match ──────────────────────────────────────────────────────────
    let matchFlag: string | null = null;
    if (data.poId && data.grnId) {
      const [po, grn] = await Promise.all([
        this.prisma.purchaseOrder.findFirst({ where: { id: data.poId, companyId } }),
        this.prisma.grnHeader.findFirst({ where: { id: data.grnId, companyId } }),
      ]);
      if (po && grn) {
        const poAmt  = Number(po.totalAmount);
        const diff   = Math.abs(totalAmount - poAmt);
        const tolAmt = poAmt * MATCH_TOLERANCE_PCT;
        matchFlag = diff <= tolAmt ? 'MATCHED' : 'MISMATCH';
      }
    }

    const docNo = await getNextDocNo(this.prisma, companyId, 'FINANCE', 'APINV');

    const inv = await this.prisma.$transaction(async (tx) => {
      const created = await tx.apInvoice.create({
        data: {
          companyId,
          docNo,
          supplierId: data.supplierId,
          poId:       data.poId  ?? null,
          grnId:      data.grnId ?? null,
          supplierInvoiceNo: data.supplierInvoiceNo,
          invoiceDate: new Date(data.invoiceDate),
          dueDate:     new Date(data.dueDate),
          amount:      data.amount,
          taxAmount:   data.taxAmount ?? 0,
          totalAmount,
          matchFlag,
          status: matchFlag === 'MATCHED' ? 'APPROVED' : 'DRAFT',
          createdById: userId,
        },
      });

      // Auto-post journal if MATCHED (or no PO match required)
      if (matchFlag === 'MATCHED' || !data.poId) {
        const journalId = await this.postInvoiceJournal(
          tx as any, companyId, created, data.expenseAccountId, userId
        );
        await tx.apInvoice.update({ where: { id: created.id }, data: { journalId } });
      }

      return created;
    });

    return this.getInvoiceById(inv.id, companyId);
  }

  // ── Approve invoice (manual approval when MISMATCH) ────────────────────────
  async approveInvoice(id: string, companyId: string, userId: string) {
    const inv = await this.getInvoiceById(id, companyId);
    if (inv.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT invoices can be approved'), { statusCode: 422 });

    await this.prisma.$transaction(async (tx) => {
      const journalId = await this.postInvoiceJournal(tx as any, companyId, inv, undefined, userId);
      await tx.apInvoice.update({
        where: { id },
        data: { status: 'APPROVED', journalId },
      });
    });

    return this.getInvoiceById(id, companyId);
  }

  // ── Cancel invoice ─────────────────────────────────────────────────────────
  async cancelInvoice(id: string, companyId: string, userId: string) {
    const inv = await this.getInvoiceById(id, companyId);
    if (inv.status === 'CANCELLED') throw Object.assign(new Error('Invoice already cancelled'), { statusCode: 409 });
    if (inv.status === 'PAID') throw Object.assign(new Error('Cannot cancel a paid invoice'), { statusCode: 422 });

    await this.prisma.$transaction(async (tx) => {
      // Reverse the journal if one was posted
      if (inv.journalId) {
        await new JournalService(tx as any).reverseJournal(inv.journalId, companyId, userId);
      }
      await tx.apInvoice.update({ where: { id }, data: { status: 'CANCELLED' } });
    });

    return this.getInvoiceById(id, companyId);
  }

  // ── Record payment ─────────────────────────────────────────────────────────
  async createPayment(companyId: string, data: {
    supplierId: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    bankAccountId?: string;
    notes?: string;
    allocations: Array<{ invoiceId: string; amount: number }>;
  }, userId: string) {
    const totalAllocated = data.allocations.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(totalAllocated - data.amount) > 0.01) {
      throw Object.assign(
        new Error(`Allocated amount (${totalAllocated.toFixed(3)}) must equal payment amount (${data.amount.toFixed(3)})`),
        { statusCode: 422 }
      );
    }

    // Validate invoices exist and belong to supplier
    for (const alloc of data.allocations) {
      const inv = await this.prisma.apInvoice.findFirst({
        where: { id: alloc.invoiceId, companyId, supplierId: data.supplierId },
      });
      if (!inv) throw Object.assign(new Error(`Invoice ${alloc.invoiceId} not found for supplier`), { statusCode: 404 });
      if (['CANCELLED', 'PAID'].includes(inv.status)) {
        throw Object.assign(new Error(`Invoice ${inv.docNo} is ${inv.status}`), { statusCode: 422 });
      }
    }

    const docNo = await getNextDocNo(this.prisma, companyId, 'FINANCE', 'APPAY');

    const payment = await this.prisma.$transaction(async (tx) => {
      // Create payment
      const pmt = await tx.apPayment.create({
        data: {
          companyId,
          docNo,
          supplierId:    data.supplierId,
          paymentDate:   new Date(data.paymentDate),
          amount:        data.amount,
          paymentMethod: data.paymentMethod as any,
          bankAccountId: data.bankAccountId ?? null,
          notes:         data.notes ?? null,
          createdById:   userId,
        },
      });

      // Create allocations + update invoice paid amounts
      for (const alloc of data.allocations) {
        await tx.apAllocation.create({
          data: { paymentId: pmt.id, invoiceId: alloc.invoiceId, amount: alloc.amount },
        });

        const inv = await tx.apInvoice.findUnique({ where: { id: alloc.invoiceId } });
        if (!inv) continue;
        const newPaid = Number(inv.paidAmount) + alloc.amount;
        const newStatus = newPaid >= Number(inv.totalAmount) - 0.001 ? 'PAID' : 'PARTIAL';
        await tx.apInvoice.update({
          where: { id: alloc.invoiceId },
          data: { paidAmount: newPaid, status: newStatus },
        });
      }

      // Auto-post payment journal
      const journalId = await this.postPaymentJournal(tx as any, companyId, pmt, userId);
      await tx.apPayment.update({ where: { id: pmt.id }, data: { journalId } });

      return pmt;
    });

    return this.prisma.apPayment.findUnique({
      where: { id: payment.id },
      include: { allocations: true },
    });
  }

  async listPayments(companyId: string, params: {
    supplierId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number;
  }) {
    const where: any = { companyId };
    if (params.supplierId) where.supplierId = params.supplierId;
    if (params.dateFrom || params.dateTo) {
      where.paymentDate = {};
      if (params.dateFrom) where.paymentDate.gte = new Date(params.dateFrom);
      if (params.dateTo)   where.paymentDate.lte = new Date(params.dateTo);
    }
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const [items, total] = await Promise.all([
      this.prisma.apPayment.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          supplier: { select: { name: true, code: true } },
          allocations: { include: { invoice: { select: { docNo: true, totalAmount: true } } } },
        },
      }),
      this.prisma.apPayment.count({ where }),
    ]);
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Internal: post invoice journal ────────────────────────────────────────
  private async postInvoiceJournal(
    db: PrismaClient, companyId: string, inv: any, expenseAccountId?: string, userId?: string
  ): Promise<string> {
    const expenseAcc = expenseAccountId
      ?? await this.mapping.tryResolve(companyId, 'AP_EXPENSE');
    const supplierControlAcc = await this.mapping.resolve(companyId, 'SUPPLIER_CONTROL');

    if (!expenseAcc) throw Object.assign(new Error('AP_EXPENSE account mapping not configured'), { statusCode: 422 });

    const journal = await new JournalService(db).postJournal({
      companyId,
      entryDate:   new Date(inv.invoiceDate),
      description: `AP Invoice: ${inv.docNo} (${inv.supplierInvoiceNo ?? ''})`,
      lines: [
        { accountId: expenseAcc,        debit: Number(inv.totalAmount), credit: 0, description: `Purchase - ${inv.docNo}` },
        { accountId: supplierControlAcc, debit: 0, credit: Number(inv.totalAmount), description: `Supplier payable - ${inv.docNo}` },
      ],
      sourceModule: 'AP',
      sourceDocId:  inv.id,
      userId: userId ?? 'system',
    }, db as any);

    return journal.id;
  }

  // ── Internal: post payment journal ────────────────────────────────────────
  private async postPaymentJournal(
    db: PrismaClient, companyId: string, pmt: any, userId: string
  ): Promise<string> {
    const supplierControlAcc = await this.mapping.resolve(companyId, 'SUPPLIER_CONTROL');
    const bankAcc = await this.mapping.resolve(companyId, 'BANK_ACCOUNT');

    const journal = await new JournalService(db).postJournal({
      companyId,
      entryDate:   new Date(pmt.paymentDate),
      description: `AP Payment: ${pmt.docNo}`,
      lines: [
        { accountId: supplierControlAcc, debit: Number(pmt.amount), credit: 0, description: `Payment to supplier - ${pmt.docNo}` },
        { accountId: bankAcc,            debit: 0, credit: Number(pmt.amount), description: `Bank payment - ${pmt.docNo}` },
      ],
      sourceModule: 'AP',
      sourceDocId:  pmt.id,
      userId,
    }, db as any);

    return journal.id;
  }
}
