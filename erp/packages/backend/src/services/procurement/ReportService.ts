import { PrismaClient, Prisma } from '@prisma/client';

export interface ReportFilters {
  companyId: string;
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  supplierId?: string;
  itemId?: string;
  status?: string;
}

// ── Common date helpers ────────────────────────────────────────────────────
function toDateGte(s?: string): Date | undefined {
  return s ? new Date(s) : undefined;
}
function toDateLte(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ── 1. PR Status ───────────────────────────────────────────────────────────
export interface PrStatusRow {
  prlId: string;
  docNo: string;
  docDate: Date;
  location: string;
  itemCode: string;
  itemDescription: string;
  requestedQty: number;
  approvedQty: number;
  poStatus: string | null;
  pendingQty: number;
  status: string;
}

// ── 2. PO Status ───────────────────────────────────────────────────────────
export interface PoStatusRow {
  poId: string;
  docNo: string;
  docDate: Date;
  supplier: string;
  itemCode: string;
  itemDescription: string;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  balanceQty: number;
  netAmount: number;
  deliveryDate: Date | null;
  overdue: boolean;
  status: string;
}

// ── 3. PO History by Supplier ──────────────────────────────────────────────
export interface PoHistoryRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  totalOrders: number;
  totalValue: number;
  avgLeadTimeDays: number | null;
  lastOrderDate: Date | null;
}

// ── 4. Procurement Tracking ────────────────────────────────────────────────
export interface ProcurementTrackingRow {
  docNo: string;
  prDate: Date;
  poDocNo: string | null;
  poDate: Date | null;
  daysElapsed: number;
  status: string;
  location: string;
}

// ── 5. Lead Time Variance ──────────────────────────────────────────────────
export interface LeadTimeVarianceRow {
  supplierCode: string;
  supplierName: string;
  itemCode: string;
  itemDescription: string;
  plannedLeadDays: number;
  actualLeadDays: number;
  variance: number;
  poCount: number;
}

// ── 6. Price Comparison ────────────────────────────────────────────────────
export interface PriceComparisonRow {
  itemCode: string;
  itemDescription: string;
  uom: string;
  supplierCode: string;
  supplierName: string;
  price1: number | null;
  price2: number | null;
  price3: number | null;
  price4: number | null;
  price5: number | null;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

// ── 7. Pending PR ──────────────────────────────────────────────────────────
export interface PendingPrRow {
  prlId: string;
  docNo: string;
  docDate: Date;
  location: string;
  ageDays: number;
  ageBucket: string;
  itemCount: number;
  totalRequestedQty: number;
  status: string;
}

// ── Service ────────────────────────────────────────────────────────────────
export class ReportService {
  constructor(private prisma: PrismaClient) {}

  // ── 1. PR Status ─────────────────────────────────────────────────────────
  async getPrStatus(filters: ReportFilters): Promise<PrStatusRow[]> {
    const prls = await this.prisma.purchaseRequisition.findMany({
      where: {
        companyId: filters.companyId,
        ...(filters.status && { status: filters.status as never }),
        ...(filters.locationId && { locationId: filters.locationId }),
        ...(filters.dateFrom || filters.dateTo
          ? {
              docDate: {
                ...(filters.dateFrom && { gte: toDateGte(filters.dateFrom) }),
                ...(filters.dateTo && { lte: toDateLte(filters.dateTo) }),
              },
            }
          : {}),
      },
      include: {
        lines: {
          include: {
            item: { select: { code: true, description: true } },
            uom: { select: { code: true } },
          },
          ...(filters.itemId ? { where: { itemId: filters.itemId } } : {}),
        },
        location: { select: { code: true, name: true } },
      },
      orderBy: { docDate: 'desc' },
    });

    const rows: PrStatusRow[] = [];

    for (const prl of prls) {
      for (const line of prl.lines) {
        const requested = Number(line.requestedQty);
        const approved = Number(line.approvedQty);
        rows.push({
          prlId: prl.id,
          docNo: prl.docNo,
          docDate: prl.docDate,
          location: (prl as never as { location?: { code: string } }).location?.code ?? prl.locationId,
          itemCode: line.item.code,
          itemDescription: line.item.description,
          requestedQty: requested,
          approvedQty: approved,
          poStatus: prl.status === 'PO_CREATED' ? 'Created' : null,
          pendingQty: Math.max(0, approved - 0), // actual pending from PO lines would require join
          status: prl.status,
        });
      }
    }
    return rows;
  }

  // ── 2. PO Status ─────────────────────────────────────────────────────────
  async getPoStatus(filters: ReportFilters): Promise<PoStatusRow[]> {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        companyId: filters.companyId,
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.status && { status: filters.status as never }),
        ...(filters.dateFrom || filters.dateTo
          ? {
              docDate: {
                ...(filters.dateFrom && { gte: toDateGte(filters.dateFrom) }),
                ...(filters.dateTo && { lte: toDateLte(filters.dateTo) }),
              },
            }
          : {}),
      },
      include: {
        supplier: { select: { code: true, name: true } },
        lines: {
          include: {
            item: { select: { code: true, description: true } },
            uom: { select: { code: true } },
          },
          ...(filters.itemId ? { where: { itemId: filters.itemId } } : {}),
        },
      },
      orderBy: { docDate: 'desc' },
    });

    const today = new Date();
    const rows: PoStatusRow[] = [];

    for (const po of pos) {
      for (const line of po.lines) {
        const ordered = Number(line.orderedQty);
        const received = Number(line.receivedQty);
        const invoiced = Number(line.invoicedQty);
        const overdue =
          po.deliveryDate != null &&
          po.deliveryDate < today &&
          !['RECEIVED', 'INVOICED', 'CLOSED', 'CANCELLED'].includes(po.status);
        rows.push({
          poId: po.id,
          docNo: po.docNo,
          docDate: po.docDate,
          supplier: `${po.supplier.code} – ${po.supplier.name}`,
          itemCode: line.item.code,
          itemDescription: line.item.description,
          orderedQty: ordered,
          receivedQty: received,
          invoicedQty: invoiced,
          balanceQty: ordered - received,
          netAmount: Number(line.netAmount),
          deliveryDate: po.deliveryDate ?? null,
          overdue,
          status: po.status,
        });
      }
    }
    return rows;
  }

  // ── 3. PO History by Supplier ─────────────────────────────────────────────
  async getPoHistoryBySupplier(filters: ReportFilters): Promise<PoHistoryRow[]> {
    // Raw aggregation via Prisma groupBy + raw for lead time
    const grouped = await this.prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: {
        companyId: filters.companyId,
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.dateFrom || filters.dateTo
          ? {
              docDate: {
                ...(filters.dateFrom && { gte: toDateGte(filters.dateFrom) }),
                ...(filters.dateTo && { lte: toDateLte(filters.dateTo) }),
              },
            }
          : {}),
      },
      _count: { id: true },
      _sum: { totalAmount: true },
      _max: { docDate: true },
    });

    if (grouped.length === 0) return [];

    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: grouped.map((g) => g.supplierId) } },
      select: { id: true, code: true, name: true },
    });
    const supMap = new Map(suppliers.map((s) => [s.id, s]));

    // Lead time: average of (deliveryDate - docDate) in days for completed POs
    const leadTimeData = await this.prisma.$queryRaw<
      { supplierId: string; avgLeadDays: number | null }[]
    >`
      SELECT "supplierId",
             AVG("deliveryDate" - "docDate") AS "avgLeadDays"
      FROM purchase_orders
      WHERE "companyId" = ${filters.companyId}
        AND "deliveryDate" IS NOT NULL
        AND status IN ('RECEIVED', 'INVOICED', 'CLOSED')
      GROUP BY "supplierId"
    `;
    const leadMap = new Map(leadTimeData.map((r) => [r.supplierId, r.avgLeadDays]));

    return grouped.map((g) => {
      const sup = supMap.get(g.supplierId);
      return {
        supplierId: g.supplierId,
        supplierCode: sup?.code ?? g.supplierId,
        supplierName: sup?.name ?? '',
        totalOrders: g._count.id,
        totalValue: Number(g._sum.totalAmount ?? 0),
        avgLeadTimeDays:
          leadMap.has(g.supplierId) ? Math.round(leadMap.get(g.supplierId)! ?? 0) : null,
        lastOrderDate: g._max.docDate ?? null,
      };
    });
  }

  // ── 4. Procurement Tracking (PR → PO cycle) ───────────────────────────────
  async getProcurementTracking(filters: ReportFilters): Promise<ProcurementTrackingRow[]> {
    const prls = await this.prisma.purchaseRequisition.findMany({
      where: {
        companyId: filters.companyId,
        ...(filters.locationId && { locationId: filters.locationId }),
        ...(filters.dateFrom || filters.dateTo
          ? {
              docDate: {
                ...(filters.dateFrom && { gte: toDateGte(filters.dateFrom) }),
                ...(filters.dateTo && { lte: toDateLte(filters.dateTo) }),
              },
            }
          : {}),
      },
      include: {
        location: { select: { code: true } },
      },
      orderBy: { docDate: 'desc' },
    });

    const today = new Date();
    const rows: ProcurementTrackingRow[] = [];

    for (const prl of prls) {
      // Find associated PO via enquiry chain (simplified: look for PO with prlId reference)
      // In practice this would join through PE -> PQ -> PO; simplified here
      const daysElapsed = Math.floor(
        (today.getTime() - new Date(prl.docDate).getTime()) / 86_400_000
      );
      const loc = (prl as never as { location?: { code: string } }).location;
      rows.push({
        docNo: prl.docNo,
        prDate: prl.docDate,
        poDocNo: null, // populated by join when available
        poDate: null,
        daysElapsed,
        status: prl.status,
        location: loc?.code ?? prl.locationId,
      });
    }
    return rows;
  }

  // ── 5. Lead Time Variance ─────────────────────────────────────────────────
  async getLeadTimeVariance(filters: ReportFilters): Promise<LeadTimeVarianceRow[]> {
    const data = await this.prisma.$queryRaw<
      {
        supplierCode: string;
        supplierName: string;
        itemCode: string;
        itemDescription: string;
        uomCode: string;
        plannedLeadDays: number;
        actualLeadDays: number;
        poCount: number;
      }[]
    >`
      SELECT
        s.code          AS "supplierCode",
        s.name          AS "supplierName",
        i.code          AS "itemCode",
        i.description   AS "itemDescription",
        u.code          AS "uomCode",
        0               AS "plannedLeadDays",
        COALESCE(
          AVG(po."deliveryDate" - po."docDate"),
          0
        )::FLOAT         AS "actualLeadDays",
        COUNT(po.id)::INT AS "poCount"
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po."supplierId"
      JOIN po_lines pl  ON pl."poId" = po.id
      JOIN items i      ON i.id = pl."itemId"
      JOIN uoms u       ON u.id = pl."uomId"
      WHERE po."companyId" = ${filters.companyId}
        AND po."deliveryDate" IS NOT NULL
        AND po.status IN ('RECEIVED', 'INVOICED', 'CLOSED')
        ${filters.supplierId ? Prisma.sql`AND po."supplierId" = ${filters.supplierId}` : Prisma.empty}
      GROUP BY s.code, s.name, i.code, i.description, u.code
      ORDER BY "supplierName", "itemCode"
    `;

    return data.map((r) => ({
      supplierCode: r.supplierCode,
      supplierName: r.supplierName,
      itemCode: r.itemCode,
      itemDescription: r.itemDescription,
      plannedLeadDays: r.plannedLeadDays,
      actualLeadDays: Math.round(r.actualLeadDays),
      variance: Math.round(r.actualLeadDays) - r.plannedLeadDays,
      poCount: r.poCount,
    }));
  }

  // ── 6. Price Comparison (last 5 prices per item per supplier) ─────────────
  async getPriceComparison(filters: ReportFilters): Promise<PriceComparisonRow[]> {
    // Fetch last 5 unit prices per item+supplier via window function
    const raw = await this.prisma.$queryRaw<
      {
        itemCode: string;
        itemDescription: string;
        uomCode: string;
        supplierCode: string;
        supplierName: string;
        unitPrice: number;
        rn: number;
      }[]
    >`
      WITH ranked AS (
        SELECT
          i.code          AS "itemCode",
          i.description   AS "itemDescription",
          u.code          AS "uomCode",
          s.code          AS "supplierCode",
          s.name          AS "supplierName",
          pl."unitPrice"::FLOAT AS "unitPrice",
          ROW_NUMBER() OVER (
            PARTITION BY pl."itemId", po."supplierId"
            ORDER BY po."docDate" DESC
          ) AS rn
        FROM po_lines pl
        JOIN purchase_orders po ON po.id = pl."poId"
        JOIN items i ON i.id = pl."itemId"
        JOIN uoms u ON u.id = pl."uomId"
        JOIN suppliers s ON s.id = po."supplierId"
        WHERE po."companyId" = ${filters.companyId}
          AND po.status NOT IN ('CANCELLED')
          ${filters.itemId ? Prisma.sql`AND pl."itemId" = ${filters.itemId}` : Prisma.empty}
      )
      SELECT * FROM ranked WHERE rn <= 5
      ORDER BY "itemCode", "supplierCode", rn
    `;

    // Pivot: group by item+supplier, put prices in price1..price5
    const grouped = new Map<string, PriceComparisonRow>();

    for (const r of raw) {
      const key = `${r.itemCode}::${r.supplierCode}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          itemCode: r.itemCode,
          itemDescription: r.itemDescription,
          uom: r.uomCode,
          supplierCode: r.supplierCode,
          supplierName: r.supplierName,
          price1: null,
          price2: null,
          price3: null,
          price4: null,
          price5: null,
          avgPrice: null,
          minPrice: null,
          maxPrice: null,
        });
      }
      const row = grouped.get(key)!;
      const priceField = `price${r.rn}` as keyof PriceComparisonRow;
      (row as Record<string, unknown>)[priceField] = r.unitPrice;
    }

    // Compute avg/min/max
    for (const row of grouped.values()) {
      const prices = [row.price1, row.price2, row.price3, row.price4, row.price5].filter(
        (p): p is number => p != null
      );
      if (prices.length > 0) {
        row.avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        row.minPrice = Math.min(...prices);
        row.maxPrice = Math.max(...prices);
      }
    }

    return [...grouped.values()];
  }

  // ── 7. Pending PR ──────────────────────────────────────────────────────────
  async getPendingPr(filters: ReportFilters): Promise<PendingPrRow[]> {
    const prls = await this.prisma.purchaseRequisition.findMany({
      where: {
        companyId: filters.companyId,
        status: { notIn: ['PO_CREATED', 'SHORT_CLOSED', 'CLOSED'] },
        ...(filters.locationId && { locationId: filters.locationId }),
        ...(filters.dateFrom || filters.dateTo
          ? {
              docDate: {
                ...(filters.dateFrom && { gte: toDateGte(filters.dateFrom) }),
                ...(filters.dateTo && { lte: toDateLte(filters.dateTo) }),
              },
            }
          : {}),
      },
      include: {
        location: { select: { code: true } },
        lines: {
          select: { requestedQty: true },
        },
      },
      orderBy: { docDate: 'asc' },
    });

    const today = new Date();

    return prls.map((prl) => {
      const ageDays = Math.floor(
        (today.getTime() - new Date(prl.docDate).getTime()) / 86_400_000
      );
      const ageBucket =
        ageDays <= 7 ? '0–7 days' :
        ageDays <= 14 ? '8–14 days' :
        ageDays <= 30 ? '15–30 days' : '>30 days';

      const loc = (prl as never as { location?: { code: string } }).location;

      return {
        prlId: prl.id,
        docNo: prl.docNo,
        docDate: prl.docDate,
        location: loc?.code ?? prl.locationId,
        ageDays,
        ageBucket,
        itemCount: prl.lines.length,
        totalRequestedQty: prl.lines.reduce((sum, l) => sum + Number(l.requestedQty), 0),
        status: prl.status,
      };
    });
  }
}
