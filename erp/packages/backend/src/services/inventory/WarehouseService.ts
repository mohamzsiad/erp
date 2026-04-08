import { PrismaClient } from '@prisma/client';

export class WarehouseService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(companyId: string, includeInactive = false) {
    return this.prisma.warehouse.findMany({
      where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
      include: { location: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async getById(id: string, companyId: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id, companyId },
      include: {
        location: { select: { id: true, code: true, name: true } },
        bins: { orderBy: { code: 'asc' } },
      },
    });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
    return wh;
  }

  async create(companyId: string, input: { code: string; name: string; locationId: string }) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId, code: input.code },
    });
    if (existing) {
      throw Object.assign(new Error(`Warehouse code '${input.code}' already exists`), { statusCode: 409 });
    }
    return this.prisma.warehouse.create({
      data: { companyId, ...input },
      include: { location: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, companyId: string, input: { name?: string; locationId?: string; isActive?: boolean }) {
    await this.getById(id, companyId);
    return this.prisma.warehouse.update({
      where: { id },
      data: input,
      include: { location: { select: { id: true, code: true, name: true } } },
    });
  }

  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);
    const hasStock = await this.prisma.stockBalance.findFirst({
      where: { warehouseId: id, qtyOnHand: { gt: 0 } },
    });
    if (hasStock) {
      throw Object.assign(
        new Error('Cannot delete warehouse with stock on hand'),
        { statusCode: 422 },
      );
    }
    // Soft delete
    return this.prisma.warehouse.update({ where: { id }, data: { isActive: false } });
  }

  // ── Stock summary for a warehouse ─────────────────────────────────────────────
  async getStockSummary(id: string, companyId: string) {
    await this.getById(id, companyId);

    const balances = await this.prisma.stockBalance.findMany({
      where: { warehouseId: id },
      include: { item: { select: { id: true, code: true, description: true } } },
    });

    const totalItems      = new Set(balances.map((b) => b.itemId)).size;
    const totalQtyOnHand  = balances.reduce((s, b) => s + Number(b.qtyOnHand), 0);
    const totalStockValue = balances.reduce(
      (s, b) => s + Number(b.qtyOnHand) * Number(b.avgCost), 0,
    );

    const topItems = balances
      .map((b) => ({
        itemCode:    b.item.code,
        description: b.item.description,
        qtyOnHand:   Number(b.qtyOnHand),
        stockValue:  Number(b.qtyOnHand) * Number(b.avgCost),
      }))
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 10);

    return { warehouseId: id, totalItems, totalQtyOnHand, totalStockValue, topItems };
  }
}
