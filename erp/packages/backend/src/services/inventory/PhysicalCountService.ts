/**
 * PhysicalCountService
 *
 * Physical Count is implemented on top of the StockAdjustment model:
 *   - Initiating a count creates a DRAFT StockAdjustment with systemQty = current qtyOnHand
 *   - Entering counts updates physicalQty on each line
 *   - The variance report compares system vs physical
 *   - Posting applies the variances via AdjustmentService
 *
 * A special AdjustmentReason with code 'PHYS_COUNT' is created automatically.
 */

import { PrismaClient } from '@prisma/client';
import { StockEngine } from './StockEngine.js';
import { getNextDocNo } from '../../utils/DocNumberService.js';

export class PhysicalCountService {
  private readonly stockEngine: StockEngine;

  constructor(private readonly prisma: PrismaClient) {
    this.stockEngine = new StockEngine(prisma);
  }

  // ── Initiate a count — creates draft SA with all warehouse items ──────────────
  async initiate(params: {
    warehouseId: string;
    docDate: string;
    remarks?: string;
    companyId: string;
    userId: string;
  }) {
    const { warehouseId, docDate, remarks, companyId, userId } = params;

    const wh = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });

    // Ensure physical-count reason exists
    const reason = await this.ensurePhysCountReason(companyId);

    // Check no active count for this warehouse
    const active = await this.prisma.stockAdjustment.findFirst({
      where: {
        companyId,
        warehouseId,
        reasonId: reason.id,
        status: { in: ['DRAFT', 'SUBMITTED'] },
      },
    });
    if (active) {
      throw Object.assign(
        new Error(`Active physical count already in progress: ${active.docNo}`),
        { statusCode: 409 },
      );
    }

    // Snapshot current stock balances (frozen at this point)
    const balances = await this.stockEngine.snapshotWarehouseBalances(warehouseId, companyId);

    const docNo = await getNextDocNo(this.prisma, companyId, 'INVENTORY', 'SA');

    const doc = await this.prisma.stockAdjustment.create({
      data: {
        companyId,
        docNo,
        docDate:     new Date(docDate),
        warehouseId,
        reasonId:    reason.id,
        status:      'DRAFT',
        createdById: userId,
        lines: {
          create: balances
            .filter((b) => Number(b.qtyOnHand) > 0)
            .map((b, idx) => ({
              itemId:      b.itemId,
              binId:       b.binId,
              systemQty:   Number(b.qtyOnHand),
              physicalQty: Number(b.qtyOnHand), // default = no variance; user will update
              varianceQty: 0,
              uomId:       b.item.uomId,
              avgCost:     Number(b.avgCost),
              lineNo:      idx + 1,
            })),
        },
      },
      include: {
        warehouse: true,
        reason:    true,
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            item: { select: { id: true, code: true, description: true } },
            bin:  { select: { id: true, code: true } },
            uom:  { select: { code: true, symbol: true } },
          },
        },
      },
    });

    return doc;
  }

  // ── Enter physical counts (batch update) ─────────────────────────────────────
  async enterCounts(
    id: string,
    companyId: string,
    counts: Array<{ lineId: string; physicalQty: number }>,
  ) {
    const doc = await this.getById(id, companyId);
    if (doc.status !== 'DRAFT') {
      throw Object.assign(new Error('Counts can only be entered for DRAFT physical counts'), { statusCode: 422 });
    }

    await this.prisma.$transaction(
      counts.map((c) =>
        this.prisma.stockAdjustmentLine.update({
          where: { id: c.lineId },
          data: {
            physicalQty: c.physicalQty,
            varianceQty: { set: 0 }, // computed below
          },
        }),
      ),
    );

    // Recompute varianceQty for all updated lines
    for (const c of counts) {
      const line = await this.prisma.stockAdjustmentLine.findUnique({ where: { id: c.lineId } });
      if (line) {
        await this.prisma.stockAdjustmentLine.update({
          where: { id: c.lineId },
          data: { varianceQty: c.physicalQty - Number(line.systemQty) },
        });
      }
    }

    return this.getById(id, companyId);
  }

  // ── Variance report ───────────────────────────────────────────────────────────
  async getVariance(id: string, companyId: string) {
    const doc = await this.getById(id, companyId);

    const lines = doc.lines.map((l: any) => {
      const system   = Number(l.systemQty);
      const physical = Number(l.physicalQty);
      const variance = Number(l.varianceQty);
      const avgCost  = Number(l.avgCost);
      return {
        lineId:         l.id,
        itemId:         l.itemId,
        itemCode:       l.item?.code ?? '',
        description:    l.item?.description ?? '',
        binCode:        l.bin?.code ?? null,
        uomCode:        l.uom?.code ?? '',
        systemQty:      system,
        physicalQty:    physical,
        varianceQty:    variance,
        variancePct:    system > 0 ? (variance / system) * 100 : 0,
        avgCost,
        varianceValue:  variance * avgCost,
      };
    });

    const summary = {
      totalLines:          lines.length,
      linesWithVariance:   lines.filter((l: any) => l.varianceQty !== 0).length,
      totalVarianceValue:  lines.reduce((s: number, l: any) => s + l.varianceValue, 0),
      positiveVarianceVal: lines.filter((l: any) => l.varianceQty > 0).reduce((s: number, l: any) => s + l.varianceValue, 0),
      negativeVarianceVal: lines.filter((l: any) => l.varianceQty < 0).reduce((s: number, l: any) => s + l.varianceValue, 0),
    };

    return { docNo: doc.docNo, docDate: doc.docDate, status: doc.status, summary, lines };
  }

  // ── Post the count — applies all variances as stock adjustments ───────────────
  async post(id: string, companyId: string, userId: string) {
    const doc = await this.getById(id, companyId);
    if (doc.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT physical counts can be posted'), { statusCode: 422 });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of doc.lines as any[]) {
        const variance = Number(line.varianceQty);
        if (variance === 0) continue;

        const avgCost = Number(line.avgCost);

        await tx.stockAdjustmentLine.update({
          where: { id: line.id },
          data: { avgCost },
        });

        await this.stockEngine.updateStock({
          itemId:          line.itemId,
          warehouseId:     doc.warehouseId,
          binId:           line.binId,
          qty:             variance,
          avgCost,
          transactionType: 'ADJUSTMENT',
          sourceDocId:     doc.id,
          sourceDocNo:     doc.docNo,
          userId,
          companyId,
        });
      }

      await tx.stockAdjustment.update({
        where: { id },
        data: { status: 'POSTED', approvedById: userId },
      });
    });

    return this.getById(id, companyId);
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const doc = await this.prisma.stockAdjustment.findFirst({
      where: { id, companyId },
      include: {
        warehouse: true,
        reason:    true,
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            item: { select: { id: true, code: true, description: true } },
            bin:  { select: { id: true, code: true } },
            uom:  { select: { code: true, symbol: true } },
          },
        },
      },
    });
    if (!doc) throw Object.assign(new Error('Physical count not found'), { statusCode: 404 });
    return doc;
  }

  // ── List all physical counts ──────────────────────────────────────────────────
  async list(query: {
    companyId: string; page?: number; limit?: number;
    status?: string; warehouseId?: string;
  }) {
    const reason = await this.ensurePhysCountReason(query.companyId);
    const { companyId, page = 1, limit = 50, status, warehouseId } = query;

    const where: any = {
      companyId,
      reasonId: reason.id,
      ...(status      && { status }),
      ...(warehouseId && { warehouseId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse:  { select: { id: true, code: true, name: true } },
          _count:     { select: { lines: true } },
        },
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Cancel ────────────────────────────────────────────────────────────────────
  async cancel(id: string, companyId: string) {
    const doc = await this.getById(id, companyId);
    if (doc.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT counts can be cancelled'), { statusCode: 422 });
    }
    return this.prisma.stockAdjustment.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ── Ensure physical-count reason exists ───────────────────────────────────────
  private async ensurePhysCountReason(companyId: string) {
    let reason = await this.prisma.adjustmentReason.findFirst({
      where: { companyId, code: 'PHYS_COUNT' },
    });
    if (!reason) {
      reason = await this.prisma.adjustmentReason.create({
        data: { companyId, code: 'PHYS_COUNT', name: 'Physical Count' },
      });
    }
    return reason;
  }
}
