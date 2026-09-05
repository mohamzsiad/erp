import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';

export interface BoqLineInput {
  section?: string | null;
  subSection?: string | null;
  itemDescription: string;
  uomId?: string | null;
  contractQty: number;
  rate: number;
}
export interface CreateContractInput {
  companyId: string;
  customerId: string;
  projectRef?: string | null;
  projectName: string;
  contractValue?: number;
  startDate?: string | null;
  endDate?: string | null;
  paymentTerms?: string | null;
  costCenterId?: string | null;
  boqLines?: BoqLineInput[];
}
export type UpdateContractInput = Partial<Omit<CreateContractInput, 'companyId'>>;

export interface VariationInput {
  reason?: string;
  adjustments?: Array<{ boqLineId: string; deltaQty: number }>;
  newLines?: BoqLineInput[];
}

// ── Pure, unit-testable helpers ───────────────────────────────────────────────
function round(n: number) { return Math.round(n * 1000) / 1000; }

export function boqAmount(qty: number, rate: number): number {
  return round(qty * rate);
}

export function summarizeBoq(lines: Array<{ section?: string | null; contractQty: number; rate: number }>): {
  total: number;
  sections: Array<{ section: string; subtotal: number }>;
} {
  let total = 0;
  const bySection = new Map<string, number>();
  for (const l of lines) {
    const amt = boqAmount(l.contractQty, l.rate);
    total += amt;
    const key = l.section?.trim() || 'Ungrouped';
    bySection.set(key, round((bySection.get(key) ?? 0) + amt));
  }
  return { total: round(total), sections: [...bySection.entries()].map(([section, subtotal]) => ({ section, subtotal })) };
}

export function contractVariance(contractValue: number, boqTotal: number, tolerance = 0.5): { variance: number; matches: boolean } {
  const variance = round(boqTotal - contractValue);
  return { variance, matches: Math.abs(variance) <= tolerance };
}

export function applyVariationDelta(line: { originalQty: number | null; contractQty: number; rate: number }, delta: number): {
  originalQty: number; newContractQty: number; newAmount: number;
} {
  const originalQty = line.originalQty ?? line.contractQty;
  const newContractQty = round(line.contractQty + delta);
  return { originalQty, newContractQty, newAmount: boqAmount(newContractQty, line.rate) };
}

function notFound(msg = 'Sales contract not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }

export class SalesContractService {
  constructor(private prisma: PrismaClient) {}

  async list(companyId: string, q: { search?: string; status?: string; customerId?: string; page?: number; limit?: number }) {
    const { search, status, customerId, page = 1, limit = 50 } = q;
    const where: Prisma.SalesContractWhereInput = { companyId };
    if (status) where.status = status as any;
    if (customerId) where.customerId = customerId;
    if (search) where.OR = [{ docNo: { contains: search, mode: 'insensitive' } }, { projectName: { contains: search, mode: 'insensitive' } }];
    const [rows, total] = await Promise.all([
      this.prisma.salesContract.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } }, _count: { select: { boqLines: true } } } }),
      this.prisma.salesContract.count({ where }),
    ]);
    const data = rows.map((r) => ({ id: r.id, docNo: r.docNo, customerId: r.customerId, customerName: r.customer?.name, projectName: r.projectName, projectRef: r.projectRef, contractValue: Number(r.contractValue), startDate: r.startDate, endDate: r.endDate, status: r.status, boqCount: r._count.boqLines, createdAt: r.createdAt }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const c = await this.prisma.salesContract.findFirst({
      where: { id, companyId },
      include: { customer: { select: { id: true, code: true, name: true } }, boqLines: { orderBy: { lineNo: 'asc' }, include: { uom: { select: { code: true } } } } },
    });
    if (!c) throw notFound();
    const lines = c.boqLines.map((l) => ({
      id: l.id, section: l.section, subSection: l.subSection, itemDescription: l.itemDescription, uomId: l.uomId, uomCode: l.uom?.code,
      contractQty: Number(l.contractQty), originalQty: l.originalQty != null ? Number(l.originalQty) : null, rate: Number(l.rate), contractAmount: Number(l.contractAmount), lineNo: l.lineNo,
    }));
    const summary = summarizeBoq(lines);
    const variance = contractVariance(Number(c.contractValue), summary.total);
    return { ...c, contractValue: Number(c.contractValue), boqLines: lines, boqSummary: summary, variance };
  }

  private boqData(l: BoqLineInput, i: number) {
    return {
      section: l.section ?? null, subSection: l.subSection ?? null, itemDescription: l.itemDescription, uomId: l.uomId ?? null,
      contractQty: new Prisma.Decimal(l.contractQty), rate: new Prisma.Decimal(l.rate), contractAmount: new Prisma.Decimal(boqAmount(l.contractQty, l.rate)), lineNo: i + 1,
    };
  }

  async create(input: CreateContractInput, userId: string) {
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'SCL');
    const lines = input.boqLines ?? [];
    const contractValue = input.contractValue ?? summarizeBoq(lines).total;
    const c = await this.prisma.salesContract.create({
      data: {
        companyId: input.companyId, docNo, customerId: input.customerId, projectRef: input.projectRef ?? null, projectName: input.projectName,
        contractValue: new Prisma.Decimal(contractValue), startDate: toDate(input.startDate), endDate: toDate(input.endDate),
        paymentTerms: input.paymentTerms ?? null, costCenterId: input.costCenterId ?? null, status: 'DRAFT', createdById: userId,
        boqLines: lines.length ? { createMany: { data: lines.map((l, i) => this.boqData(l, i)) } } : undefined,
      },
    });
    await this.audit('CREATE', c.id, userId, { docNo });
    return this.getById(c.id, input.companyId);
  }

  async update(id: string, companyId: string, input: UpdateContractInput, userId: string) {
    const existing = await this.prisma.salesContract.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.salesContract.update({ where: { id }, data: {
        projectRef: input.projectRef, projectName: input.projectName, contractValue: input.contractValue != null ? new Prisma.Decimal(input.contractValue) : undefined,
        startDate: input.startDate !== undefined ? toDate(input.startDate) : undefined, endDate: input.endDate !== undefined ? toDate(input.endDate) : undefined,
        paymentTerms: input.paymentTerms, costCenterId: input.costCenterId,
      } });
      if (input.boqLines !== undefined) {
        await tx.boqLine.deleteMany({ where: { contractId: id } });
        if (input.boqLines.length) await tx.boqLine.createMany({ data: input.boqLines.map((l, i) => ({ contractId: id, ...this.boqData(l, i) })) });
      }
    });
    await this.audit('UPDATE', id, userId, {});
    return this.getById(id, companyId);
  }

  // Bulk import / replace BOQ lines.
  async setBoq(id: string, companyId: string, lines: BoqLineInput[], userId: string) {
    const c = await this.prisma.salesContract.findFirst({ where: { id, companyId } });
    if (!c) throw notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.boqLine.deleteMany({ where: { contractId: id } });
      if (lines.length) await tx.boqLine.createMany({ data: lines.map((l, i) => ({ contractId: id, ...this.boqData(l, i) })) });
    });
    await this.audit('UPDATE', id, userId, { action: 'set-boq', count: lines.length });
    return this.getById(id, companyId);
  }

  // Apply a variation order: adjust existing line quantities and/or add new lines.
  async applyVariation(id: string, companyId: string, v: VariationInput, userId: string) {
    const c = await this.prisma.salesContract.findFirst({ where: { id, companyId }, include: { boqLines: true } });
    if (!c) throw notFound();
    await this.prisma.$transaction(async (tx) => {
      for (const adj of v.adjustments ?? []) {
        const line = c.boqLines.find((l) => l.id === adj.boqLineId);
        if (!line) throw Object.assign(new Error('BOQ line not found on this contract'), { statusCode: 422 });
        const r = applyVariationDelta({ originalQty: line.originalQty != null ? Number(line.originalQty) : null, contractQty: Number(line.contractQty), rate: Number(line.rate) }, adj.deltaQty);
        if (r.newContractQty < 0) throw Object.assign(new Error('Variation would make a BOQ quantity negative'), { statusCode: 422 });
        await tx.boqLine.update({ where: { id: line.id }, data: { originalQty: new Prisma.Decimal(r.originalQty), contractQty: new Prisma.Decimal(r.newContractQty), contractAmount: new Prisma.Decimal(r.newAmount) } });
      }
      if (v.newLines?.length) {
        const maxLineNo = c.boqLines.reduce((m, l) => Math.max(m, l.lineNo), 0);
        await tx.boqLine.createMany({ data: v.newLines.map((l, i) => ({ contractId: id, ...this.boqData(l, maxLineNo + i) })) });
      }
      // Recompute contract value from the revised BOQ
      const revised = await tx.boqLine.findMany({ where: { contractId: id }, select: { contractQty: true, rate: true, section: true } });
      const total = summarizeBoq(revised.map((l) => ({ section: l.section, contractQty: Number(l.contractQty), rate: Number(l.rate) }))).total;
      await tx.salesContract.update({ where: { id }, data: { contractValue: new Prisma.Decimal(total) } });
    });
    await this.audit('UPDATE', id, userId, { action: 'variation', reason: v.reason ?? null });
    return this.getById(id, companyId);
  }

  async setStatus(id: string, companyId: string, status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED', userId: string) {
    const c = await this.prisma.salesContract.findFirst({ where: { id, companyId } });
    if (!c) throw notFound();
    await this.prisma.salesContract.update({ where: { id }, data: { status } });
    await this.audit('UPDATE', id, userId, { status });
    return this.getById(id, companyId);
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'sales_contracts', recordId, userId, action, newValues: values } });
  }
}
