import { PrismaClient, Prisma } from '@prisma/client';

export type PaymentModeInput = 'NORMAL' | 'ADVANCE' | 'CASH_ON_DELIVERY' | 'CREDIT';
export type DueDateBasisInput = 'DOCUMENT_DATE' | 'DELIVERY_DATE' | 'MONTH_END' | 'INVOICE_DATE';

export interface PaymentTermLineInput {
  paymentPct: number;
  addMonths?: number;
  creditDays?: number;
  cashDiscountDays?: number | null;
  cashDiscountPct?: number | null;
  isActive?: boolean;
}

export interface CreatePaymentTermInput {
  companyId: string;
  code?: string;
  name: string;
  shortName?: string | null;
  paymentMode?: PaymentModeInput;
  dueDateBasis?: DueDateBasisInput;
  dueDateAfterAdvance?: boolean;
  creditDays?: number;
  isActive?: boolean;
  lines?: PaymentTermLineInput[];
}

export type UpdatePaymentTermInput = Partial<Omit<CreatePaymentTermInput, 'companyId'>>;

function notFound(msg = 'Payment term not found') {
  return Object.assign(new Error(msg), { statusCode: 404 });
}
function invalid(msg: string) {
  return Object.assign(new Error(msg), { statusCode: 422 });
}

/**
 * Derives the due date for a document under a payment term.
 * Pure so it can be unit-tested and reused by AR invoicing.
 */
export function computeDueDate(
  baseDate: Date,
  term: { dueDateBasis: string; creditDays: number; lines?: Array<{ addMonths: number; creditDays: number }> }
): Date {
  const d = new Date(baseDate);
  // The final instalment sets the document due date; fall back to headline days.
  const last = term.lines?.length ? term.lines[term.lines.length - 1] : null;
  const addMonths = last?.addMonths ?? 0;
  const creditDays = last?.creditDays ?? term.creditDays ?? 0;

  if (addMonths) d.setMonth(d.getMonth() + addMonths);
  if (term.dueDateBasis === 'MONTH_END') {
    d.setMonth(d.getMonth() + 1);
    d.setDate(0); // last day of the base month
  }
  d.setDate(d.getDate() + creditDays);
  return d;
}

/** Total credit days a term represents (used as the headline value). */
export function headlineCreditDays(lines: Array<{ addMonths?: number; creditDays?: number }>): number {
  if (!lines.length) return 0;
  const last = lines[lines.length - 1];
  return (last.addMonths ?? 0) * 30 + (last.creditDays ?? 0);
}

export class PaymentTermService {
  constructor(private prisma: PrismaClient) {}

  async list(companyId: string, opts: { search?: string; isActive?: boolean } = {}) {
    const where: Prisma.PaymentTermWhereInput = { companyId };
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    if (opts.search) {
      where.OR = [
        { code: { contains: opts.search, mode: 'insensitive' } },
        { name: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.paymentTerm.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    return rows.map((r) => this.shape(r));
  }

  async getById(id: string, companyId: string) {
    const row = await this.prisma.paymentTerm.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) throw notFound();
    return this.shape(row);
  }

  async create(input: CreatePaymentTermInput, userId: string) {
    const lines = this.validateLines(input.lines);
    const code = input.code?.trim() || (await this.nextCode(input.companyId));
    const clash = await this.prisma.paymentTerm.findFirst({ where: { companyId: input.companyId, code }, select: { id: true } });
    if (clash) throw Object.assign(new Error(`Payment term code "${code}" already exists`), { statusCode: 409 });

    const row = await this.prisma.paymentTerm.create({
      data: {
        companyId: input.companyId,
        code,
        name: input.name,
        shortName: input.shortName ?? null,
        paymentMode: (input.paymentMode ?? 'NORMAL') as any,
        dueDateBasis: (input.dueDateBasis ?? 'DOCUMENT_DATE') as any,
        dueDateAfterAdvance: input.dueDateAfterAdvance ?? false,
        creditDays: input.creditDays ?? headlineCreditDays(lines),
        isActive: input.isActive ?? true,
        lines: lines.length ? { createMany: { data: lines.map((l, i) => this.lineData(l, i + 1)) } } : undefined,
      },
    });
    await this.audit('CREATE', row.id, userId, { code: row.code, name: row.name });
    return this.getById(row.id, input.companyId);
  }

  async update(id: string, companyId: string, input: UpdatePaymentTermInput, userId: string) {
    const existing = await this.prisma.paymentTerm.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    const lines = input.lines !== undefined ? this.validateLines(input.lines) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentTerm.update({
        where: { id },
        data: {
          name: input.name,
          shortName: input.shortName,
          paymentMode: input.paymentMode as any,
          dueDateBasis: input.dueDateBasis as any,
          dueDateAfterAdvance: input.dueDateAfterAdvance,
          creditDays: input.creditDays ?? (lines ? headlineCreditDays(lines) : undefined),
          isActive: input.isActive,
        },
      });
      if (lines) {
        await tx.paymentTermLine.deleteMany({ where: { paymentTermId: id } });
        if (lines.length) {
          await tx.paymentTermLine.createMany({ data: lines.map((l, i) => ({ paymentTermId: id, ...this.lineData(l, i + 1) })) });
        }
      }
    });

    // Keep the denormalised label on customers/orders in step with the master.
    if (input.name && input.name !== existing.name) {
      await this.prisma.customer.updateMany({ where: { paymentTermId: id }, data: { paymentTerms: input.name } });
    }

    await this.audit('UPDATE', id, userId, { name: input.name ?? existing.name });
    return this.getById(id, companyId);
  }

  async toggleActive(id: string, companyId: string, userId: string) {
    const row = await this.prisma.paymentTerm.findFirst({ where: { id, companyId } });
    if (!row) throw notFound();
    await this.prisma.paymentTerm.update({ where: { id }, data: { isActive: !row.isActive } });
    await this.audit('UPDATE', id, userId, { isActive: !row.isActive });
    return this.getById(id, companyId);
  }

  async remove(id: string, companyId: string, userId: string) {
    const row = await this.prisma.paymentTerm.findFirst({
      where: { id, companyId },
      include: { _count: { select: { customers: true, salesOrders: true, customerTerms: true } } },
    });
    if (!row) throw notFound();
    const used = row._count.customers + row._count.salesOrders + row._count.customerTerms;
    if (used > 0) throw Object.assign(new Error('Payment term is in use — deactivate instead of deleting'), { statusCode: 409 });
    await this.prisma.paymentTerm.delete({ where: { id } });
    await this.audit('DELETE', id, userId, { code: row.code });
    return { ok: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private shape(r: any) {
    return {
      id: r.id,
      companyId: r.companyId,
      code: r.code,
      name: r.name,
      shortName: r.shortName,
      paymentMode: r.paymentMode,
      dueDateBasis: r.dueDateBasis,
      dueDateAfterAdvance: r.dueDateAfterAdvance,
      creditDays: r.creditDays,
      isActive: r.isActive,
      lines: (r.lines ?? []).map((l: any) => ({
        id: l.id,
        lineNo: l.lineNo,
        paymentPct: Number(l.paymentPct),
        addMonths: l.addMonths,
        creditDays: l.creditDays,
        cashDiscountDays: l.cashDiscountDays,
        cashDiscountPct: l.cashDiscountPct == null ? null : Number(l.cashDiscountPct),
        isActive: l.isActive,
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private validateLines(lines?: PaymentTermLineInput[]): PaymentTermLineInput[] {
    const rows = (lines ?? []).filter((l) => Number(l.paymentPct) > 0);
    if (!rows.length) return [];
    const total = rows.reduce((s, l) => s + Number(l.paymentPct), 0);
    if (Math.abs(total - 100) > 0.01) {
      throw invalid(`Payment schedule must total 100% (currently ${total.toFixed(2)}%)`);
    }
    return rows;
  }

  private lineData(l: PaymentTermLineInput, lineNo: number) {
    return {
      lineNo,
      paymentPct: new Prisma.Decimal(l.paymentPct),
      addMonths: l.addMonths ?? 0,
      creditDays: l.creditDays ?? 0,
      cashDiscountDays: l.cashDiscountDays ?? null,
      cashDiscountPct: l.cashDiscountPct != null ? new Prisma.Decimal(l.cashDiscountPct) : null,
      isActive: l.isActive ?? true,
    };
  }

  private async nextCode(companyId: string): Promise<string> {
    const count = await this.prisma.paymentTerm.count({ where: { companyId, code: { startsWith: 'PT' } } });
    let n = count + 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const code = `PT${String(n).padStart(3, '0')}`;
      const exists = await this.prisma.paymentTerm.findFirst({ where: { companyId, code }, select: { id: true } });
      if (!exists) return code;
      n += 1;
    }
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'payment_terms', recordId, userId, action, newValues: values } });
  }
}
