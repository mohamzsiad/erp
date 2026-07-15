import { PrismaClient } from '@prisma/client';

// A single sales document line for pricing. taxRate is a percentage (e.g. 5 = 5%).
export interface PricingLine {
  qty: number;
  unitPrice: number;
  discountPct?: number;
  taxRate?: number;
}

export interface ComputedLine {
  netAmount: number;   // qty * unitPrice * (1 - discount)
  taxAmount: number;   // netAmount * taxRate
  lineTotal: number;   // netAmount + taxAmount
}

export interface DocumentTotals {
  lines: ComputedLine[];
  subTotal: number;        // sum(qty * unitPrice) — gross before discount
  discountAmount: number;  // sum of line discounts
  netAmount: number;       // subTotal - discountAmount
  taxAmount: number;
  totalAmount: number;     // netAmount + taxAmount
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Pure line/discount/tax/total computation shared by Quotation, Sales Order,
 * Sales Invoice and Credit Note. Keep this the single source of truth so the
 * numbers match across every sales document.
 */
export function computeTotals(lines: PricingLine[]): DocumentTotals {
  let subTotal = 0;
  let discountAmount = 0;
  let taxAmount = 0;
  const computed: ComputedLine[] = lines.map((l) => {
    const gross = (l.qty || 0) * (l.unitPrice || 0);
    const disc = gross * ((l.discountPct || 0) / 100);
    const net = gross - disc;
    const tax = net * ((l.taxRate || 0) / 100);
    subTotal += gross;
    discountAmount += disc;
    taxAmount += tax;
    return { netAmount: round(net), taxAmount: round(tax), lineTotal: round(net + tax) };
  });
  const netAmount = subTotal - discountAmount;
  return {
    lines: computed,
    subTotal: round(subTotal),
    discountAmount: round(discountAmount),
    netAmount: round(netAmount),
    taxAmount: round(taxAmount),
    totalAmount: round(netAmount + taxAmount),
  };
}

export class SalesPricingService {
  constructor(private prisma: PrismaClient) {}

  /** Resolve tax-code ids → percentage rate for a company. */
  async loadTaxRates(companyId: string, taxCodeIds: Array<string | null | undefined>): Promise<Record<string, number>> {
    const ids = [...new Set(taxCodeIds.filter((x): x is string => !!x))];
    if (!ids.length) return {};
    const codes = await this.prisma.taxCode.findMany({
      where: { companyId, id: { in: ids } },
      select: { id: true, rate: true },
    });
    const map: Record<string, number> = {};
    for (const c of codes) map[c.id] = Number(c.rate);
    return map;
  }

  /**
   * Compute totals for lines that carry a taxCodeId, resolving rates from the DB.
   * Returns per-line computed amounts (aligned by index) plus header totals.
   */
  async computeForLines(
    companyId: string,
    lines: Array<{ qty: number; unitPrice: number; discountPct?: number; taxCodeId?: string | null }>,
  ): Promise<DocumentTotals> {
    const rates = await this.loadTaxRates(companyId, lines.map((l) => l.taxCodeId));
    return computeTotals(lines.map((l) => ({
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxRate: l.taxCodeId ? rates[l.taxCodeId] ?? 0 : 0,
    })));
  }
}
