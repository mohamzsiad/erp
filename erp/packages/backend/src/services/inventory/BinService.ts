import { PrismaClient } from '@prisma/client';

export class BinService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(warehouseId: string, companyId: string) {
    // Verify warehouse belongs to company
    const wh = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });

    return this.prisma.bin.findMany({
      where: { warehouseId },
      orderBy: { code: 'asc' },
    });
  }

  async getById(id: string, companyId: string) {
    const bin = await this.prisma.bin.findFirst({
      where: { id, warehouse: { companyId } },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
    if (!bin) throw Object.assign(new Error('Bin not found'), { statusCode: 404 });
    return bin;
  }

  async create(warehouseId: string, companyId: string, input: { code: string; name: string; capacity?: number }) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });

    const existing = await this.prisma.bin.findFirst({ where: { warehouseId, code: input.code } });
    if (existing) {
      throw Object.assign(new Error(`Bin code '${input.code}' already exists in this warehouse`), { statusCode: 409 });
    }

    return this.prisma.bin.create({
      data: { warehouseId, code: input.code, name: input.name, capacity: input.capacity ?? null },
    });
  }

  async update(id: string, companyId: string, input: { name?: string; capacity?: number | null }) {
    await this.getById(id, companyId);
    return this.prisma.bin.update({ where: { id }, data: input });
  }

  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);
    const hasStock = await this.prisma.stockBalance.findFirst({
      where: { binId: id, qtyOnHand: { gt: 0 } },
    });
    if (hasStock) {
      throw Object.assign(new Error('Cannot delete bin with stock on hand'), { statusCode: 422 });
    }
    return this.prisma.bin.delete({ where: { id } });
  }
}
