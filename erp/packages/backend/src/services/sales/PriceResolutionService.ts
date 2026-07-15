import { PrismaClient } from '@prisma/client';

export type PriceSource = 'CUSTOMER' | 'CUSTOMER_CATEGORY' | 'DEFAULT' | 'MANUAL';

export interface ResolvePriceArgs {
  companyId: string;
  itemId: string;
  uomId: string;
  customerId?: string | null;
  date?: string | Date | null;
}

export interface PriceResolution {
  unitPrice: number | null;
  minPrice: number | null;
  source: PriceSource;
  priceListId?: string | null;
}

/**
 * Resolves the selling price for an item/uom, applying the tiered order:
 *   customer-specific price list → customer-category price list → company
 *   default price list → MANUAL (no stored price).
 * Validity dates on both the price list and the price-list item are respected.
 * Pure (no writes) so it can be called inside document transactions.
 */
export class PriceResolutionService {
  constructor(private prisma: PrismaClient) {}

  async resolvePrice(args: ResolvePriceArgs): Promise<PriceResolution> {
    const { companyId, itemId, uomId, customerId } = args;
    const asOf = args.date ? new Date(args.date) : new Date();

    let customerListId: string | null = null;
    let categoryListId: string | null = null;

    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { priceListId: true, category: { select: { priceListId: true } } },
      });
      customerListId = customer?.priceListId ?? null;
      categoryListId = customer?.category?.priceListId ?? null;
    }

    // Tier 1 — customer-specific
    if (customerListId) {
      const hit = await this.lookup(companyId, customerListId, itemId, uomId, asOf);
      if (hit) return { ...hit, source: 'CUSTOMER', priceListId: customerListId };
    }

    // Tier 2 — customer category
    if (categoryListId) {
      const hit = await this.lookup(companyId, categoryListId, itemId, uomId, asOf);
      if (hit) return { ...hit, source: 'CUSTOMER_CATEGORY', priceListId: categoryListId };
    }

    // Tier 3 — company default
    const def = await this.prisma.priceList.findFirst({
      where: { companyId, isDefault: true, isActive: true },
      select: { id: true, validFrom: true, validTo: true },
    });
    if (def && this.dateOk(def.validFrom, def.validTo, asOf)) {
      const hit = await this.lookupItem(def.id, itemId, uomId, asOf);
      if (hit) return { ...hit, source: 'DEFAULT', priceListId: def.id };
    }

    // Tier 4 — manual
    return { unitPrice: null, minPrice: null, source: 'MANUAL', priceListId: null };
  }

  private async lookup(companyId: string, priceListId: string, itemId: string, uomId: string, asOf: Date) {
    const list = await this.prisma.priceList.findFirst({
      where: { id: priceListId, companyId, isActive: true },
      select: { id: true, validFrom: true, validTo: true },
    });
    if (!list || !this.dateOk(list.validFrom, list.validTo, asOf)) return null;
    return this.lookupItem(priceListId, itemId, uomId, asOf);
  }

  private async lookupItem(priceListId: string, itemId: string, uomId: string, asOf: Date) {
    const item = await this.prisma.priceListItem.findFirst({
      where: { priceListId, itemId, uomId },
      select: { unitPrice: true, minPrice: true, validFrom: true, validTo: true },
    });
    if (!item || !this.dateOk(item.validFrom, item.validTo, asOf)) return null;
    return { unitPrice: Number(item.unitPrice), minPrice: Number(item.minPrice) };
  }

  private dateOk(from: Date | null, to: Date | null, asOf: Date): boolean {
    if (from && from > asOf) return false;
    if (to && to < asOf) return false;
    return true;
  }
}
