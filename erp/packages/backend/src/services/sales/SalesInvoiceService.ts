import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { SalesPricingService } from './SalesPricingService.js';
import { AccountMappingService } from '../finance/AccountMappingService.js';
import { JournalService } from '../finance/JournalService.js';

export interface InvoiceLineInput {
  itemId: string;
  description?: string | null;
  uomId: string;
  qty: number;
  unitPrice: number;
  discountPct?: number;
  taxCodeId?: string | null;
}
export interface CreateInvoiceInput {
  companyId: string;
  customerId: string;
  deliveryNoteId?: string | null;
  salesOrderId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  description?: string | null;
  lines: InvoiceLineInput[];
}

export interface JournalLine { accountId: string; debit: number; credit: number; description?: string }

// ── Pure, unit-testable journal builders ──────────────────────────────────────
export function buildInvoiceJournalLines(a: {
  arAccount: string; revenueAccount: string; vatAccount: string | null;
  cogsAccount: string | null; inventoryAccount: string | null;
  netAmount: number; taxAmount: number; totalAmount: number; cogsTotal: number;
}): JournalLine[] {
  const lines: JournalLine[] = [
    { accountId: a.arAccount, debit: a.totalAmount, credit: 0, description: 'Accounts receivable' },
    { accountId: a.revenueAccount, debit: 0, credit: a.netAmount, description: 'Sales revenue' },
  ];
  if (a.taxAmount > 0 && a.vatAccount) lines.push({ accountId: a.vatAccount, debit: 0, credit: a.taxAmount, description: 'VAT output' });
  if (a.cogsTotal > 0 && a.cogsAccount && a.inventoryAccount) {
    lines.push({ accountId: a.cogsAccount, debit: a.cogsTotal, credit: 0, description: 'Cost of goods sold' });
    lines.push({ accountId: a.inventoryAccount, debit: 0, credit: a.cogsTotal, description: 'Inventory' });
  }
  return lines;
}

export function reverseJournalLines(lines: JournalLine[]): JournalLine[] {
  return lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, description: `Reversal: ${l.description ?? ''}` }));
}

export function journalIsBalanced(lines: JournalLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const c = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(d - c) < 0.005;
}

function notFound(msg = 'Sales invoice not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }
function round(n: number) { return Math.round(n * 1000) / 1000; }

export class SalesInvoiceService {
  private pricing: SalesPricingService;
  private mapping: AccountMappingService;
  constructor(private prisma: PrismaClient) {
    this.pricing = new SalesPricingService(prisma);
    this.mapping = new AccountMappingService(prisma);
  }

  private async autoPost(companyId: string): Promise<boolean> {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { salesConfig: true } });
    return ((c?.salesConfig as any)?.AUTO_POST_INVOICE ?? true) === true;
  }

  async list(companyId: string, q: { search?: string; status?: string; customerId?: string; page?: number; limit?: number }) {
    const { search, status, customerId, page = 1, limit = 50 } = q;
    const where: Prisma.SalesInvoiceWhereInput = { companyId };
    if (status) where.status = status as any;
    if (customerId) where.customerId = customerId;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } } } }),
      this.prisma.salesInvoice.count({ where }),
    ]);
    const data = rows.map((r) => ({
      id: r.id, docNo: r.docNo, customerId: r.customerId, customerName: r.customer?.name, invoiceDate: r.invoiceDate, dueDate: r.dueDate,
      amount: Number(r.amount), taxAmount: Number(r.taxAmount), totalAmount: Number(r.totalAmount), paidAmount: Number(r.paidAmount), status: r.status, createdAt: r.createdAt,
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const inv = await this.prisma.salesInvoice.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, code: true, name: true, trn: true } },
        lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } }, taxCode: { select: { code: true, rate: true } } } },
      },
    });
    if (!inv) throw notFound();
    return {
      ...inv, subTotal: Number(inv.subTotal), discountAmount: Number(inv.discountAmount), amount: Number(inv.amount),
      taxAmount: Number(inv.taxAmount), totalAmount: Number(inv.totalAmount), paidAmount: Number(inv.paidAmount),
    };
  }

  private async pricedTotals(companyId: string, lines: InvoiceLineInput[]) {
    const totals = await this.pricing.computeForLines(companyId, lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId })));
    return totals;
  }

  async create(input: CreateInvoiceInput, userId: string) {
    const totals = await this.pricedTotals(input.companyId, input.lines);
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'SVL');
    const dueDate = toDate(input.dueDate) ?? toDate(input.invoiceDate)!;
    const inv = await this.prisma.salesInvoice.create({
      data: {
        companyId: input.companyId, docNo, customerId: input.customerId, deliveryNoteId: input.deliveryNoteId ?? null, salesOrderId: input.salesOrderId ?? null,
        invoiceDate: toDate(input.invoiceDate)!, dueDate, description: input.description ?? null,
        subTotal: new Prisma.Decimal(totals.subTotal), discountAmount: new Prisma.Decimal(totals.discountAmount),
        amount: new Prisma.Decimal(totals.netAmount), taxAmount: new Prisma.Decimal(totals.taxAmount), totalAmount: new Prisma.Decimal(totals.totalAmount),
        status: 'DRAFT', createdById: userId,
        lines: { createMany: { data: input.lines.map((l, i) => ({
          itemId: l.itemId, description: l.description ?? null, uomId: l.uomId, qty: new Prisma.Decimal(l.qty),
          unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct ?? 0), taxCodeId: l.taxCodeId ?? null,
          netAmount: new Prisma.Decimal(totals.lines[i].netAmount), taxAmount: new Prisma.Decimal(totals.lines[i].taxAmount), lineTotal: new Prisma.Decimal(totals.lines[i].lineTotal), lineNo: i + 1,
        })) } },
      },
    });
    await this.audit('CREATE', inv.id, userId, { docNo });
    return this.getById(inv.id, input.companyId);
  }

  // Build an invoice from a posted delivery note, pricing lines off the linked SO lines.
  async createFromDelivery(deliveryNoteId: string, companyId: string, userId: string) {
    const dn = await this.prisma.deliveryNote.findFirst({
      where: { id: deliveryNoteId, companyId },
      include: { lines: { include: { salesOrderLine: true } } },
    });
    if (!dn) throw Object.assign(new Error('Delivery note not found'), { statusCode: 404 });
    if (dn.status === 'DRAFT') throw Object.assign(new Error('Delivery must be dispatched before invoicing'), { statusCode: 409 });
    const lines: InvoiceLineInput[] = dn.lines.map((l) => {
      const sol = l.salesOrderLine;
      return {
        itemId: l.itemId, uomId: l.uomId, qty: Number(l.deliveredQty),
        unitPrice: sol ? Number(sol.unitPrice) : 0, discountPct: sol ? Number(sol.discountPct) : 0, taxCodeId: sol?.taxCodeId ?? null,
      };
    });
    return this.create({ companyId, customerId: dn.customerId, deliveryNoteId: dn.id, salesOrderId: dn.salesOrderId, invoiceDate: new Date().toISOString(), lines }, userId);
  }

  async update(id: string, companyId: string, input: Partial<CreateInvoiceInput>, userId: string) {
    const existing = await this.prisma.salesInvoice.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT invoices can be edited'), { statusCode: 409 });
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.SalesInvoiceUpdateInput = {
        invoiceDate: input.invoiceDate ? toDate(input.invoiceDate)! : undefined,
        dueDate: input.dueDate !== undefined ? (toDate(input.dueDate) ?? undefined) : undefined,
        description: input.description,
      };
      if (input.lines !== undefined) {
        const totals = await this.pricedTotals(companyId, input.lines);
        data.subTotal = new Prisma.Decimal(totals.subTotal); data.discountAmount = new Prisma.Decimal(totals.discountAmount);
        data.amount = new Prisma.Decimal(totals.netAmount); data.taxAmount = new Prisma.Decimal(totals.taxAmount); data.totalAmount = new Prisma.Decimal(totals.totalAmount);
        await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.salesInvoiceLine.createMany({ data: input.lines.map((l, i) => ({
          invoiceId: id, itemId: l.itemId, description: l.description ?? null, uomId: l.uomId, qty: new Prisma.Decimal(l.qty),
          unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct ?? 0), taxCodeId: l.taxCodeId ?? null,
          netAmount: new Prisma.Decimal(totals.lines[i].netAmount), taxAmount: new Prisma.Decimal(totals.lines[i].taxAmount), lineTotal: new Prisma.Decimal(totals.lines[i].lineTotal), lineNo: i + 1,
        })) });
      }
      await tx.salesInvoice.update({ where: { id }, data });
    });
    await this.audit('UPDATE', id, userId, {});
    return this.getById(id, companyId);
  }

  // ── Post → ArInvoice + balanced GL journal ─────────────────────────────────
  async post(id: string, companyId: string, userId: string) {
    const inv = await this.getById(id, companyId);
    if (inv.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT invoices can be posted'), { statusCode: 409 });
    if (!(await this.autoPost(companyId))) {
      const posted = await this.prisma.salesInvoice.update({ where: { id }, data: { status: 'POSTED' } });
      await this.audit('UPDATE', id, userId, { action: 'post-noauto' });
      return this.getById(posted.id, companyId);
    }

    // COGS from the linked delivery note (goods cost captured at dispatch)
    let cogsTotal = 0;
    if (inv.deliveryNoteId) {
      const dl = await this.prisma.deliveryNoteLine.findMany({ where: { deliveryNoteId: inv.deliveryNoteId }, select: { deliveredQty: true, unitCost: true } });
      cogsTotal = round(dl.reduce((s, l) => s + Number(l.deliveredQty) * Number(l.unitCost), 0));
    }

    // Resolve GL accounts up-front (reads)
    const arAccount = await this.mapping.resolve(companyId, 'CUSTOMER_CONTROL');
    const revenueAccount = await this.mapping.resolve(companyId, 'SALES_REVENUE');
    const vatAccount = inv.taxAmount > 0 ? await this.mapping.resolve(companyId, 'VAT_OUTPUT') : null;
    const cogsAccount = cogsTotal > 0 ? await this.mapping.resolve(companyId, 'COGS') : null;
    const inventoryAccount = cogsTotal > 0 ? await this.mapping.resolve(companyId, 'INVENTORY_ACCOUNT') : null;

    const jLines = buildInvoiceJournalLines({
      arAccount, revenueAccount, vatAccount, cogsAccount, inventoryAccount,
      netAmount: inv.amount, taxAmount: inv.taxAmount, totalAmount: inv.totalAmount, cogsTotal,
    });

    const arDocNo = await getNextDocNo(this.prisma, companyId, 'FINANCE', 'ARINV');

    // Post the GL journal first (it manages its own transaction + JE numbering),
    // then persist the AR invoice + links atomically.
    const journal = await new JournalService(this.prisma).postJournal({
      companyId, entryDate: new Date(inv.invoiceDate), description: `Sales invoice: ${inv.docNo}`,
      lines: jLines, sourceModule: 'SALES', sourceDocId: inv.id, userId,
    });

    await this.prisma.$transaction(async (tx) => {
      const ar = await tx.arInvoice.create({
        data: {
          companyId, docNo: arDocNo, customerId: inv.customerId, description: `Sales invoice ${inv.docNo}`,
          invoiceDate: inv.invoiceDate, dueDate: inv.dueDate, amount: new Prisma.Decimal(inv.amount),
          taxAmount: new Prisma.Decimal(inv.taxAmount), totalAmount: new Prisma.Decimal(inv.totalAmount),
          status: 'POSTED', journalId: journal.id, createdById: userId,
        },
      });
      await tx.salesInvoice.update({ where: { id }, data: { status: 'POSTED', journalId: journal.id, arInvoiceId: ar.id } });

      // Update invoiced quantities on the linked SO lines (deliver-then-bill)
      if (inv.deliveryNoteId) {
        const dlines = await tx.deliveryNoteLine.findMany({ where: { deliveryNoteId: inv.deliveryNoteId }, select: { salesOrderLineId: true, deliveredQty: true } });
        for (const dl of dlines) {
          if (dl.salesOrderLineId) await tx.salesOrderLine.update({ where: { id: dl.salesOrderLineId }, data: { invoicedQty: { increment: new Prisma.Decimal(Number(dl.deliveredQty)) } } });
        }
      }
    });
    await this.audit('UPDATE', id, userId, { action: 'post', cogsTotal });
    return this.getById(id, companyId);
  }

  // ── Cancel → reverse GL + AR ───────────────────────────────────────────────
  async cancel(id: string, companyId: string, userId: string) {
    const inv = await this.getById(id, companyId);
    if (inv.status === 'CANCELLED') throw Object.assign(new Error('Invoice already cancelled'), { statusCode: 409 });
    if (Number(inv.paidAmount) > 0) throw Object.assign(new Error('Cannot cancel a partially paid invoice'), { statusCode: 409 });

    if (inv.status === 'POSTED' && inv.journalId) {
      const original = await this.prisma.journalEntry.findUnique({ where: { id: inv.journalId }, include: { lines: true } });
      if (original) {
        const rev = reverseJournalLines(original.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit), description: l.description ?? undefined })));
        await new JournalService(this.prisma).postJournal({
          companyId, entryDate: new Date(), description: `Reversal of sales invoice ${inv.docNo}`,
          lines: rev, sourceModule: 'SALES', sourceDocId: inv.id, userId,
        });
      }
    }
    await this.prisma.$transaction(async (tx) => {
      if (inv.status === 'POSTED' && inv.arInvoiceId) await tx.arInvoice.update({ where: { id: inv.arInvoiceId }, data: { status: 'CANCELLED' } });
      await tx.salesInvoice.update({ where: { id }, data: { status: 'CANCELLED' } });
    });
    await this.audit('UPDATE', id, userId, { action: 'cancel' });
    return this.getById(id, companyId);
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'sales_invoices', recordId, userId, action, newValues: values } });
  }
}
