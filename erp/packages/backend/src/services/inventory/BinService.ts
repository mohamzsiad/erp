import { PrismaClient } from '@prisma/client';

export class BinService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(opts: { companyId: string; warehouseId?: string; search?: string; page?: number; limit?: number }) {
    const { companyId, warehouseId, search } = opts;

    if (warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
      if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
    }

    return this.prisma.bin.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : { warehouse: { companyId } }),
        ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : {}),
      },
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

  async create(input: { warehouseId: string; code: string; name: string; capacity?: number }, companyId: string) {
    const { warehouseId, code, name, capacity } = input;
    const wh = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });

    const existing = await this.prisma.bin.findFirst({ where: { warehouseId, code } });
    if (existing) {
      throw Object.assign(new Error(`Bin code '${code}' already exists in this warehouse`), { statusCode: 409 });
    }

    return this.prisma.bin.create({
      data: { warehouseId, code, name, capacity: capacity ?? null },
    });
  }

  async update(id: string, input: { name?: string; capacity?: number | null }, companyId: string) {
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
