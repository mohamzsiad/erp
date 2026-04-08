/**
 * StockSummaryService
 *
 * High-level reporting queries for the Inventory module:
 *   - Overall stock value by warehouse
 *   - Dead stock (no movement in N days)
 *   - Slow-moving / inactive stock
 *   - Obsolete stock (items with OBSOLETE status still having qty on hand)
 *   - Pending documents (unposted GRN, Issue, Transfer, Adjustment)
 *   - Reorder alerts (qty on hand ≤ reorder level)
 */

import { PrismaClient } from '@prisma/client';

export class StockSummaryService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Overall stock value summary ───────────────────────────────────────────────
  async getOverallSummary(companyId: string) {
    const balances = await this.prisma.stockBalance.findMany({
      where: { companyId },
      include: {
        item:      { select: { id: true, code: true, description: true, status: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    const totalItems    = new Set(balances.map((b) => b.itemId)).size;
    const totalValue    = balances.reduce((s, b) => s + Number(b.qtyOnHand) * Number(b.avgCost), 0);
    const totalQty      = balances.reduce((s, b) => s + Number(b.qtyOnHand), 0);

    // Group by warehouse
    const byWarehouse: Record<string, {
      warehouseId: string; warehouseCode: string; warehouseName: string;
      totalItems: number; totalQtyOnHand: number; totalStockValue: number;
    }> = {};

    for (const b of balances) {
      const wId = b.warehouseId;
      if (!byWarehouse[wId]) {
        byWarehouse[wId] = {
          warehouseId:   wId,
          warehouseCode: b.warehouse.code,
          warehouseName: b.warehouse.name,
          totalItems:    0,
          totalQtyOnHand: 0,
          totalStockValue: 0,
        };
      }
      byWarehouse[wId].totalItems++;
      byWarehouse[wId].totalQtyOnHand  += Number(b.qtyOnHand);
      byWarehouse[wId].totalStockValue += Number(b.qtyOnHand) * Number(b.avgCost);
    }

    return {
      totalItems,
      totalQtyOnHand: totalQty,
      totalStockValue: totalValue,
      byWarehouse: Object.values(byWarehouse),
    };
  }

  // ── Dead stock: no movement in the last N days ────────────────────────────────
  async getDeadStock(companyId: string, noMovementDays = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - noMovementDays);

    // Find items with positive stock but no movement since cutoff
    const balances = await this.prisma.stockBalance.findMany({
      where: { companyId, qtyOnHand: { gt: 0 } },
      include: {
        item:      { select: { id: true, code: true, description: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        bin:       { select: { id: true, code: true } },
      },
    });

    const results = [];

    for (const b of balances) {
      const lastMovement = await this.prisma.stockMovement.findFirst({
        where: {
          companyId,
          itemId:      b.itemId,
          warehouseId: b.warehouseId,
          ...(b.binId && { binId: b.binId }),
        },
        orderBy: { createdAt: 'desc' },
        select:  { createdAt: true },
      });

      const lastMoveDate = lastMovement?.createdAt ?? null;
      if (!lastMoveDate || lastMoveDate < cutoff) {
        results.push({
          itemId:          b.itemId,
          itemCode:        b.item.code,
          description:     b.item.description,
          warehouseId:     b.warehouseId,
          warehouseCode:   b.warehouse.code,
          warehouseName:   b.warehouse.name,
          binCode:         b.bin?.code ?? null,
          qtyOnHand:       Number(b.qtyOnHand),
          avgCost:         Number(b.avgCost),
          stockValue:      Number(b.qtyOnHand) * Number(b.avgCost),
          lastMovementDate: lastMoveDate,
          daysSinceMovement: lastMoveDate
            ? Math.floor((Date.now() - lastMoveDate.getTime()) / 86_400_000)
            : null,
        });
      }
    }

    results.sort((a, b) =>
      (b.daysSinceMovement ?? Infinity) - (a.daysSinceMovement ?? Infinity),
    );

    const totalValue = results.reduce((s, r) => s + r.stockValue, 0);
    return { noMovementDays, totalLines: results.length, totalValue, lines: results };
  }

  // ── Obsolete stock: items marked OBSOLETE but still have qty on hand ──────────
  async getObsoleteStock(companyId: string) {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId,
        qtyOnHand: { gt: 0 },
        item:      { status: 'OBSOLETE' },
      },
      include: {
        item:      { select: { id: true, code: true, description: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        bin:       { select: { id: true, code: true } },
      },
    });

    const lines = balances.map((b) => ({
      itemId:        b.itemId,
      itemCode:      b.item.code,
      description:   b.item.description,
      warehouseId:   b.warehouseId,
      warehouseCode: b.warehouse.code,
      warehouseName: b.warehouse.name,
      binCode:       b.bin?.code ?? null,
      qtyOnHand:     Number(b.qtyOnHand),
      avgCost:       Number(b.avgCost),
      stockValue:    Number(b.qtyOnHand) * Number(b.avgCost),
    }));

    const totalValue = lines.reduce((s, l) => s + l.stockValue, 0);
    return { totalLines: lines.length, totalValue, lines };
  }

  // ── Pending documents ─────────────────────────────────────────────────────────
  async getPendingDocuments(companyId: string) {
    const [grns, issues, transfers, adjustments, physCounts] = await Promise.all([
      this.prisma.grnHeader.count({ where: { companyId, status: 'DRAFT' } }),
      this.prisma.stockIssue.count({ where: { companyId, status: 'DRAFT' } }),
      this.prisma.stockTransfer.count({ where: { companyId, status: 'DRAFT' } }),
      this.prisma.stockAdjustment.count({
        where: { companyId, status: { in: ['DRAFT', 'SUBMITTED'] } },
      }),
      // Physical counts are StockAdjustments with PHYS_COUNT reason
      this.prisma.adjustmentReason.findFirst({ where: { companyId, code: 'PHYS_COUNT' } }).then(
        (reason) => reason
          ? this.prisma.stockAdjustment.count({
              where: { companyId, reasonId: reason.id, status: { in: ['DRAFT', 'SUBMITTED'] } },
            })
          : 0,
      ),
    ]);

    return {
      draftGrns:          grns,
      draftIssues:        issues,
      draftTransfers:     transfers,
      pendingAdjustments: adjustments,
      activePhysCount:    physCounts,
      total:              grns + issues + transfers + adjustments + physCounts,
    };
  }

  // ── Reorder alerts ────────────────────────────────────────────────────────────
  async getReorderAlerts(companyId: string) {
    const items = await this.prisma.item.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        reorderLevel: { gt: 0 },
      },
      include: {
        stockBalances: {
          where: { companyId },
          select: { qtyOnHand: true, qtyReserved: true },
        },
      },
    });

    const alerts = items
      .map((item) => {
        const totalQty = item.stockBalances.reduce(
          (s, b) => s + Number(b.qtyOnHand), 0,
        );
        const totalReserved = item.stockBalances.reduce(
          (s, b) => s + Number(b.qtyReserved), 0,
        );
        const available    = totalQty - totalReserved;
        const reorderLevel = Number(item.reorderLevel);
        return {
          itemId:         item.id,
          itemCode:       item.code,
          description:    item.description,
          reorderLevel,
          reorderQty:     Number(item.reorderQty ?? 0),
          qtyOnHand:      totalQty,
          qtyReserved:    totalReserved,
          qtyAvailable:   available,
          shortage:       reorderLevel - totalQty,
          leadTimeDays:   item.leadTimeDays ?? 0,
        };
      })
      .filter((a) => a.qtyOnHand <= a.reorderLevel)
      .sort((a, b) => b.shortage - a.shortage);

    return { totalAlerts: alerts.length, alerts };
  }

  // ── Stock aging: values distributed into age buckets ─────────────────────────
  async getStockAging(companyId: string) {
    const buckets = [
      { label: '0-30 days',   minDays: 0,   maxDays: 30  },
      { label: '31-60 days',  minDays: 31,  maxDays: 60  },
      { label: '61-90 days',  minDays: 61,  maxDays: 90  },
      { label: '91-180 days', minDays: 91,  maxDays: 180 },
      { label: '180+ days',   minDays: 181, maxDays: null },
    ];

    const now = Date.now();

    const balances = await this.prisma.stockBalance.findMany({
      where: { companyId, qtyOnHand: { gt: 0 } },
    });

    const result = await Promise.all(
      buckets.map(async (bucket) => {
        let totalValue = 0;
        let totalLines = 0;

        for (const b of balances) {
          const last = await this.prisma.stockMovement.findFirst({
            where: {
              companyId,
              itemId:      b.itemId,
              warehouseId: b.warehouseId,
              qty:         { gt: 0 }, // only inbound movements
            },
            orderBy: { createdAt: 'desc' },
            select:  { createdAt: true },
          });

          const age = last?.createdAt
            ? Math.floor((now - last.createdAt.getTime()) / 86_400_000)
            : 9999;

          const minOk = age >= bucket.minDays;
          const maxOk = bucket.maxDays === null || age <= bucket.maxDays;

          if (minOk && maxOk) {
            totalValue += Number(b.qtyOnHand) * Number(b.avgCost);
            totalLines++;
          }
        }

        return { ...bucket, totalLines, totalValue };
      }),
    );

    return { buckets: result };
  }
}
