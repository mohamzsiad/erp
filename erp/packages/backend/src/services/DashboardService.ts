import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Dashboard KPI Service
 * All KPI queries run in parallel via Promise.all — single API call returns everything.
 */
export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  async getKpis(companyId: string) {
    const now   = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ytdStart = new Date(now.getFullYear(), 0, 1);
    const lastMtdStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMtdEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      // 1. Total POs MTD + last month
      poMtd,
      poLastMtd,
      // 2. Pending approval value (open workflow docs)
      pendingApprovalCount,
      // 3. Stock value at avg cost (sum of stock_ledger qty * avg cost)
      stockValue,
      // 4. Overdue supplier invoices
      overdueAp,
      // 5. Budget utilization YTD
      budgetYtd,
      // 6. Avg PO lead time (days from PO created to first GRN)
      avgLeadTime,
      // 7. My-work pending document counts
      pendingMrl,
      pendingPrl,
      pendingPo,
      pendingApInvoice,
      unpostedJournals,
      pendingGrn,
      // 8. 360: top suppliers by PO value
      topSuppliers,
      // 9. 360: monthly purchase trend last 12 months
      monthlyPurchase,
    ] = await Promise.all([
      // 1a. PO count + value MTD
      this.prisma.purchaseOrder.aggregate({
        where: { companyId, createdAt: { gte: mtdStart } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // 1b. PO count + value last month
      this.prisma.purchaseOrder.aggregate({
        where: { companyId, createdAt: { gte: lastMtdStart, lte: lastMtdEnd } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // 2. Pending approval: count of MRLs/PRLs/POs awaiting action
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT (
          SELECT COUNT(*) FROM material_requisitions  WHERE "companyId"=${companyId} AND status='SUBMITTED'
        ) + (
          SELECT COUNT(*) FROM purchase_requisitions  WHERE "companyId"=${companyId} AND status='DRAFT'
        ) + (
          SELECT COUNT(*) FROM purchase_orders        WHERE "companyId"=${companyId} AND status='SUBMITTED'
        ) + (
          SELECT COUNT(*) FROM ap_invoices            WHERE "companyId"=${companyId} AND status='DRAFT'
        ) AS cnt
      `,
      // 3. Stock value — sum of (current_qty * avg_cost) from inventory_balance or stock_ledger
      this.prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM("qtyOnHand" * "avgCost"), 0)::text AS total
        FROM item_stock_balances
        WHERE "companyId" = ${companyId}
          AND "qtyOnHand" > 0
      `.catch(() => [{ total: '0' }]),
      // 4. Overdue AP invoices (due_date < today, status APPROVED or PARTIAL)
      this.prisma.apInvoice.aggregate({
        where: {
          companyId,
          status: { in: ['APPROVED', 'PARTIAL'] },
          dueDate: { lt: now },
        },
        _count: true,
        _sum: { totalAmount: true, paidAmount: true },
      }),
      // 5. Budget YTD: sum of budgeted vs actual
      this.prisma.budgetPeriod.aggregate({
        where: {
          budget: { companyId },
          periodYear: now.getFullYear(),
          periodMonth: { gte: 1, lte: now.getMonth() + 1 },
        },
        _sum: { budgetedAmount: true, actualAmount: true },
      }),
      // 6. Avg lead time: avg days from PO created to first GRN
      this.prisma.$queryRaw<{ avg_days: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (g."createdAt" - po."createdAt")) / 86400)::float AS avg_days
        FROM purchase_orders po
        JOIN grn_headers g ON g."poId" = po.id
        WHERE po."companyId" = ${companyId}
          AND po."createdAt" >= ${new Date(Date.now() - 90 * 86400000)}
      `.catch(() => [{ avg_days: null }]),
      // 7a. Pending MRLs
      this.prisma.materialRequisition.count({ where: { companyId, status: 'SUBMITTED' } }),
      // 7b. Pending PRLs
      this.prisma.purchaseRequisition.count({ where: { companyId, status: 'DRAFT' } }),
      // 7c. Open POs (not fully received)
      this.prisma.purchaseOrder.count({ where: { companyId, status: { in: ['APPROVED', 'PARTIAL'] } } }),
      // 7d. Pending AP invoices
      this.prisma.apInvoice.count({ where: { companyId, status: 'DRAFT' } }),
      // 7e. Unposted journals
      this.prisma.journalEntry.count({ where: { companyId, status: 'DRAFT' } }),
      // 7f. Pending GRNs (received but not posted — status DRAFT)
      this.prisma.grnHeader.count({ where: { companyId, status: 'DRAFT' } }).catch(() => 0),
      // 8. Top 10 suppliers by PO value YTD
      this.prisma.$queryRaw<{ supplier_name: string; total_value: string }[]>`
        SELECT s.name AS supplier_name,
               SUM(po."totalAmount")::text AS total_value
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po."supplierId"
        WHERE po."companyId" = ${companyId}
          AND po."createdAt" >= ${ytdStart}
          AND po.status NOT IN ('CANCELLED', 'DRAFT')
        GROUP BY s.id, s.name
        ORDER BY SUM(po."totalAmount") DESC
        LIMIT 10
      `.catch(() => []),
      // 9. Monthly purchase trend (last 12 months)
      this.prisma.$queryRaw<{ month: string; total: string }[]>`
        SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') AS month,
               SUM("totalAmount")::text AS total
        FROM purchase_orders
        WHERE "companyId" = ${companyId}
          AND "createdAt" >= ${new Date(Date.now() - 365 * 86400000)}
          AND status NOT IN ('CANCELLED', 'DRAFT')
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt")
      `.catch(() => []),
    ]);

    // Compute overdue outstanding
    const overdueTotal = Math.max(0,
      Number(overdueAp._sum.totalAmount ?? 0) -
      Number(overdueAp._sum.paidAmount  ?? 0)
    );

    // Budget utilization %
    const budgeted = Number(budgetYtd._sum.budgetedAmount ?? 0);
    const actual   = Number(budgetYtd._sum.actualAmount   ?? 0);
    const budgetPct = budgeted > 0 ? (actual / budgeted) * 100 : 0;

    // PO trend
    const poMtdValue      = Number(poMtd._sum.totalAmount      ?? 0);
    const poLastMtdValue  = Number(poLastMtd._sum.totalAmount  ?? 0);
    const poTrend = poLastMtdValue > 0
      ? ((poMtdValue - poLastMtdValue) / poLastMtdValue) * 100
      : 0;

    return {
      kpis: {
        totalPoMtd: {
          count: poMtd._count,
          value: poMtdValue,
          trendPct: poTrend,
        },
        pendingApproval: {
          count: Number((pendingApprovalCount[0] as any)?.cnt ?? 0),
        },
        stockValue: {
          value: Number((stockValue as any)[0]?.total ?? 0),
        },
        overdueSupplierInvoices: {
          count: overdueAp._count,
          total: overdueTotal,
        },
        budgetUtilization: {
          budgeted,
          actual,
          pct: Math.round(budgetPct * 10) / 10,
        },
        avgPoLeadTimeDays: {
          days: Math.round((((avgLeadTime as any)[0]?.avg_days ?? 0)) * 10) / 10,
        },
      },
      workSummary: {
        pendingMrl,
        pendingPrl,
        openPos: pendingPo,
        pendingApInvoice,
        unpostedJournals,
        pendingGrn: Number(pendingGrn),
      },
      charts: {
        topSuppliers: (topSuppliers as any[]).map((r) => ({
          name:  r.supplier_name,
          value: Number(r.total_value),
        })),
        monthlyPurchase: (monthlyPurchase as any[]).map((r) => ({
          month: r.month,
          value: Number(r.total),
        })),
      },
    };
  }

  /** Workflow tasks for "My Work" tab */
  async getWorkflowTasks(userId: string, companyId: string) {
    // Reuse WorkflowService logic inline to avoid circular imports
    const tasks: any[] = [];

    // Pull each doc type in parallel
    const [mrls, prls, pos] = await Promise.all([
      this.prisma.materialRequisition.findMany({
        where: { companyId, status: 'SUBMITTED' },
        select: { id: true, docNo: true, deliveryDate: true, createdById: true, location: { select: { name: true } } },
        orderBy: { deliveryDate: 'asc' },
        take: 30,
      }),
      this.prisma.purchaseRequisition.findMany({
        where: { companyId, status: 'DRAFT' },
        select: { id: true, docNo: true, deliveryDate: true, createdById: true, location: { select: { name: true } } },
        orderBy: { deliveryDate: 'asc' },
        take: 30,
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId, status: 'SUBMITTED' },
        select: { id: true, docNo: true, docDate: true, createdById: true, supplier: { select: { name: true } } },
        orderBy: { docDate: 'asc' },
        take: 30,
      }),
    ]);

    const daysPending = (d: Date) =>
      Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

    const priorityOf = (days: number) =>
      days > 5 ? 'high' : days > 2 ? 'medium' : 'low';

    for (const m of mrls) {
      const days = daysPending((m as any).deliveryDate);
      tasks.push({
        id: m.id, docType: 'MRL', docNo: m.docNo,
        description: `Material Requisition — ${(m as any).location?.name ?? ''}`,
        requestedBy: '—',
        daysPending: days, priority: priorityOf(days), status: 'PENDING_APPROVAL',
        path: `/procurement/mrl/${m.id}`,
      });
    }
    for (const p of prls) {
      const days = daysPending((p as any).deliveryDate);
      tasks.push({
        id: p.id, docType: 'PRL', docNo: p.docNo,
        description: `Purchase Requisition — ${(p as any).location?.name ?? ''}`,
        requestedBy: '—',
        daysPending: days, priority: priorityOf(days), status: 'PENDING_APPROVAL',
        path: `/procurement/prl/${p.id}`,
      });
    }
    for (const po of pos) {
      const days = daysPending((po as any).docDate);
      tasks.push({
        id: po.id, docType: 'PO', docNo: po.docNo,
        description: `Purchase Order — ${(po as any).supplier?.name ?? ''}`,
        requestedBy: '—',
        daysPending: days, priority: priorityOf(days), status: 'PENDING_APPROVAL',
        path: `/procurement/po/${po.id}`,
      });
    }

    return tasks.sort((a, b) => b.daysPending - a.daysPending);
  }
}
