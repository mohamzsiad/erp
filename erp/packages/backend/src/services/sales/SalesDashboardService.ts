import { PrismaClient } from '@prisma/client';

function round(n: number) { return Math.round(n * 100) / 100; }

export interface SalesKpis {
  orderBookValue: number;
  monthlySales: number;
  pipelineValue: number;
  deliveriesDue: number;
  overdueReceivables: number;
  openOrders: number;
  topCustomers: Array<{ customerId: string; name: string; total: number }>;
  salesTrend: Array<{ month: string; total: number }>;
}

export class SalesDashboardService {
  constructor(private prisma: PrismaClient) {}

  async getKpis(companyId: string): Promise<SalesKpis> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [openOrders, monthInvoices, pipelineQuotes, deliveriesDue, overdue, trendInvoices] = await Promise.all([
      this.prisma.salesOrder.findMany({ where: { companyId, status: { in: ['APPROVED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'CREDIT_HOLD'] } }, select: { totalAmount: true } }),
      this.prisma.salesInvoice.findMany({ where: { companyId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] }, invoiceDate: { gte: monthStart } }, select: { totalAmount: true } }),
      this.prisma.salesQuotation.findMany({ where: { companyId, status: { in: ['DRAFT', 'SENT'] } }, select: { totalAmount: true } }),
      this.prisma.deliveryNote.count({ where: { companyId, status: 'DRAFT' } }),
      this.prisma.arInvoice.findMany({ where: { companyId, status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lt: now } }, select: { totalAmount: true, paidAmount: true } }),
      this.prisma.salesInvoice.findMany({ where: { companyId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] }, invoiceDate: { gte: trendStart } }, select: { totalAmount: true, invoiceDate: true } }),
    ]);

    const orderBookValue = round(openOrders.reduce((s, o) => s + Number(o.totalAmount), 0));
    const monthlySales = round(monthInvoices.reduce((s, i) => s + Number(i.totalAmount), 0));
    const pipelineValue = round(pipelineQuotes.reduce((s, q) => s + Number(q.totalAmount), 0));
    const overdueReceivables = round(overdue.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0));

    // Sales trend — last 6 months
    const buckets = new Map<string, number>();
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.set(monthKey(d), 0); }
    for (const inv of trendInvoices) { const k = monthKey(new Date(inv.invoiceDate)); if (buckets.has(k)) buckets.set(k, buckets.get(k)! + Number(inv.totalAmount)); }
    const salesTrend = [...buckets.entries()].map(([month, total]) => ({ month, total: round(total) }));

    // Top customers by invoiced total
    const grouped = await this.prisma.salesInvoice.groupBy({ by: ['customerId'], where: { companyId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 5 });
    const custIds = grouped.map((g) => g.customerId);
    const custs = await this.prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } });
    const nameById = new Map(custs.map((c) => [c.id, c.name]));
    const topCustomers = grouped.map((g) => ({ customerId: g.customerId, name: nameById.get(g.customerId) ?? '', total: round(Number(g._sum.totalAmount ?? 0)) }));

    return { orderBookValue, monthlySales, pipelineValue, deliveriesDue, overdueReceivables, openOrders: openOrders.length, topCustomers, salesTrend };
  }
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
