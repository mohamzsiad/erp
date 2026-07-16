import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { SalesPricingService } from './SalesPricingService.js';
import { AccountMappingService } from '../finance/AccountMappingService.js';
import { JournalService } from '../finance/JournalService.js';
import { buildInvoiceJournalLines, reverseJournalLines } from './SalesInvoiceService.js';

export interface CreditNoteLineInput {
  itemId: string; description?: string | null; uomId: string; qty: number; unitPrice: number; discountPct?: number; taxCodeId?: string | null;
}
export interface CreateCreditNoteInput {
  companyId: string;
  customerId: string;
  salesReturnId?: string | null;
  creditDate: string;
  reason?: string | null;
  lines: CreditNoteLineInput[];
}

// Pure helper — how much of a credit applies to an invoice's outstanding balance.
export function allocateCredit(outstanding: number, creditTotal: number): { applied: number; fullyPaid: boolean } {
  const applied = Math.max(0, Math.min(outstanding, creditTotal));
  return { applied, fullyPaid: applied >= outstanding && outstanding > 0 };
}

function notFound(msg = 'Credit note not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }
function round(n: number) { return Math.round(n * 1000) / 1000; }

export class CreditNoteService {
  private pricing: SalesPricingService;
  private mapping: AccountMappingService;
  constructor(private prisma: PrismaClient) {
    this.pricing = new SalesPricingService(prisma);
    this.mapping = new AccountMappingService(prisma);
  }

  private async approvalThreshold(companyId: string): Promise<number> {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { salesConfig: true } });
    return Number((c?.salesConfig as any)?.CREDIT_NOTE_APPROVAL_THRESHOLD ?? 0);
  }

  async list(companyId: string, q: { search?: string; status?: string; customerId?: string; page?: number; limit?: number }) {
    const { search, status, customerId, page = 1, limit = 50 } = q;
    const where: Prisma.CreditNoteWhereInput = { companyId };
    if (status) where.status = status as any;
    if (customerId) where.customerId = customerId;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      this.prisma.creditNote.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } } } }),
      this.prisma.creditNote.count({ where }),
    ]);
    const data = rows.map((r) => ({ id: r.id, docNo: r.docNo, customerId: r.customerId, customerName: r.customer?.name, creditDate: r.creditDate, amount: Number(r.amount), taxAmount: Number(r.taxAmount), totalAmount: Number(r.totalAmount), status: r.status, createdAt: r.createdAt }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const cn = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
      include: { customer: { select: { id: true, code: true, name: true } }, lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } }, taxCode: { select: { code: true, rate: true } } } } },
    });
    if (!cn) throw notFound();
    return { ...cn, amount: Number(cn.amount), taxAmount: Number(cn.taxAmount), totalAmount: Number(cn.totalAmount) };
  }

  async create(input: CreateCreditNoteInput, userId: string) {
    if (!input.lines.length) throw Object.assign(new Error('Credit note has no lines'), { statusCode: 422 });
    const totals = await this.pricing.computeForLines(input.companyId, input.lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId })));
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'CRN');
    const cn = await this.prisma.creditNote.create({
      data: {
        companyId: input.companyId, docNo, customerId: input.customerId, salesReturnId: input.salesReturnId ?? null,
        creditDate: toDate(input.creditDate)!, reason: input.reason ?? null,
        amount: new Prisma.Decimal(totals.netAmount), taxAmount: new Prisma.Decimal(totals.taxAmount), totalAmount: new Prisma.Decimal(totals.totalAmount),
        status: 'DRAFT', createdById: userId,
        lines: { createMany: { data: input.lines.map((l, i) => ({
          itemId: l.itemId, description: l.description ?? null, uomId: l.uomId, qty: new Prisma.Decimal(l.qty),
          unitPrice: new Prisma.Decimal(l.unitPrice), taxCodeId: l.taxCodeId ?? null,
          netAmount: new Prisma.Decimal(totals.lines[i].netAmount), taxAmount: new Prisma.Decimal(totals.lines[i].taxAmount), lineTotal: new Prisma.Decimal(totals.lines[i].lineTotal), lineNo: i + 1,
        })) } },
      },
    });
    await this.audit('CREATE', cn.id, userId, { docNo });
    return this.getById(cn.id, input.companyId);
  }

  // Build a credit note from a return, pricing lines off the return's original invoice.
  async createFromReturn(returnId: string, companyId: string, userId: string) {
    const ret = await this.prisma.salesReturn.findFirst({ where: { id: returnId, companyId }, include: { lines: true } });
    if (!ret) throw Object.assign(new Error('Sales return not found'), { statusCode: 404 });
    let customerId = ret.customerId;
    let invLines: Array<{ itemId: string; unitPrice: any; discountPct: any; taxCodeId: string | null }> = [];
    if (ret.salesInvoiceId) {
      const inv = await this.prisma.salesInvoice.findUnique({ where: { id: ret.salesInvoiceId }, include: { lines: true } });
      if (inv) { customerId = inv.customerId; invLines = inv.lines.map((l) => ({ itemId: l.itemId, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId })); }
    }
    if (!customerId) throw Object.assign(new Error('Return has no customer; cannot credit'), { statusCode: 422 });
    const lines: CreditNoteLineInput[] = ret.lines.map((l) => {
      const src = invLines.find((x) => x.itemId === l.itemId);
      return { itemId: l.itemId, uomId: l.uomId, qty: Number(l.qty), unitPrice: src ? Number(src.unitPrice) : 0, discountPct: src ? Number(src.discountPct) : 0, taxCodeId: src?.taxCodeId ?? null };
    });
    return this.create({ companyId, customerId, salesReturnId: returnId, creditDate: new Date().toISOString(), lines }, userId);
  }

  async approve(id: string, companyId: string, userId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id, companyId } });
    if (!cn) throw notFound();
    if (cn.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT credit notes can be approved'), { statusCode: 409 });
    await this.prisma.creditNote.update({ where: { id }, data: { status: 'APPROVED' } });
    await this.audit('UPDATE', id, userId, { action: 'approve' });
    return this.getById(id, companyId);
  }

  // Post → reversing GL journal + credit ArInvoice + allocation against the original invoice.
  async post(id: string, companyId: string, userId: string) {
    const cn = await this.getById(id, companyId);
    if (cn.status !== 'APPROVED') throw Object.assign(new Error('Only APPROVED credit notes can be posted'), { statusCode: 409 });

    // COGS reversal for goods-linked credit notes (returned stock cost)
    let cogsTotal = 0;
    let originalArInvoiceId: string | null = null;
    if (cn.salesReturnId) {
      const ret = await this.prisma.salesReturn.findUnique({ where: { id: cn.salesReturnId }, include: { lines: true } });
      if (ret) {
        if (ret.salesInvoiceId) {
          const inv = await this.prisma.salesInvoice.findUnique({ where: { id: ret.salesInvoiceId }, select: { arInvoiceId: true } });
          originalArInvoiceId = inv?.arInvoiceId ?? null;
        }
        let warehouseId: string | null = null;
        if (ret.deliveryNoteId) {
          const dn = await this.prisma.deliveryNote.findUnique({ where: { id: ret.deliveryNoteId }, select: { warehouseId: true } });
          warehouseId = dn?.warehouseId ?? null;
        }
        for (const l of ret.lines) {
          let avg = 0;
          if (warehouseId) {
            const bal = await this.prisma.stockBalance.findFirst({ where: { itemId: l.itemId, warehouseId, binId: null }, select: { avgCost: true } });
            avg = Number(bal?.avgCost ?? 0);
          }
          cogsTotal += Number(l.qty) * avg;
        }
        cogsTotal = round(cogsTotal);
      }
    }

    const arAccount = await this.mapping.resolve(companyId, 'CUSTOMER_CONTROL');
    const revenueAccount = await this.mapping.resolve(companyId, 'SALES_REVENUE');
    const vatAccount = cn.taxAmount > 0 ? await this.mapping.resolve(companyId, 'VAT_OUTPUT') : null;
    const cogsAccount = cogsTotal > 0 ? await this.mapping.resolve(companyId, 'COGS') : null;
    const inventoryAccount = cogsTotal > 0 ? await this.mapping.resolve(companyId, 'INVENTORY_ACCOUNT') : null;

    // A credit note is the reversal of the corresponding sales-invoice posting.
    const jLines = reverseJournalLines(buildInvoiceJournalLines({
      arAccount, revenueAccount, vatAccount, cogsAccount, inventoryAccount,
      netAmount: cn.amount, taxAmount: cn.taxAmount, totalAmount: cn.totalAmount, cogsTotal,
    }));

    const journal = await new JournalService(this.prisma).postJournal({
      companyId, entryDate: new Date(cn.creditDate), description: `Credit note: ${cn.docNo}`, lines: jLines, sourceModule: 'SALES', sourceDocId: cn.id, userId,
    });
    const arDocNo = await getNextDocNo(this.prisma, companyId, 'FINANCE', 'ARINV');

    await this.prisma.$transaction(async (tx) => {
      const ar = await tx.arInvoice.create({
        data: {
          companyId, docNo: arDocNo, customerId: cn.customerId, description: `Credit note ${cn.docNo}`,
          invoiceDate: cn.creditDate, dueDate: cn.creditDate,
          amount: new Prisma.Decimal(-cn.amount), taxAmount: new Prisma.Decimal(-cn.taxAmount), totalAmount: new Prisma.Decimal(-cn.totalAmount),
          status: 'POSTED', journalId: journal.id, createdById: userId,
        },
      });
      // Allocate against the original invoice's outstanding, if resolvable
      if (originalArInvoiceId) {
        const orig = await tx.arInvoice.findUnique({ where: { id: originalArInvoiceId }, select: { totalAmount: true, paidAmount: true } });
        if (orig) {
          const outstanding = Number(orig.totalAmount) - Number(orig.paidAmount);
          const { applied, fullyPaid } = allocateCredit(outstanding, cn.totalAmount);
          if (applied > 0) {
            await tx.arInvoice.update({ where: { id: originalArInvoiceId }, data: { paidAmount: { increment: new Prisma.Decimal(applied) }, status: fullyPaid ? 'PAID' : 'PARTIAL' } });
          }
        }
      }
      await tx.creditNote.update({ where: { id }, data: { status: 'POSTED', journalId: journal.id, arInvoiceId: ar.id } });
    });
    await this.audit('UPDATE', id, userId, { action: 'post', cogsTotal });
    return this.getById(id, companyId);
  }

  async cancel(id: string, companyId: string, userId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id, companyId } });
    if (!cn) throw notFound();
    if (!['DRAFT', 'APPROVED'].includes(cn.status)) throw Object.assign(new Error('Only unposted credit notes can be cancelled'), { statusCode: 409 });
    await this.prisma.creditNote.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit('UPDATE', id, userId, { action: 'cancel' });
    return this.getById(id, companyId);
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'credit_notes', recordId, userId, action, newValues: values } });
  }
}
