import { PrismaClient } from '@prisma/client';

// ── Pure, unit-testable helpers ───────────────────────────────────────────────
export type AgeingBucketKey = 'current' | 'd30' | 'd60' | 'd90' | 'over90';

export function ageingBucket(daysOverdue: number): AgeingBucketKey {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'd30';
  if (daysOverdue <= 60) return 'd60';
  if (daysOverdue <= 90) return 'd90';
  return 'over90';
}

export interface AgeingRow { entityId: string; entityName: string; current: number; d30: number; d60: number; d90: number; over90: number; total: number; }

export function buildAgeing(
  invoices: Array<{ customerId: string; customerName: string; totalAmount: number; paidAmount: number; dueDate: Date }>,
  asOf: Date,
): AgeingRow[] {
  const byCust = new Map<string, AgeingRow>();
  for (const inv of invoices) {
    const bal = round(inv.totalAmount - inv.paidAmount);
    if (bal <= 0) continue;
    const days = Math.floor((asOf.getTime() - inv.dueDate.getTime()) / 86_400_000);
    const bucket = ageingBucket(days);
    let row = byCust.get(inv.customerId);
    if (!row) { row = { entityId: inv.customerId, entityName: inv.customerName, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 }; byCust.set(inv.customerId, row); }
    (row as any)[bucket] = round((row as any)[bucket] + bal);
    row.total = round(row.total + bal);
  }
  return [...byCust.values()];
}

export function conversionRate(won: number, total: number): number {
  return total > 0 ? round((won / total) * 100) : 0;
}

function round(n: number) { return Math.round(n * 1000) / 1000; }

// ── Report service ────────────────────────────────────────────────────────────
export class SalesReportService {
  constructor(private prisma: PrismaClient) {}

  // Pipeline — enquiries + quotations by stage/value.
  async pipeline(companyId: string) {
    const [enq, quo] = await Promise.all([
      this.prisma.salesEnquiry.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
      this.prisma.salesQuotation.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true }, _sum: { totalAmount: true } }),
    ]);
    const enquiries = enq.map((e) => ({ status: e.status, count: e._count._all }));
    const quotations = quo.map((q) => ({ status: q.status, count: q._count._all, value: Number(q._sum.totalAmount ?? 0) }));
    const totalQuotes = quotations.reduce((s, q) => s + q.count, 0);
    const accepted = quotations.find((q) => q.status === 'ACCEPTED')?.count ?? 0;
    return { enquiries, quotations, pipelineValue: round(quotations.filter((q) => ['DRAFT', 'SENT'].includes(q.status)).reduce((s, q) => s + q.value, 0)), conversionRate: conversionRate(accepted, totalQuotes) };
  }

  // Order book — open (uninvoiced/undelivered) orders + backlog value.
  async orderBook(companyId: string) {
    const orders = await this.prisma.salesOrder.findMany({
      where: { companyId, status: { in: ['APPROVED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'CREDIT_HOLD'] } },
      include: { customer: { select: { name: true } } },
      orderBy: { orderDate: 'asc' },
    });
    const rows = orders.map((o) => ({ id: o.id, docNo: o.docNo, customerName: o.customer?.name, orderDate: o.orderDate, status: o.status, totalAmount: Number(o.totalAmount) }));
    return { rows, backlogValue: round(rows.reduce((s, r) => s + r.totalAmount, 0)), count: rows.length };
  }

  // Sales register — posted invoices in a date range.
  async salesRegister(companyId: string, opts: { dateFrom?: string; dateTo?: string } = {}) {
    const where: any = { companyId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } };
    if (opts.dateFrom || opts.dateTo) where.invoiceDate = { gte: opts.dateFrom ? new Date(opts.dateFrom) : undefined, lte: opts.dateTo ? new Date(opts.dateTo) : undefined };
    const invoices = await this.prisma.salesInvoice.findMany({ where, include: { customer: { select: { name: true } } }, orderBy: { invoiceDate: 'asc' } });
    const rows = invoices.map((i) => ({ id: i.id, docNo: i.docNo, invoiceDate: i.invoiceDate, customerName: i.customer?.name, amount: Number(i.amount), taxAmount: Number(i.taxAmount), totalAmount: Number(i.totalAmount) }));
    return { rows, totals: { net: round(rows.reduce((s, r) => s + r.amount, 0)), tax: round(rows.reduce((s, r) => s + r.taxAmount, 0)), total: round(rows.reduce((s, r) => s + r.totalAmount, 0)) } };
  }

  // VAT / output-tax report by period.
  async vatReport(companyId: string, opts: { dateFrom?: string; dateTo?: string } = {}) {
    const reg = await this.salesRegister(companyId, opts);
    return { outputTax: reg.totals.tax, taxableAmount: reg.totals.net, lineCount: reg.rows.length, rows: reg.rows.filter((r) => r.taxAmount > 0) };
  }

  // Customer ageing (from AR invoices).
  async customerAgeing(companyId: string) {
    const invoices = await this.prisma.arInvoice.findMany({
      where: { companyId, status: { notIn: ['PAID', 'CANCELLED'] } },
      include: { customer: { select: { name: true } } },
    });
    const mapped = invoices.map((i) => ({ customerId: i.customerId, customerName: i.customer?.name ?? '', totalAmount: Number(i.totalAmount), paidAmount: Number(i.paidAmount), dueDate: i.dueDate }));
    const rows = buildAgeing(mapped, new Date());
    const totals = rows.reduce((t, r) => ({ current: t.current + r.current, d30: t.d30 + r.d30, d60: t.d60 + r.d60, d90: t.d90 + r.d90, over90: t.over90 + r.over90, total: t.total + r.total }), { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 });
    return { rows, totals };
  }

  // BOQ progress across contracts.
  async boqProgress(companyId: string) {
    const contracts = await this.prisma.salesContract.findMany({
      where: { companyId, status: { in: ['ACTIVE', 'CLOSED'] } },
      include: { customer: { select: { name: true } }, progressBills: { where: { status: { in: ['CERTIFIED', 'POSTED'] } }, include: { lines: true } } },
    });
    const rows = contracts.map((c) => {
      // certified-to-date = sum of each certified/posted bill's this-period value
      const certifiedToDate = c.progressBills.reduce((s, b) => s + b.lines.reduce((ls, l) => ls + Number(l.thisValue), 0), 0);
      const cv = Number(c.contractValue);
      return { id: c.id, docNo: c.docNo, projectName: c.projectName, customerName: c.customer?.name, contractValue: cv, certifiedToDate: round(certifiedToDate), balance: round(cv - certifiedToDate), percentComplete: cv > 0 ? round((certifiedToDate / cv) * 100) : 0 };
    });
    return { rows };
  }
}
