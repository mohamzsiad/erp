/**
 * InventoryReportService — 7 report queries for the Inventory module
 */
import { PrismaClient } from '@prisma/client';

export interface InvReportFilters {
  companyId: string;
  dateFrom?:       string;
  dateTo?:         string;
  asOfDate?:       string;
  itemId?:         string;
  warehouseId?:    string;
  categoryId?:     string;
  supplierId?:     string;
  noMovementDays?: number;
}

function toDateGte(s?: string): Date | undefined { return s ? new Date(s) : undefined; }
function toDateLte(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s); d.setHours(23, 59, 59, 999); return d;
}

// ─────────────────────────────────────────────────────────────────────────────
export class InventoryReportService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── 1. Stock Balance as of date ────────────────────────────────────────────
  async getStockBalance(f: InvReportFilters) {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId:   f.companyId,
        ...(f.warehouseId && { warehouseId: f.warehouseId }),
        ...(f.itemId      && { itemId:      f.itemId      }),
        ...(f.categoryId  && { item: { categoryId: f.categoryId } }),
      },
      include: {
        item:      { include: { category: true, uom: true } },
        warehouse: true,
        bin:       true,
      },
      orderBy: [{ item: { code: 'asc' } }, { warehouse: { code: 'asc' } }],
    });

    return balances.map((b) => ({
      itemCode:      b.item.code,
      description:   b.item.description,
      category:      b.item.category?.name ?? '',
      uom:           b.item.uom?.code ?? '',
      warehouseCode: b.warehouse.code,
      warehouseName: b.warehouse.name,
      binCode:       b.bin?.code ?? '',
      qtyOnHand:     Number(b.qtyOnHand),
      qtyReserved:   Number(b.qtyReserved),
      qtyAvailable:  Number(b.qtyOnHand) - Number(b.qtyReserved),
      avgCost:       Number(b.avgCost),
      stockValue:    Number(b.qtyOnHand) * Number(b.avgCost),
      status:        b.item.status,
    }));
  }

  // ── 2. Stock Aging ─────────────────────────────────────────────────────────
  async getStockAging(f: InvReportFilters) {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId:  f.companyId,
        qtyOnHand:  { gt: 0 },
        ...(f.warehouseId && { warehouseId: f.warehouseId }),
        ...(f.categoryId  && { item: { categoryId: f.categoryId } }),
        ...(f.itemId      && { itemId: f.itemId }),
      },
      include: {
        item:      { include: { category: true, uom: true } },
        warehouse: true,
        bin:       true,
      },
    });

    const now = Date.now();

    const rows = await Promise.all(
      balances.map(async (b) => {
        const last = await this.prisma.stockMovement.findFirst({
          where: {
            companyId:   f.companyId,
            itemId:      b.itemId,
            warehouseId: b.warehouseId,
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const ageDays = last?.createdAt
          ? Math.floor((now - last.createdAt.getTime()) / 86_400_000)
          : 9999;

        const bucket =
          ageDays <= 30  ? '0-30 days'   :
          ageDays <= 60  ? '31-60 days'  :
          ageDays <= 90  ? '61-90 days'  :
          ageDays <= 180 ? '91-180 days' :
          ageDays <= 365 ? '181-365 days': '365+ days';

        return {
          itemCode:       b.item.code,
          description:    b.item.description,
          category:       b.item.category?.name ?? '',
          uom:            b.item.uom?.code ?? '',
          warehouseCode:  b.warehouse.code,
          binCode:        b.bin?.code ?? '',
          qtyOnHand:      Number(b.qtyOnHand),
          avgCost:        Number(b.avgCost),
          stockValue:     Number(b.qtyOnHand) * Number(b.avgCost),
          lastMovement:   last?.createdAt ?? null,
          ageDays,
          ageBucket:      bucket,
          status:         b.item.status,
        };
      }),
    );

    return rows.sort((a, b) => b.ageDays - a.ageDays);
  }

  // ── 3. Dead / Inactive / Obsolete Stock ────────────────────────────────────
  async getDeadInactiveObsolete(f: InvReportFilters) {
    const thresholdDays = f.noMovementDays ?? 180;
    const cutoff = new Date(Date.now() - thresholdDays * 86_400_000);

    // Dead: positive balance but no movement since cutoff
    const allBalances = await this.prisma.stockBalance.findMany({
      where: {
        companyId:  f.companyId,
        qtyOnHand:  { gt: 0 },
        ...(f.warehouseId && { warehouseId: f.warehouseId }),
        ...(f.categoryId  && { item: { categoryId: f.categoryId } }),
        ...(f.itemId      && { itemId: f.itemId }),
      },
      include: { item: { include: { category: true, uom: true } }, warehouse: true },
    });

    const dead: any[]     = [];
    const inactive: any[] = [];
    const obsolete: any[] = [];

    for (const b of allBalances) {
      const row = {
        itemCode:      b.item.code,
        description:   b.item.description,
        category:      b.item.category?.name ?? '',
        uom:           b.item.uom?.code ?? '',
        warehouseCode: b.warehouse.code,
        qtyOnHand:     Number(b.qtyOnHand),
        avgCost:       Number(b.avgCost),
        stockValue:    Number(b.qtyOnHand) * Number(b.avgCost),
        status:        b.item.status,
        lastMovement:  null as Date | null,
        ageDays:       null as number | null,
      };

      // Dead check
      const last = await this.prisma.stockMovement.findFirst({
        where: { companyId: f.companyId, itemId: b.itemId, warehouseId: b.warehouseId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      row.lastMovement = last?.createdAt ?? null;
      row.ageDays = last?.createdAt
        ? Math.floor((Date.now() - last.createdAt.getTime()) / 86_400_000)
        : 9999;

      if (!last || last.createdAt < cutoff)   dead.push(row);
      if (b.item.status === 'INACTIVE')        inactive.push(row);
      if (b.item.status === 'OBSOLETE')        obsolete.push(row);
    }

    return { dead, inactive, obsolete, thresholdDays };
  }

  // ── 4. GRN Summary ────────────────────────────────────────────────────────
  async getGrnSummary(f: InvReportFilters) {
    const grns = await this.prisma.grnHeader.findMany({
      where: {
        companyId: f.companyId,
        status:    'POSTED',
        ...(f.dateFrom && { docDate: { gte: toDateGte(f.dateFrom) } }),
        ...(f.dateTo   && { docDate: { lte: toDateLte(f.dateTo) } }),
        ...(f.supplierId && { po: { supplierId: f.supplierId } }),
        ...(f.warehouseId && { warehouseId: f.warehouseId }),
      },
      include: {
        po:       { include: { supplier: true } },
        warehouse: true,
        lines:    {
          include: { item: { include: { uom: true, category: true } } },
        },
      },
      orderBy: { docDate: 'desc' },
    });

    const rows: any[] = [];
    for (const grn of grns) {
      for (const line of grn.lines) {
        if (f.itemId && line.itemId !== f.itemId) continue;
        if (f.categoryId && line.item?.categoryId !== f.categoryId) continue;

        rows.push({
          grnNo:         grn.docNo,
          docDate:       grn.docDate,
          poNo:          grn.po?.docNo ?? '',
          supplierCode:  grn.po?.supplier?.code ?? '',
          supplierName:  grn.po?.supplier?.name ?? '',
          warehouse:     grn.warehouse?.name ?? '',
          itemCode:      line.item?.code ?? '',
          description:   line.item?.description ?? '',
          category:      line.item?.category?.name ?? '',
          uom:           line.item?.uom?.code ?? '',
          receivedQty:   Number(line.receivedQty ?? 0),
          acceptedQty:   Number(line.acceptedQty ?? 0),
          rejectedQty:   Number(line.rejectedQty ?? 0),
          unitCost:      Number((grn.po as any)?.lines?.find((l: any) => l.itemId === line.itemId)?.unitPrice ?? 0),
          lineValue:     Number(line.acceptedQty ?? 0) * Number((grn.po as any)?.lines?.find((l: any) => l.itemId === line.itemId)?.unitPrice ?? 0),
        });
      }
    }
    return rows;
  }

  // ── 5. Stock Movement ────────────────────────────────────────────────────
  async getStockMovement(f: InvReportFilters) {
    if (!f.itemId && !f.warehouseId) {
      // Require at least one filter to prevent pulling all movements
      return [];
    }

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId: f.companyId,
        ...(f.itemId      && { itemId:      f.itemId      }),
        ...(f.warehouseId && { warehouseId: f.warehouseId }),
        ...(f.dateFrom    && { createdAt:   { gte: toDateGte(f.dateFrom) } }),
        ...(f.dateTo      && { createdAt:   { lte: toDateLte(f.dateTo)   } }),
      },
      include: {
        item:      { include: { uom: true } },
        warehouse: true,
        bin:       true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return movements.map((m) => ({
      date:            m.createdAt,
      transactionType: m.transactionType,
      sourceDocNo:     m.sourceDocNo ?? '',
      itemCode:        m.item?.code ?? '',
      description:     m.item?.description ?? '',
      uom:             m.item?.uom?.code ?? '',
      warehouse:       m.warehouse?.name ?? '',
      bin:             m.bin?.code ?? '',
      inQty:           Number(m.qty) > 0  ? Number(m.qty)       : null,
      outQty:          Number(m.qty) < 0  ? Math.abs(Number(m.qty)) : null,
      balance:         Number(m.balanceAfter ?? 0),
      avgCost:         Number(m.avgCost ?? 0),
      movementValue:   Math.abs(Number(m.qty)) * Number(m.avgCost ?? 0),
    }));
  }

  // ── 6. Reorder Report ────────────────────────────────────────────────────
  async getReorderReport(f: InvReportFilters) {
    const items = await this.prisma.item.findMany({
      where: {
        companyId:    f.companyId,
        status:       'ACTIVE',
        reorderLevel: { gt: 0 },
        ...(f.categoryId && { categoryId: f.categoryId }),
        ...(f.itemId     && { id:         f.itemId     }),
      },
      include: {
        uom:      true,
        category: true,
        stockBalances: {
          where: {
            companyId:   f.companyId,
            ...(f.warehouseId && { warehouseId: f.warehouseId }),
          },
          include: { warehouse: true },
        },
      },
    });

    return items
      .map((item) => {
        const totalQty     = item.stockBalances.reduce((s, b) => s + Number(b.qtyOnHand), 0);
        const totalReserved = item.stockBalances.reduce((s, b) => s + Number(b.qtyReserved), 0);
        const available    = totalQty - totalReserved;
        const reorderLevel = Number(item.reorderLevel ?? 0);
        const reorderQty   = Number(item.reorderQty   ?? 0);
        const shortage     = reorderLevel - totalQty;
        const suggestedQty = Math.max(reorderQty, shortage);

        return {
          itemCode:      item.code,
          description:   item.description,
          category:      item.category?.name ?? '',
          uom:           item.uom?.code ?? '',
          reorderLevel,
          reorderQty,
          qtyOnHand:     totalQty,
          qtyReserved:   totalReserved,
          qtyAvailable:  available,
          shortage:      Math.max(0, shortage),
          suggestedOrderQty: Math.max(0, suggestedQty),
          leadTimeDays:  item.leadTimeDays ?? 0,
          standardCost:  Number(item.standardCost ?? 0),
          estimatedValue: Math.max(0, suggestedQty) * Number(item.standardCost ?? 0),
        };
      })
      .filter((r) => r.qtyOnHand <= r.reorderLevel)
      .sort((a, b) => b.shortage - a.shortage);
  }

  // ── 7. Valuation Report ──────────────────────────────────────────────────
  async getValuation(f: InvReportFilters) {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId:  f.companyId,
        qtyOnHand:  { gt: 0 },
        ...(f.warehouseId && { warehouseId: f.warehouseId }),
        ...(f.categoryId  && { item: { categoryId: f.categoryId } }),
        ...(f.itemId      && { itemId: f.itemId }),
      },
      include: {
        item:      { include: { category: true, uom: true } },
        warehouse: true,
      },
      orderBy: [{ item: { category: { name: 'asc' } } }, { item: { code: 'asc' } }],
    });

    const rows = balances.map((b) => ({
      category:      b.item.category?.name ?? 'Uncategorized',
      itemCode:      b.item.code,
      description:   b.item.description,
      uom:           b.item.uom?.code ?? '',
      warehouseCode: b.warehouse.code,
      warehouseName: b.warehouse.name,
      qtyOnHand:     Number(b.qtyOnHand),
      avgCost:       Number(b.avgCost),
      stockValue:    Number(b.qtyOnHand) * Number(b.avgCost),
      status:        b.item.status,
    }));

    // Group subtotals by category
    const byCategory: Record<string, { qty: number; value: number }> = {};
    for (const r of rows) {
      if (!byCategory[r.category]) byCategory[r.category] = { qty: 0, value: 0 };
      byCategory[r.category].qty   += r.qtyOnHand;
      byCategory[r.category].value += r.stockValue;
    }

    const grandTotal = rows.reduce((s, r) => s + r.stockValue, 0);

    return { rows, byCategory, grandTotal };
  }
}
