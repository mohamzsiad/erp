import { PrismaClient, Prisma } from '@prisma/client';

export interface PriceListItemInput {
  itemId: string;
  uomId: string;
  unitPrice: number;
  minPrice?: number;
  /** Both dates are mandatory — a price with no validity window is rejected. */
  validFrom: string;
  validTo: string;
}

export type PriceListTypeInput = 'STANDARD' | 'CUSTOMER_SPECIFIC';

export interface CreatePriceListInput {
  companyId: string;
  code?: string | null;
  name: string;
  type?: PriceListTypeInput;
  ownerCustomerId?: string | null;   // required for CUSTOMER_SPECIFIC, forbidden for STANDARD
  currencyId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  items?: PriceListItemInput[];
}

export type UpdatePriceListInput = Partial<Omit<CreatePriceListInput, 'companyId'>>;

function notFound(msg = 'Price list not found') {
  return Object.assign(new Error(msg), { statusCode: 404 });
}
function invalid(msg: string) {
  return Object.assign(new Error(msg), { statusCode: 422 });
}
function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export class PriceListService {
  constructor(private prisma: PrismaClient) {}

  // ── List ───────────────────────────────────────────────────────────────────
  async list(companyId: string, opts: { search?: string; isActive?: boolean; type?: PriceListTypeInput } = {}) {
    const where: Prisma.PriceListWhereInput = { companyId };
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { code: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    if (opts.type) where.type = opts.type as any;

    const lists = await this.prisma.priceList.findMany({
      where,
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { items: true, customers: true, categories: true } },
        ownerCustomer: { select: { id: true, code: true, name: true } },
        currency: { select: { code: true } },
      },
    });
    return lists.map((l) => ({
      ...l,
      itemCount: l._count.items,
      // A standard list serves many customers; a customer-specific list serves one.
      assignedCount: l.type === 'CUSTOMER_SPECIFIC' ? 1 : l._count.customers + l._count.categories,
      ownerCustomerCode: l.ownerCustomer?.code ?? null,
      ownerCustomerName: l.ownerCustomer?.name ?? null,
      currencyCode: l.currency?.code ?? null,
      _count: undefined,
      ownerCustomer: undefined,
      currency: undefined,
    }));
  }

  // ── Get with items ─────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const list = await this.prisma.priceList.findFirst({
      where: { id, companyId },
      include: {
        ownerCustomer: { select: { id: true, code: true, name: true } },
        currency: { select: { id: true, code: true, name: true } },
        items: {
          orderBy: { id: 'asc' },
          include: {
            item: { select: { code: true, description: true } },
            uom: { select: { code: true } },
          },
        },
      },
    });
    if (!list) throw notFound();
    return {
      ...list,
      ownerCustomerCode: list.ownerCustomer?.code ?? null,
      ownerCustomerName: list.ownerCustomer?.name ?? null,
      currencyCode: list.currency?.code ?? null,
      items: list.items.map((i) => ({
        id: i.id,
        priceListId: i.priceListId,
        itemId: i.itemId,
        uomId: i.uomId,
        unitPrice: Number(i.unitPrice),
        minPrice: Number(i.minPrice),
        validFrom: i.validFrom,
        validTo: i.validTo,
        itemCode: i.item?.code,
        itemDescription: i.item?.description,
        uomCode: i.uom?.code,
      })),
    };
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(input: CreatePriceListInput, userId: string) {
    const type = input.type ?? 'STANDARD';
    await this.validateType(input.companyId, type, input.ownerCustomerId ?? null, null);
    await this.validateCurrency(input.companyId, input.currencyId ?? null);
    this.validateItemDates(input.items);

    // The code is the unique key that tells price lists apart, so it is never blank.
    const code = input.code?.trim().toUpperCase() || (await this.nextCode(input.companyId, type));
    const clash = await this.prisma.priceList.findFirst({ where: { companyId: input.companyId, code }, select: { id: true } });
    if (clash) throw Object.assign(new Error(`Price list code "${code}" already exists`), { statusCode: 409 });

    const list = await this.prisma.$transaction(async (tx) => {
      // Only a standard list can be the company default.
      const isDefault = type === 'STANDARD' ? (input.isDefault ?? false) : false;
      if (isDefault) {
        await tx.priceList.updateMany({ where: { companyId: input.companyId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.priceList.create({
        data: {
          companyId: input.companyId,
          code,
          name: input.name,
          type: type as any,
          ownerCustomerId: type === 'CUSTOMER_SPECIFIC' ? input.ownerCustomerId! : null,
          currencyId: input.currencyId ?? null,
          validFrom: toDate(input.validFrom),
          validTo: toDate(input.validTo),
          isActive: input.isActive ?? true,
          isDefault,
          items: input.items?.length
            ? { createMany: { data: input.items.map((i) => this.itemData(i)) } }
            : undefined,
        },
      });
    });

    // A customer-specific list is, by definition, that customer's list.
    if (type === 'CUSTOMER_SPECIFIC' && input.ownerCustomerId) {
      await this.prisma.customer.update({ where: { id: input.ownerCustomerId }, data: { priceListId: list.id } });
    }

    await this.audit('CREATE', list.id, userId, { name: list.name, type });
    return this.getById(list.id, input.companyId);
  }

  // ── Update (header + optional full item replace) ───────────────────────────
  async update(id: string, companyId: string, input: UpdatePriceListInput, userId: string) {
    const existing = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();

    const type = (input.type ?? existing.type) as PriceListTypeInput;
    const ownerCustomerId = input.ownerCustomerId !== undefined ? input.ownerCustomerId : existing.ownerCustomerId;
    await this.validateType(companyId, type, ownerCustomerId, id);
    if (input.currencyId !== undefined) await this.validateCurrency(companyId, input.currencyId);
    this.validateItemDates(input.items);
    const isDefault = type === 'STANDARD' ? input.isDefault : false;

    let code: string | undefined;
    if (input.code !== undefined) {
      code = input.code?.trim().toUpperCase() || existing.code;
      if (code !== existing.code) {
        const clash = await this.prisma.priceList.findFirst({ where: { companyId, code, id: { not: id } }, select: { id: true } });
        if (clash) throw Object.assign(new Error(`Price list code "${code}" already exists`), { statusCode: 409 });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.priceList.updateMany({ where: { companyId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      await tx.priceList.update({
        where: { id },
        data: {
          code,
          name: input.name,
          type: type as any,
          ownerCustomerId: type === 'CUSTOMER_SPECIFIC' ? ownerCustomerId : null,
          currencyId: input.currencyId,
          validFrom: input.validFrom !== undefined ? toDate(input.validFrom) : undefined,
          validTo: input.validTo !== undefined ? toDate(input.validTo) : undefined,
          isActive: input.isActive,
          isDefault,
        },
      });
      if (input.items !== undefined) {
        await tx.priceListItem.deleteMany({ where: { priceListId: id } });
        if (input.items.length) {
          await tx.priceListItem.createMany({ data: input.items.map((i) => ({ priceListId: id, ...this.itemData(i) })) });
        }
      }
    });
    if (type === 'CUSTOMER_SPECIFIC' && ownerCustomerId) {
      await this.prisma.customer.update({ where: { id: ownerCustomerId }, data: { priceListId: id } });
    }

    await this.audit('UPDATE', id, userId, { name: input.name ?? existing.name });
    return this.getById(id, companyId);
  }

  // ── Set as company default ─────────────────────────────────────────────────
  async setDefault(id: string, companyId: string, userId: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw notFound();
    if (list.type === 'CUSTOMER_SPECIFIC') throw invalid('A customer-specific price list cannot be the company default');
    await this.prisma.$transaction(async (tx) => {
      await tx.priceList.updateMany({ where: { companyId, isDefault: true }, data: { isDefault: false } });
      await tx.priceList.update({ where: { id }, data: { isDefault: true, isActive: true } });
    });
    await this.audit('UPDATE', id, userId, { isDefault: true });
    return { id, isDefault: true };
  }

  async toggleActive(id: string, companyId: string, userId: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw notFound();
    const updated = await this.prisma.priceList.update({ where: { id }, data: { isActive: !list.isActive } });
    await this.audit('UPDATE', id, userId, { isActive: updated.isActive });
    return updated;
  }

  // ── Bulk upsert items ──────────────────────────────────────────────────────
  async bulkUpsertItems(id: string, companyId: string, items: PriceListItemInput[], userId: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw notFound();
    this.validateItemDates(items);
    for (const i of items) {
      await this.prisma.priceListItem.upsert({
        where: { priceListId_itemId_uomId: { priceListId: id, itemId: i.itemId, uomId: i.uomId } },
        update: this.itemData(i),
        create: { priceListId: id, ...this.itemData(i) },
      });
    }
    await this.audit('UPDATE', id, userId, { bulkItems: items.length });
    return this.getById(id, companyId);
  }

  async deleteItem(id: string, companyId: string, itemRowId: string, userId: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw notFound();
    await this.prisma.priceListItem.deleteMany({ where: { id: itemRowId, priceListId: id } });
    await this.audit('UPDATE', id, userId, { deletedItem: itemRowId });
    return { ok: true };
  }

  // ── Assign price list to a customer or category ────────────────────────────
  /**
   * Attaches a standard price list to a customer category. Customers are given
   * their price list on the customer master, so CUSTOMER targets are refused.
   */
  async assign(id: string, companyId: string, targetType: 'CUSTOMER' | 'CATEGORY', targetId: string, userId: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw notFound();
    if (targetType === 'CUSTOMER') {
      throw invalid('Assign a price list to a customer from the customer master');
    }
    if (list.type === 'CUSTOMER_SPECIFIC') {
      throw invalid('A customer-specific price list cannot be assigned to a category');
    }
    const cat = await this.prisma.customerCategory.findFirst({ where: { id: targetId, companyId } });
    if (!cat) throw Object.assign(new Error('Customer category not found'), { statusCode: 422 });
    await this.prisma.customerCategory.update({ where: { id: targetId }, data: { priceListId: id } });
    await this.audit('UPDATE', id, userId, { assignedTo: targetType, targetId });
    return { ok: true };
  }

  /**
   * Current weighted average cost of an item across the company's warehouses,
   * shown next to the price box so the user prices above cost knowingly.
   */
  async itemWac(companyId: string, itemId: string) {
    const warehouses = await this.prisma.warehouse.findMany({ where: { companyId }, select: { id: true } });
    const balances = await this.prisma.stockBalance.findMany({
      where: { itemId, warehouseId: { in: warehouses.map((w) => w.id) }, binId: null },
      select: { qtyOnHand: true, avgCost: true },
    });
    let qty = 0;
    let value = 0;
    for (const b of balances) {
      const q = Number(b.qtyOnHand);
      if (q <= 0) continue;               // ignore empty / negative rows
      qty += q;
      value += q * Number(b.avgCost);
    }
    // With no stock on hand, fall back to the item's standard cost.
    if (qty <= 0) {
      const item = await this.prisma.item.findFirst({ where: { id: itemId, companyId }, select: { standardCost: true } });
      return { itemId, wac: Number(item?.standardCost ?? 0), qtyOnHand: 0, source: 'STANDARD_COST' as const };
    }
    return { itemId, wac: round3(value / qty), qtyOnHand: round3(qty), source: 'WAC' as const };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  /** Every price line needs a validity window — no open-ended prices. */
  private validateItemDates(items?: PriceListItemInput[]) {
    for (const i of items ?? []) {
      if (!i.validFrom || !i.validTo) {
        throw invalid('Each price list line needs both a Valid From and a Valid To date');
      }
      if (new Date(i.validTo) < new Date(i.validFrom)) {
        throw invalid('A price list line cannot end before it starts');
      }
    }
  }

  private async nextCode(companyId: string, type: PriceListTypeInput): Promise<string> {
    const prefix = type === 'CUSTOMER_SPECIFIC' ? 'CSP' : 'STD';
    const count = await this.prisma.priceList.count({ where: { companyId, code: { startsWith: prefix } } });
    let n = count + 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const code = `${prefix}${String(n).padStart(3, '0')}`;
      const exists = await this.prisma.priceList.findFirst({ where: { companyId, code }, select: { id: true } });
      if (!exists) return code;
      n += 1;
    }
  }

  /**
   * STANDARD lists attach to many customers/categories and carry no owner.
   * CUSTOMER_SPECIFIC lists attach to exactly one customer, who may hold only
   * one such list.
   */
  private async validateType(companyId: string, type: PriceListTypeInput, ownerCustomerId: string | null, selfId: string | null) {
    if (type === 'STANDARD') {
      if (ownerCustomerId) throw invalid('A standard price list cannot be tied to a single customer');
      return;
    }
    if (!ownerCustomerId) throw invalid('A customer-specific price list requires a customer');
    const customer = await this.prisma.customer.findFirst({ where: { id: ownerCustomerId, companyId }, select: { id: true } });
    if (!customer) throw invalid('Customer not found');
    const clash = await this.prisma.priceList.findFirst({
      where: { ownerCustomerId, id: selfId ? { not: selfId } : undefined },
      select: { id: true, name: true },
    });
    if (clash) throw invalid(`This customer already has a specific price list ("${clash.name}")`);
  }

  private async validateCurrency(companyId: string, currencyId: string | null) {
    if (!currencyId) return;
    const cur = await this.prisma.currency.findFirst({ where: { id: currencyId, companyId }, select: { id: true } });
    if (!cur) throw invalid('Currency not found');
  }

  private itemData(i: PriceListItemInput) {
    return {
      itemId: i.itemId,
      uomId: i.uomId,
      unitPrice: new Prisma.Decimal(i.unitPrice),
      minPrice: new Prisma.Decimal(i.minPrice ?? 0),
      validFrom: toDate(i.validFrom),
      validTo: toDate(i.validTo),
    };
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({
      data: { tableName: 'price_lists', recordId, userId, action, newValues: values },
    });
  }
}
