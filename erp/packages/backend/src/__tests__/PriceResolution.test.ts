import { PriceResolutionService } from '../services/sales/PriceResolutionService';

// ── Test doubles ───────────────────────────────────────────────────────────────
interface ListRec { id: string; validFrom: Date | null; validTo: Date | null; isActive?: boolean }
interface ItemRec { unitPrice: number; minPrice: number; validFrom: Date | null; validTo: Date | null }

function makePrisma(opts: {
  customer?: { priceListId: string | null; category: { priceListId: string | null } | null } | null;
  lists?: Record<string, ListRec>;                // by id
  defaultList?: ListRec | null;
  itemsByList?: Record<string, ItemRec>;          // by priceListId
}) {
  const lists = opts.lists ?? {};
  const itemsByList = opts.itemsByList ?? {};
  return {
    customer: {
      findFirst: jest.fn(async () => opts.customer ?? null),
    },
    priceList: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.isDefault) return opts.defaultList ?? null;
        const l = lists[where.id];
        if (!l) return null;
        if (where.isActive && l.isActive === false) return null;
        return l;
      }),
    },
    priceListItem: {
      findFirst: jest.fn(async ({ where }: any) => itemsByList[where.priceListId] ?? null),
    },
  } as any;
}

const activeList = (id: string): ListRec => ({ id, validFrom: null, validTo: null, isActive: true });
const item = (unitPrice: number, minPrice = 0, validFrom: Date | null = null, validTo: Date | null = null): ItemRec =>
  ({ unitPrice, minPrice, validFrom, validTo });

const base = { companyId: 'CO', itemId: 'ITEM1', uomId: 'UOM1' };

describe('PriceResolutionService.resolvePrice', () => {
  it('Tier 1 — resolves from the customer-specific price list', async () => {
    const prisma = makePrisma({
      customer: { priceListId: 'PL_CUST', category: { priceListId: 'PL_CAT' } },
      lists: { PL_CUST: activeList('PL_CUST'), PL_CAT: activeList('PL_CAT') },
      itemsByList: { PL_CUST: item(100, 90), PL_CAT: item(110, 95) },
    });
    const res = await new PriceResolutionService(prisma).resolvePrice({ ...base, customerId: 'C1' });
    expect(res.source).toBe('CUSTOMER');
    expect(res.unitPrice).toBe(100);
    expect(res.minPrice).toBe(90);
    expect(res.priceListId).toBe('PL_CUST');
  });

  it('Tier 2 — falls back to the customer-category price list', async () => {
    const prisma = makePrisma({
      customer: { priceListId: null, category: { priceListId: 'PL_CAT' } },
      lists: { PL_CAT: activeList('PL_CAT') },
      itemsByList: { PL_CAT: item(110, 95) },
    });
    const res = await new PriceResolutionService(prisma).resolvePrice({ ...base, customerId: 'C1' });
    expect(res.source).toBe('CUSTOMER_CATEGORY');
    expect(res.unitPrice).toBe(110);
    expect(res.priceListId).toBe('PL_CAT');
  });

  it('Tier 2 — used when the customer list has no matching item', async () => {
    const prisma = makePrisma({
      customer: { priceListId: 'PL_CUST', category: { priceListId: 'PL_CAT' } },
      lists: { PL_CUST: activeList('PL_CUST'), PL_CAT: activeList('PL_CAT') },
      itemsByList: { PL_CAT: item(110) }, // no item in PL_CUST
    });
    const res = await new PriceResolutionService(prisma).resolvePrice({ ...base, customerId: 'C1' });
    expect(res.source).toBe('CUSTOMER_CATEGORY');
    expect(res.unitPrice).toBe(110);
  });

  it('Tier 3 — falls back to the company default price list', async () => {
    const prisma = makePrisma({
      customer: { priceListId: null, category: null },
      defaultList: activeList('PL_DEF'),
      itemsByList: { PL_DEF: item(120, 100) },
    });
    const res = await new PriceResolutionService(prisma).resolvePrice({ ...base, customerId: 'C1' });
    expect(res.source).toBe('DEFAULT');
    expect(res.unitPrice).toBe(120);
    expect(res.priceListId).toBe('PL_DEF');
  });

  it('Tier 3 — used when there is no customer at all', async () => {
    const prisma = makePrisma({
      defaultList: activeList('PL_DEF'),
      itemsByList: { PL_DEF: item(50) },
    });
    const res = await new PriceResolutionService(prisma).resolvePrice({ ...base });
    expect(res.source).toBe('DEFAULT');
    expect(res.unitPrice).toBe(50);
  });

  it('Tier 4 — MANUAL when nothing matches', async () => {
    const prisma = makePrisma({
      customer: { priceListId: null, category: null },
      defaultList: null,
    });
    const res = await new PriceResolutionService(prisma).resolvePrice({ ...base, customerId: 'C1' });
    expect(res.source).toBe('MANUAL');
    expect(res.unitPrice).toBeNull();
    expect(res.minPrice).toBeNull();
  });

  it('skips a price-list item whose validity window has expired', async () => {
    const past = new Date('2020-01-01');
    const prisma = makePrisma({
      customer: { priceListId: 'PL_CUST', category: null },
      lists: { PL_CUST: activeList('PL_CUST') },
      itemsByList: { PL_CUST: item(100, 90, null, past) }, // expired
      defaultList: activeList('PL_DEF'),
      itemsByList2: {} as any,
    });
    // default has a valid item -> should fall through to DEFAULT
    (prisma.priceListItem.findFirst as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.priceListId === 'PL_CUST') return item(100, 90, null, past);
      if (where.priceListId === 'PL_DEF') return item(75, 60);
      return null;
    });
    const res = await new PriceResolutionService(prisma).resolvePrice({ ...base, customerId: 'C1' });
    expect(res.source).toBe('DEFAULT');
    expect(res.unitPrice).toBe(75);
  });
});
