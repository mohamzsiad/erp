import { PrismaClient } from '@prisma/client';
import { JournalService } from './JournalService.js';
import { AccountMappingService } from './AccountMappingService.js';
import { getNextDocNo } from '../../utils/DocNumberService.js';

function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0)  return 'Current';
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '>90';
}

export class ArService {
  private journal: JournalService;
  private mapping: AccountMappingService;

  constructor(private prisma: PrismaClient) {
    this.journal = new JournalService(prisma);
    this.mapping = new AccountMappingService(prisma);
  }

  // ── Customer CRUD ─────────────────────────────────────────────────────────
  async listCustomers(companyId: string, params: { search?: string; isActive?: boolean }) {
    const where: any = { companyId };
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.customer.findMany({ where, orderBy: { code: 'asc' } });
  }

  async createCustomer(companyId: string, data: { code: string; name: string }) {
    const existing = await this.prisma.customer.findFirst({ where: { companyId, code: data.code } });
    if (existing) throw Object.assign(new Error(`Customer code ${data.code} already exists`), { statusCode: 409 });
    return this.prisma.customer.create({ data: { companyId, ...data } });
  }

  async updateCustomer(id: string, companyId: string, data: { name?: string; isActive?: boolean }) {
    const cust = await this.prisma.customer.findFirst({ where: { id, companyId } });
    if (!cust) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
    return this.prisma.customer.update({ where: { id }, data });
  }

  async searchCustomers(companyId: string, q: string) {
    return this.prisma.customer.findMany({
      where: {
        companyId, isActive: true,
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { code: 'asc' },
    });
  }

  // ── AR Invoices ───────────────────────────────────────────────────────────
  async listInvoices(companyId: string, params: {
    status?: string; customerId?: string; dateFrom?: string; dateTo?: string;
    page?: number; limit?: number;
  }) {
    const { status, customerId, dateFrom, dateTo, page = 1, limit = 50 } = params;
    const where: any = { companyId };
    if (status)     where.status     = status;
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.invoiceDate = {};
      if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
      if (dateTo)   where.invoiceDate.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.arInvoice.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: { customer: { select: { name: true, code: true } } },
      }),
      this.prisma.arInvoice.count({ where }),
    ]);

    const today = new Date();
    const enriched = items.map((inv) => {
      const due  = new Date(inv.dueDate);
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      return { ...inv, customerName: (inv as any).customer?.name, daysOverdue: days, agingBucket: agingBucket(days) };
    });

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getInvoiceById(id: string, companyId: string) {
    const inv = await this.prisma.arInvoice.findFirst({
      where: { id, companyId },
      include: { customer: true, allocations: true },
    });
    if (!inv) throw Object.assign(new Error('AR Invoice not found'), { statusCode: 404 });
    return inv;
  }

  async createInvoice(companyId: string, data: {
    customerId: string;
    description?: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    taxAmount?: number;
    revenueAccountId?: string;
  }, userId: string) {
    const totalAmount = data.amount + (data.taxAmount ?? 0);
    const docNo = await getNextDocNo(this.prisma, companyId, 'FINANCE', 'ARINV');

    const inv = await this.prisma.$transaction(async (tx) => {
      const created = await tx.arInvoice.create({
        data: {
          companyId,
          docNo,
          customerId:  data.customerId,
          description: data.description ?? null,
          invoiceDate: new Date(data.invoiceDate),
          dueDate:     new Date(data.dueDate),
          amount:      data.amount,
          taxAmount:   data.taxAmount ?? 0,
          totalAmount,
          status:      'DRAFT',
          createdById: userId,
        },
      });

      // Auto-post journal: DR Customer Control, CR Revenue
      const journalId = await this.postInvoiceJournal(
        tx as any, companyId, created, data.revenueAccountId, userId
      );
      await tx.arInvoice.update({ where: { id: created.id }, data: { status: 'POSTED', journalId } });

      return created;
    });

    return this.getInvoiceById(inv.id, companyId);
  }

  // ── AR Receipts ───────────────────────────────────────────────────────────
  async listReceipts(companyId: string, params: {
    customerId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number;
  }) {
    const { customerId, dateFrom, dateTo, page = 1, limit = 50 } = params;
    const where: any = { companyId };
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.receiptDate = {};
      if (dateFrom) where.receiptDate.gte = new Date(dateFrom);
      if (dateTo)   where.receiptDate.lte = new Date(dateTo);
    }
    const [items, total] = await Promise.all([
      this.prisma.arReceipt.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { receiptDate: 'desc' },
        include: {
          customer: { select: { name: true, code: true } },
          allocations: { include: { invoice: { select: { docNo: true } } } },
        },
      }),
      this.prisma.arReceipt.count({ where }),
    ]);
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createReceipt(companyId: string, data: {
    customerId: string;
    receiptDate: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
    allocations: Array<{ invoiceId: string; amount: number }>;
  }, userId: string) {
    const totalAllocated = data.allocations.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(totalAllocated - data.amount) > 0.01) {
      throw Object.assign(
        new Error(`Allocated (${totalAllocated.toFixed(3)}) ≠ receipt amount (${data.amount.toFixed(3)})`),
        { statusCode: 422 }
      );
    }

    const docNo = await getNextDocNo(this.prisma, companyId, 'FINANCE', 'ARREC');

    const receipt = await this.prisma.$transaction(async (tx) => {
      const rcpt = await tx.arReceipt.create({
        data: {
          companyId,
          docNo,
          customerId:    data.customerId,
          receiptDate:   new Date(data.receiptDate),
          amount:        data.amount,
          paymentMethod: data.paymentMethod as any,
          notes:         data.notes ?? null,
          createdById:   userId,
        },
      });

      for (const alloc of data.allocations) {
        await tx.arAllocation.create({
          data: { receiptId: rcpt.id, invoiceId: alloc.invoiceId, amount: alloc.amount },
        });
        const inv = await tx.arInvoice.findUnique({ where: { id: alloc.invoiceId } });
        if (!inv) continue;
        const newPaid   = Number(inv.paidAmount) + alloc.amount;
        const newStatus = newPaid >= Number(inv.totalAmount) - 0.001 ? 'PAID' : 'PARTIAL';
        await tx.arInvoice.update({ where: { id: alloc.invoiceId }, data: { paidAmount: newPaid, status: newStatus } });
      }

      const journalId = await this.postReceiptJournal(tx as any, companyId, rcpt, userId);
      await tx.arReceipt.update({ where: { id: rcpt.id }, data: { journalId } });

      return rcpt;
    });

    return this.prisma.arReceipt.findUnique({
      where: { id: receipt.id },
      include: { allocations: true },
    });
  }

  // ── Internal: AR invoice journal (DR Customer Control, CR Revenue) ─────────
  private async postInvoiceJournal(
    db: PrismaClient, companyId: string, inv: any, revenueAccountId?: string, userId?: string
  ): Promise<string> {
    const revenueAcc         = revenueAccountId ?? await this.mapping.resolve(companyId, 'AR_REVENUE');
    const customerControlAcc = await this.mapping.resolve(companyId, 'CUSTOMER_CONTROL');

    const journal = await new JournalService(db).postJournal({
      companyId,
      entryDate:   new Date(inv.invoiceDate),
      description: `AR Invoice: ${inv.docNo}`,
      lines: [
        { accountId: customerControlAcc, debit: Number(inv.totalAmount), credit: 0, description: `Customer receivable - ${inv.docNo}` },
        { accountId: revenueAcc,         debit: 0, credit: Number(inv.totalAmount), description: `Revenue - ${inv.docNo}` },
      ],
      sourceModule: 'AR',
      sourceDocId:  inv.id,
      userId: userId ?? 'system',
    }, db as any);

    return journal.id;
  }

  // ── Internal: receipt journal (DR Bank, CR Customer Control) ──────────────
  private async postReceiptJournal(
    db: PrismaClient, companyId: string, rcpt: any, userId: string
  ): Promise<string> {
    const bankAcc            = await this.mapping.resolve(companyId, 'BANK_ACCOUNT');
    const customerControlAcc = await this.mapping.resolve(companyId, 'CUSTOMER_CONTROL');

    const journal = await new JournalService(db).postJournal({
      companyId,
      entryDate:   new Date(rcpt.receiptDate),
      description: `AR Receipt: ${rcpt.docNo}`,
      lines: [
        { accountId: bankAcc,            debit: Number(rcpt.amount), credit: 0, description: `Receipt from customer - ${rcpt.docNo}` },
        { accountId: customerControlAcc, debit: 0, credit: Number(rcpt.amount), description: `Customer settled - ${rcpt.docNo}` },
      ],
      sourceModule: 'AR',
      sourceDocId:  rcpt.id,
      userId,
    }, db as any);

    return journal.id;
  }
}
