import { PrismaClient } from '@prisma/client';

export class CostCodeService {
  constructor(private prisma: PrismaClient) {}

  async list(companyId: string, params: { isActive?: boolean; search?: string; costCenterId?: string }) {
    const where: any = { companyId };
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.costCenterId) where.costCenterId = params.costCenterId;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.costCode.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { costCenter: { select: { code: true, name: true } } },
    });
  }

  async search(companyId: string, q: string) {
    return this.prisma.costCode.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { code: 'asc' },
      include: { costCenter: { select: { code: true, name: true } } },
    });
  }

  async getById(id: string, companyId: string) {
    const cc = await this.prisma.costCode.findFirst({ where: { id, companyId } });
    if (!cc) throw Object.assign(new Error('Cost Code not found'), { statusCode: 404 });
    return cc;
  }

  async create(companyId: string, data: { code: string; name: string; costCenterId?: string; type?: string }) {
    const existing = await this.prisma.costCode.findFirst({ where: { companyId, code: data.code } });
    if (existing) throw Object.assign(new Error(`Cost code ${data.code} already exists`), { statusCode: 409 });
    return this.prisma.costCode.create({
      data: { companyId, ...data, type: (data.type ?? 'COST_CENTER') as any },
    });
  }

  async update(id: string, companyId: string, data: { name?: string; costCenterId?: string; isActive?: boolean }) {
    await this.getById(id, companyId);
    return this.prisma.costCode.update({ where: { id }, data });
  }

  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);
    return this.prisma.costCode.delete({ where: { id } });
  }
}
