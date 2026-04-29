import { PrismaClient, Prisma, ItemStatus } from '@prisma/client';
import type { PaginatedResponse } from '@clouderp/shared';

export interface ItemListQuery {
  companyId: string;
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  uomId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface CreateItemInput {
  companyId: string;
  code?: string;
  description: string;
  shortDescription?: string;
  categoryId?: string;
  uomId: string;
  grade1Options?: string[];
  grade2Options?: string[];
  reorderLevel?: number;
  reorderQty?: number;
  minStock?: number;
  maxStock?: number;
  standardCost?: number;
  trackingType?: string;
  status?: string;
}

export type UpdateItemInput = Partial<Omit<CreateItemInput, 'companyId' | 'code'>>;

export class ItemService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── List with pagination + filters ──────────────────────────────────────────
  async list(query: ItemListQuery): Promise<PaginatedResponse<any>> {
    const { companyId, page = 1, limit = 50, search, categoryId, status, uomId,
            sortBy = 'code', sortDir = 'asc' } = query;

    const where: Prisma.ItemWhereInput = {
      companyId,
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(status && { status: status as ItemStatus }),
      ...(uomId && { uomId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortDir },
        include: {
          uom: { select: { code: true, symbol: true } },
          category: { select: { code: true, name: true } },
        },
      }),
      this.prisma.item.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID ────────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, companyId },
      include: {
        uom: true,
        category: true,
      },
    });
    if (!item) throw Object.assign(new Error('Item not found'), { statusCode: 404 });
    return item;
  }

  // ── Auto-generate a unique item code ─────────────────────────────────────────
  private async generateItemCode(companyId: string, categoryId?: string): Promise<string> {
    let prefix = 'ITEM';
    if (categoryId) {
      const cat = await this.prisma.itemCategory.findFirst({ where: { id: categoryId, companyId } });
      if (cat?.code) prefix = cat.code.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    const count = await this.prisma.item.count({ where: { companyId, code: { startsWith: prefix } } });
    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  }

  // ── Create ───────────────────────────────────────────────────────────────────
  async create(input: CreateItemInput, companyId?: string, userId?: string) {
    if (companyId) input.companyId = companyId;

    if (!input.code || input.code.trim() === '') {
      input.code = await this.generateItemCode(input.companyId, input.categoryId);
    }

    // Uniqueness check
    const existing = await this.prisma.item.findFirst({
      where: { companyId: input.companyId, code: input.code.toUpperCase().trim() },
    });
    if (existing) {
      throw Object.assign(new Error(`Item code '${input.code}' already exists`), { statusCode: 409 });
    }

    return this.prisma.item.create({
      data: {
        companyId: input.companyId,
        code: input.code.toUpperCase().trim(),
        description: input.description,
        shortDescription: input.shortDescription ?? null,
        categoryId: input.categoryId ?? null,
        uomId: input.uomId,
        grade1Options: input.grade1Options ?? ['NA'],
        grade2Options: input.grade2Options ?? ['NA'],
        reorderLevel: input.reorderLevel ?? 0,
        reorderQty: input.reorderQty ?? 0,
        minStock: input.minStock ?? 0,
        maxStock: input.maxStock ?? 0,
        standardCost: input.standardCost ?? 0,
        trackingType: (input.trackingType as any) ?? 'NONE',
        status: (input.status as ItemStatus) ?? 'ACTIVE',
      },
      include: { uom: true, category: true },
    });
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  async update(id: string, companyId: string, input: UpdateItemInput & { code?: string }) {
    const existing = await this.getById(id, companyId);
    return this.prisma.item.update({
      where: { id },
      data: {
        // Auto-generate code if item never got one
        ...(!existing.code && {
          code: (input.code?.trim())
            ? input.code.toUpperCase().trim()
            : await this.generateItemCode(existing.companyId, existing.categoryId ?? undefined),
        }),
        ...(input.description !== undefined    && { description: input.description }),
        ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
        ...(input.categoryId !== undefined     && { categoryId: input.categoryId }),
        ...(input.uomId !== undefined          && { uomId: input.uomId }),
        ...(input.grade1Options !== undefined  && { grade1Options: input.grade1Options }),
        ...(input.grade2Options !== undefined  && { grade2Options: input.grade2Options }),
        ...(input.reorderLevel !== undefined   && { reorderLevel: input.reorderLevel }),
        ...(input.reorderQty !== undefined     && { reorderQty: input.reorderQty }),
        ...(input.minStock !== undefined       && { minStock: input.minStock }),
        ...(input.maxStock !== undefined       && { maxStock: input.maxStock }),
        ...(input.standardCost !== undefined   && { standardCost: input.standardCost }),
        ...(input.trackingType !== undefined   && { trackingType: input.trackingType as any }),
        ...(input.status !== undefined         && { status: input.status as ItemStatus }),
      },
      include: { uom: true, category: true },
    });
  }

  // ── Delete (soft: set INACTIVE) ──────────────────────────────────────────────
  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);
    // Check if any stock exists
    const balance = await this.prisma.stockBalance.findFirst({
      where: { itemId: id, qtyOnHand: { gt: 0 } },
    });
    if (balance) {
      throw Object.assign(
        new Error('Cannot delete item with stock on hand. Set status to INACTIVE instead.'),
        { statusCode: 422 },
      );
    }
    return this.prisma.item.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  // ── Stock balance across all warehouses ──────────────────────────────────────
  async getItemStock(id: string, companyId: string) {
    await this.getById(id, companyId);

    const balances = await this.prisma.stockBalance.findMany({
      where: { itemId: id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        bin: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ warehouse: { code: 'asc' } }],
    });

    const totals = balances.reduce(
      (acc, b) => {
        const onHand   = Number(b.qtyOnHand);
        const reserved = Number(b.qtyReserved);
        const cost     = Number(b.avgCost);
        acc.totalOnHand   += onHand;
        acc.totalReserved += reserved;
        acc.totalAvailable += onHand - reserved;
        acc.totalValue    += onHand * cost;
        return acc;
      },
      { totalOnHand: 0, totalReserved: 0, totalAvailable: 0, totalValue: 0 },
    );

    return {
      balances: balances.map((b) => ({
        ...b,
        qtyOnHand:    Number(b.qtyOnHand),
        qtyReserved:  Number(b.qtyReserved),
        avgCost:      Number(b.avgCost),
        qtyAvailable: Number(b.qtyOnHand) - Number(b.qtyReserved),
        stockValue:   Number(b.qtyOnHand) * Number(b.avgCost),
      })),
      ...totals,
    };
  }

  // ── Quick search (for dropdowns / lookups) ────────────────────────────────────
  async search(companyId: string, q: string, limit = 20) {
    if (!q || q.length < 1) return [];
    return this.prisma.item.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [
          { code: { startsWith: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, code: true, description: true,
        uomId: true, uom: { select: { code: true, symbol: true } },
        standardCost: true,
      },
      take: limit,
      orderBy: { code: 'asc' },
    });
  }

  // ── Transaction history ──────────────────────────────────────────────────────
  async getTransactions(
    id: string,
    companyId: string,
    page = 1,
    limit = 50,
    dateFrom?: string,
    dateTo?: string,
  ) {
    await this.getById(id, companyId);

    const where: Prisma.StockMovementWhereInput = {
      itemId: id,
      companyId,
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59Z') }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: data.map((m) => ({
        ...m,
        qty:          Number(m.qty),
        avgCost:      Number(m.avgCost),
        balanceAfter: Number(m.balanceAfter),
      })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    };
  }

  // ── Reorder alerts ────────────────────────────────────────────────────────────
  async getReorderAlerts(companyId: string) {
    // Items where sum(qtyOnHand) <= reorderLevel
    const items = await this.prisma.item.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        uom: { select: { code: true, symbol: true } },
        stockBalances: { select: { qtyOnHand: true } },
      },
    });

    return items
      .map((item) => {
        const totalQty = item.stockBalances.reduce(
          (sum, b) => sum + Number(b.qtyOnHand), 0,
        );
        return {
          item: { id: item.id, code: item.code, description: item.description, status: item.status },
          uom: item.uom,
          qtyOnHand:    totalQty,
          reorderLevel: Number(item.reorderLevel),
          reorderQty:   Number(item.reorderQty),
          shortage:     Math.max(0, Number(item.reorderLevel) - totalQty),
        };
      })
      .filter((r) => r.qtyOnHand <= r.reorderLevel)
      .sort((a, b) => b.shortage - a.shortage);
  }

  // ── Supplier X-Ref ────────────────────────────────────────────────────────────
  async listSupplierXRefs(itemId: string, companyId: string) {
    await this.getById(itemId, companyId);
    return this.prisma.itemSupplierXRef.findMany({
      where: { itemId },
      include: { supplier: { select: { id: true, code: true, name: true } } },
      orderBy: [{ isPreferred: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async upsertSupplierXRef(
    itemId: string,
    companyId: string,
    rows: Array<{
      id?: string;
      supplierId: string;
      supplierCode?: string;
      supplierDesc?: string;
      uom?: string;
      unitPrice?: number;
      currency?: string;
      leadTimeDays?: number;
      minOrderQty?: number;
      isPreferred?: boolean;
      notes?: string;
    }>,
  ) {
    await this.getById(itemId, companyId);
    // Delete rows that are no longer in the list
    const keepIds = rows.filter((r) => r.id).map((r) => r.id as string);
    await this.prisma.itemSupplierXRef.deleteMany({
      where: { itemId, id: { notIn: keepIds } },
    });
    // Upsert each row
    for (const row of rows) {
      if (row.id) {
        await this.prisma.itemSupplierXRef.update({
          where: { id: row.id },
          data: {
            supplierId:   row.supplierId,
            supplierCode: row.supplierCode ?? null,
            supplierDesc: row.supplierDesc ?? null,
            uom:          row.uom ?? null,
            unitPrice:    row.unitPrice ?? null,
            currency:     row.currency ?? null,
            leadTimeDays: row.leadTimeDays ?? 0,
            minOrderQty:  row.minOrderQty ?? null,
            isPreferred:  row.isPreferred ?? false,
            notes:        row.notes ?? null,
          },
        });
      } else {
        await this.prisma.itemSupplierXRef.create({
          data: {
            itemId,
            supplierId:   row.supplierId,
            supplierCode: row.supplierCode ?? null,
            supplierDesc: row.supplierDesc ?? null,
            uom:          row.uom ?? null,
            unitPrice:    row.unitPrice ?? null,
            currency:     row.currency ?? null,
            leadTimeDays: row.leadTimeDays ?? 0,
            minOrderQty:  row.minOrderQty ?? null,
            isPreferred:  row.isPreferred ?? false,
            notes:        row.notes ?? null,
          },
        });
      }
    }
    return this.listSupplierXRefs(itemId, companyId);
  }

  async deleteSupplierXRef(xrefId: string, itemId: string, companyId: string) {
    await this.getById(itemId, companyId);
    await this.prisma.itemSupplierXRef.deleteMany({ where: { id: xrefId, itemId } });
  }

  // ── Attachments ───────────────────────────────────────────────────────────────
  async listAttachments(itemId: string, companyId: string) {
    await this.getById(itemId, companyId);
    return this.prisma.itemAttachment.findMany({
      where: { itemId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async addAttachment(
    itemId: string,
    companyId: string,
    userId: string,
    data: { fileName: string; url: string; fileSize?: number; mimeType?: string; description?: string },
  ) {
    await this.getById(itemId, companyId);
    return this.prisma.itemAttachment.create({
      data: {
        itemId,
        fileName:    data.fileName,
        url:         data.url,
        fileSize:    data.fileSize ?? null,
        mimeType:    data.mimeType ?? null,
        description: data.description ?? null,
        uploadedById: userId,
      },
    });
  }

  async deleteAttachment(attachmentId: string, itemId: string, companyId: string) {
    await this.getById(itemId, companyId);
    await this.prisma.itemAttachment.updateMany({
      where: { id: attachmentId, itemId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // ── Item categories CRUD ──────────────────────────────────────────────────────
  async listCategories(companyId: string) {
    return this.prisma.itemCategory.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }

  async createCategory(companyId: string, code: string, name: string, parentId?: string) {
    const existing = await this.prisma.itemCategory.findFirst({
      where: { companyId, code },
    });
    if (existing) {
      throw Object.assign(new Error(`Category code '${code}' already exists`), { statusCode: 409 });
    }
    return this.prisma.itemCategory.create({
      data: { companyId, code, name, parentId: parentId ?? null },
    });
  }

  // ── UOM list ──────────────────────────────────────────────────────────────────
  async listUoms(companyId: string) {
    return this.prisma.uom.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }
}
