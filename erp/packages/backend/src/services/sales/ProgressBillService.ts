import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { AccountMappingService } from '../finance/AccountMappingService.js';
import { JournalService } from '../finance/JournalService.js';
import { buildInvoiceJournalLines } from './SalesInvoiceService.js';

export interface ProgressLineInput { boqLineId: string; cumQty: number; }
export interface CreateProgressBillInput {
  companyId: string;
  contractId: string;
  period: string;
  billDate: string;
  lines: ProgressLineInput[];
}

export class OverBillingError extends Error {
  statusCode = 422;
  constructor(description: string, cumQty: number, contractQty: number) {
    super(`Over-billing on "${description}": cumulative qty ${cumQty} exceeds contract qty ${contractQty}`);
  }
}

function round(n: number) { return Math.round(n * 1000) / 1000; }

// ── Pure, unit-testable helpers ───────────────────────────────────────────────
export function certifyLine(
  cumQty: number, previousValue: number, rate: number, contractQty: number, description = '',
): { cumValue: number; thisValue: number } {
  if (cumQty > contractQty + 1e-6) throw new OverBillingError(description, cumQty, contractQty);
  const cumValue = round(cumQty * rate);
  return { cumValue, thisValue: round(cumValue - previousValue) };
}

export function computeBillAmounts(thisValueSum: number, taxRatePct: number): { amount: number; taxAmount: number; totalAmount: number } {
  const amount = round(thisValueSum);
  const taxAmount = round(amount * (taxRatePct / 100));
  return { amount, taxAmount, totalAmount: round(amount + taxAmount) };
}

export function progressSummary(contractValue: number, certifiedToDate: number, thisBill: number): {
  contractValue: number; certifiedToDate: number; thisBill: number; balanceToComplete: number; percentComplete: number;
} {
  const balanceToComplete = round(contractValue - certifiedToDate);
  const percentComplete = contractValue > 0 ? round((certifiedToDate / contractValue) * 100) : 0;
  return { contractValue: round(contractValue), certifiedToDate: round(certifiedToDate), thisBill: round(thisBill), balanceToComplete, percentComplete };
}

function notFound(msg = 'Progress bill not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }

export class ProgressBillService {
  private mapping: AccountMappingService;
  constructor(private prisma: PrismaClient) {
    this.mapping = new AccountMappingService(prisma);
  }

  private async defaultTaxRate(companyId: string): Promise<number> {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { salesConfig: true } });
    const code = (c?.salesConfig as any)?.DEFAULT_TAX_CODE ?? 'VAT5';
    const tc = await this.prisma.taxCode.findFirst({ where: { companyId, code }, select: { rate: true } });
    return tc ? Number(tc.rate) : 0;
  }

  // Certified-to-date per BOQ line = cumValue from the latest non-draft bill.
  private async previousCumulative(contractId: string, excludeBillId?: string): Promise<Map<string, { cumQty: number; cumValue: number }>> {
    const bills = await this.prisma.progressBill.findMany({
      where: { contractId, status: { in: ['SUBMITTED', 'CERTIFIED', 'POSTED'] }, id: excludeBillId ? { not: excludeBillId } : undefined },
      orderBy: { createdAt: 'asc' },
      include: { lines: true },
    });
    const map = new Map<string, { cumQty: number; cumValue: number }>();
    for (const b of bills) {
      for (const l of b.lines) map.set(l.boqLineId, { cumQty: Number(l.cumQty), cumValue: Number(l.cumValue) });
    }
    return map;
  }

  // Form data: BOQ lines with previous cumulative.
  async prepare(contractId: string, companyId: string) {
    const contract = await this.prisma.salesContract.findFirst({ where: { id: contractId, companyId }, include: { boqLines: { orderBy: { lineNo: 'asc' }, include: { uom: { select: { code: true } } } } } });
    if (!contract) throw Object.assign(new Error('Sales contract not found'), { statusCode: 404 });
    const prev = await this.previousCumulative(contractId);
    const lines = contract.boqLines.map((l) => {
      const p = prev.get(l.id) ?? { cumQty: 0, cumValue: 0 };
      return {
        boqLineId: l.id, section: l.section, itemDescription: l.itemDescription, uomCode: l.uom?.code,
        contractQty: Number(l.contractQty), rate: Number(l.rate), contractAmount: Number(l.contractAmount),
        previousCumQty: p.cumQty, previousValue: p.cumValue,
      };
    });
    return { contractId, docNo: contract.docNo, projectName: contract.projectName, contractValue: Number(contract.contractValue), lines };
  }

  async list(companyId: string, q: { search?: string; status?: string; contractId?: string; page?: number; limit?: number }) {
    const { search, status, contractId, page = 1, limit = 50 } = q;
    const where: Prisma.ProgressBillWhereInput = { companyId };
    if (status) where.status = status as any;
    if (contractId) where.contractId = contractId;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      this.prisma.progressBill.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { contract: { select: { projectName: true, docNo: true } } } }),
      this.prisma.progressBill.count({ where }),
    ]);
    const data = rows.map((r) => ({ id: r.id, docNo: r.docNo, contractId: r.contractId, projectName: r.contract?.projectName, contractDocNo: r.contract?.docNo, period: r.period, billDate: r.billDate, amount: Number(r.amount), taxAmount: Number(r.taxAmount), totalAmount: Number(r.totalAmount), status: r.status, createdAt: r.createdAt }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const b = await this.prisma.progressBill.findFirst({
      where: { id, companyId },
      include: { contract: { select: { id: true, docNo: true, projectName: true, contractValue: true, customerId: true } }, lines: { orderBy: { lineNo: 'asc' }, include: { boqLine: { select: { itemDescription: true, section: true, contractQty: true, rate: true } } } } },
    });
    if (!b) throw notFound();
    const lines = b.lines.map((l) => ({
      id: l.id, boqLineId: l.boqLineId, itemDescription: l.boqLine?.itemDescription, section: l.boqLine?.section,
      contractQty: l.boqLine ? Number(l.boqLine.contractQty) : 0, rate: l.boqLine ? Number(l.boqLine.rate) : 0,
      cumQty: Number(l.cumQty), cumValue: Number(l.cumValue), previousValue: Number(l.previousValue), thisValue: Number(l.thisValue), lineNo: l.lineNo,
    }));
    const certifiedToDate = lines.reduce((s, l) => s + l.cumValue, 0);
    const summary = progressSummary(Number(b.contract?.contractValue ?? 0), certifiedToDate, Number(b.amount));
    return { ...b, amount: Number(b.amount), taxAmount: Number(b.taxAmount), totalAmount: Number(b.totalAmount), lines, summary };
  }

  private async buildLines(companyId: string, contractId: string, lines: ProgressLineInput[], excludeBillId?: string) {
    const boq = await this.prisma.boqLine.findMany({ where: { contractId }, select: { id: true, itemDescription: true, contractQty: true, rate: true } });
    const boqMap = new Map(boq.map((l) => [l.id, l]));
    const prev = await this.previousCumulative(contractId, excludeBillId);
    let thisValueSum = 0;
    const built = lines.map((l, i) => {
      const bl = boqMap.get(l.boqLineId);
      if (!bl) throw Object.assign(new Error('BOQ line not found on this contract'), { statusCode: 422 });
      const previousValue = prev.get(l.boqLineId)?.cumValue ?? 0;
      const { cumValue, thisValue } = certifyLine(l.cumQty, previousValue, Number(bl.rate), Number(bl.contractQty), bl.itemDescription);
      thisValueSum += thisValue;
      return { boqLineId: l.boqLineId, cumQty: l.cumQty, cumValue, previousValue, thisValue, lineNo: i + 1 };
    });
    return { built, thisValueSum: round(thisValueSum) };
  }

  async create(input: CreateProgressBillInput, userId: string) {
    const { built, thisValueSum } = await this.buildLines(input.companyId, input.contractId, input.lines);
    const taxRate = await this.defaultTaxRate(input.companyId);
    const amounts = computeBillAmounts(thisValueSum, taxRate);
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'PBL');
    const bill = await this.prisma.progressBill.create({
      data: {
        companyId: input.companyId, docNo, contractId: input.contractId, period: input.period, billDate: toDate(input.billDate)!,
        amount: new Prisma.Decimal(amounts.amount), taxAmount: new Prisma.Decimal(amounts.taxAmount), totalAmount: new Prisma.Decimal(amounts.totalAmount),
        status: 'DRAFT', createdById: userId,
        lines: { createMany: { data: built.map((l) => ({ boqLineId: l.boqLineId, cumQty: new Prisma.Decimal(l.cumQty), cumValue: new Prisma.Decimal(l.cumValue), previousValue: new Prisma.Decimal(l.previousValue), thisValue: new Prisma.Decimal(l.thisValue), lineNo: l.lineNo })) } },
      },
    });
    await this.audit('CREATE', bill.id, userId, { docNo });
    return this.getById(bill.id, input.companyId);
  }

  async update(id: string, companyId: string, input: { period?: string; billDate?: string; lines?: ProgressLineInput[] }, userId: string) {
    const existing = await this.prisma.progressBill.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT bills can be edited'), { statusCode: 409 });
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.ProgressBillUpdateInput = { period: input.period, billDate: input.billDate ? toDate(input.billDate)! : undefined };
      if (input.lines !== undefined) {
        const { built, thisValueSum } = await this.buildLines(companyId, existing.contractId, input.lines, id);
        const taxRate = await this.defaultTaxRate(companyId);
        const amounts = computeBillAmounts(thisValueSum, taxRate);
        data.amount = new Prisma.Decimal(amounts.amount); data.taxAmount = new Prisma.Decimal(amounts.taxAmount); data.totalAmount = new Prisma.Decimal(amounts.totalAmount);
        await tx.progressBillLine.deleteMany({ where: { progressBillId: id } });
        await tx.progressBillLine.createMany({ data: built.map((l) => ({ progressBillId: id, boqLineId: l.boqLineId, cumQty: new Prisma.Decimal(l.cumQty), cumValue: new Prisma.Decimal(l.cumValue), previousValue: new Prisma.Decimal(l.previousValue), thisValue: new Prisma.Decimal(l.thisValue), lineNo: l.lineNo })) });
      }
      await tx.progressBill.update({ where: { id }, data });
    });
    await this.audit('UPDATE', id, userId, {});
    return this.getById(id, companyId);
  }

  async submit(id: string, companyId: string, userId: string) { return this.transition(id, companyId, userId, 'DRAFT', 'SUBMITTED'); }
  async certify(id: string, companyId: string, userId: string) {
    const b = await this.prisma.progressBill.findFirst({ where: { id, companyId } });
    if (!b) throw notFound();
    if (b.status !== 'SUBMITTED') throw Object.assign(new Error('Only SUBMITTED bills can be certified'), { statusCode: 409 });
    await this.prisma.progressBill.update({ where: { id }, data: { status: 'CERTIFIED', certifiedById: userId } });
    await this.audit('UPDATE', id, userId, { action: 'certify' });
    return this.getById(id, companyId);
  }

  private async transition(id: string, companyId: string, userId: string, from: string, to: string) {
    const b = await this.prisma.progressBill.findFirst({ where: { id, companyId } });
    if (!b) throw notFound();
    if (b.status !== from) throw Object.assign(new Error(`Bill must be ${from} to become ${to}`), { statusCode: 409 });
    await this.prisma.progressBill.update({ where: { id }, data: { status: to as any } });
    await this.audit('UPDATE', id, userId, { status: to });
    return this.getById(id, companyId);
  }

  // Post → ArInvoice + GL journal (Dr AR, Cr Contract Revenue, Cr VAT). No stock.
  async post(id: string, companyId: string, userId: string) {
    const bill = await this.getById(id, companyId);
    if (bill.status !== 'CERTIFIED') throw Object.assign(new Error('Only CERTIFIED bills can be posted'), { statusCode: 409 });
    const customerId = bill.contract?.customerId;
    if (!customerId) throw Object.assign(new Error('Contract has no customer'), { statusCode: 422 });

    const arAccount = await this.mapping.resolve(companyId, 'CUSTOMER_CONTROL');
    const revenueAccount = await this.mapping.resolve(companyId, 'CONTRACT_REVENUE');
    const vatAccount = bill.taxAmount > 0 ? await this.mapping.resolve(companyId, 'VAT_OUTPUT') : null;

    const jLines = buildInvoiceJournalLines({
      arAccount, revenueAccount, vatAccount, cogsAccount: null, inventoryAccount: null,
      netAmount: bill.amount, taxAmount: bill.taxAmount, totalAmount: bill.totalAmount, cogsTotal: 0,
    });

    const journal = await new JournalService(this.prisma).postJournal({
      companyId, entryDate: new Date(bill.billDate), description: `Progress bill: ${bill.docNo}`, lines: jLines, sourceModule: 'SALES', sourceDocId: bill.id, userId,
    });
    const arDocNo = await getNextDocNo(this.prisma, companyId, 'FINANCE', 'ARINV');

    await this.prisma.$transaction(async (tx) => {
      const ar = await tx.arInvoice.create({
        data: {
          companyId, docNo: arDocNo, customerId, description: `Progress bill ${bill.docNo} (${bill.period})`,
          invoiceDate: bill.billDate, dueDate: bill.billDate, amount: new Prisma.Decimal(bill.amount),
          taxAmount: new Prisma.Decimal(bill.taxAmount), totalAmount: new Prisma.Decimal(bill.totalAmount), status: 'POSTED', journalId: journal.id, createdById: userId,
        },
      });
      await tx.progressBill.update({ where: { id }, data: { status: 'POSTED', journalId: journal.id, arInvoiceId: ar.id } });
    });
    await this.audit('UPDATE', id, userId, { action: 'post' });
    return this.getById(id, companyId);
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'progress_bills', recordId, userId, action, newValues: values } });
  }
}
