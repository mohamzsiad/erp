import { PrismaClient, Prisma } from '@prisma/client';

export interface PriceListItemInput {
  itemId: string;
  uomId: string;
  unitPrice: number;
  minPrice?: number;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface CreatePriceListInput {
  companyId: string;
  name: string;
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
function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

export class PriceListService {
  constructor(private prisma: PrismaClient) {}

  // ── List ───────────────────────────────────────────────────────────────────
  async list(companyId: string, opts: { search?: string; isActive?: boolean } = {}) {
    const where: Prisma.PriceListWhereInput = { companyId };
    if (opts.search) where.name = { contains: opts.search, mode: 'insensitive' };
    if (opts.isActive !== undefined) where.isActive = opts.isActive;

    const lists = await this.prisma.priceList.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
    return lists.map((l) => ({ ...l, itemCount: l._count.items, _count: undefined }));
  }

  // ── Get with items ─────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const list = await this.prisma.priceList.findFirst({
      where: { id, companyId },
      include: {
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
    const list = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.priceList.updateMany({ where: { companyId: input.companyId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.priceList.create({
        data: {
          companyId: input.companyId,
          name: input.name,
          currencyId: input.currencyId ?? null,
          validFrom: toDate(input.validFrom),
          validTo: toDate(input.validTo),
          isActive: input.isActive ?? true,
          isDefault: input.isDefault ?? false,
          items: input.items?.length
            ? { createMany: { data: input.items.map((i) => this.itemData(i)) } }
            : undefined,
        },
      });
    });
    await this.audit('CREATE', list.id, userId, { name: list.name });
    return list;
  }

  // ── Update (header + optional full item replace) ───────────────────────────
  async update(id: string, companyId: string, input: UpdatePriceListInput, userId: string) {
    const existing = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();

    await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.priceList.updateMany({ where: { companyId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      await tx.priceList.update({
        where: { id },
        data: {
          name: input.name,
          currencyId: input.currencyId,
          validFrom: input.validFrom !== undefined ? toDate(input.validFrom) : undefined,
          validTo: input.validTo !== undefined ? toDate(input.validTo) : undefined,
          isActive: input.isActive,
          isDefault: input.isDefault,
        },
      });
      if (input.items !== undefined) {
        await tx.priceListItem.deleteMany({ where: { priceListId: id } });
        if (input.items.length) {
          await tx.priceListItem.createMany({ data: input.items.map((i) => ({ priceListId: id, ...this.itemData(i) })) });
        }
      }
    });
    await this.audit('UPDATE', id, userId, { name: input.name ?? existing.name });
    return this.getById(id, companyId);
  }

  // ── Set as company default ─────────────────────────────────────────────────
  async setDefault(id: string, companyId: string, userId: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw notFound();
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
  async assign(id: string, companyId: string, targetType: 'CUSTOMER' | 'CATEGORY', targetId: string, userId: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw notFound();
    if (targetType === 'CUSTOMER') {
      const c = await this.prisma.customer.findFirst({ where: { id: targetId, companyId } });
      if (!c) throw Object.assign(new Error('Customer not found'), { statusCode: 422 });
      await this.prisma.customer.update({ where: { id: targetId }, data: { priceListId: id } });
    } else {
      const cat = await this.prisma.customerCategory.findFirst({ where: { id: targetId, companyId } });
      if (!cat) throw Object.assign(new Error('Customer category not found'), { statusCode: 422 });
      await this.prisma.customerCategory.update({ where: { id: targetId }, data: { priceListId: id } });
    }
    await this.audit('UPDATE', id, userId, { assignedTo: targetType, targetId });
    return { ok: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
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
