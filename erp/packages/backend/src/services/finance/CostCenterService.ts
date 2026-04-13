import { PrismaClient } from '@prisma/client';

export class CostCenterService {
  constructor(private prisma: PrismaClient) {}

  async list(companyId: string, params: { isActive?: boolean; search?: string }) {
    const where: any = { companyId };
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.costCenter.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { parent: { select: { code: true, name: true } } },
    });
  }

  async tree(companyId: string) {
    const all = await this.prisma.costCenter.findMany({ where: { companyId }, orderBy: { code: 'asc' } });
    const map = new Map<string, any>();
    all.forEach((c) => map.set(c.id, { ...c, children: [] }));
    const roots: any[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  async search(companyId: string, q: string) {
    return this.prisma.costCenter.findMany({
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
    });
  }

  async getById(id: string, companyId: string) {
    const cc = await this.prisma.costCenter.findFirst({ where: { id, companyId } });
    if (!cc) throw Object.assign(new Error('Cost Center not found'), { statusCode: 404 });
    return cc;
  }

  async create(companyId: string, data: { code: string; name: string; parentId?: string; budgetHolderId?: string }) {
    const existing = await this.prisma.costCenter.findFirst({ where: { companyId, code: data.code } });
    if (existing) throw Object.assign(new Error(`Cost center code ${data.code} already exists`), { statusCode: 409 });
    return this.prisma.costCenter.create({ data: { companyId, ...data } });
  }

  async update(id: string, companyId: string, data: { name?: string; parentId?: string; budgetHolderId?: string; isActive?: boolean }) {
    await this.getById(id, companyId);
    return this.prisma.costCenter.update({ where: { id }, data });
  }

  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);
    const hasChildren = await this.prisma.costCenter.count({ where: { parentId: id } });
    if (hasChildren > 0) throw Object.assign(new Error('Cannot delete cost center with children'), { statusCode: 409 });
    return this.prisma.costCenter.delete({ where: { id } });
  }

  // ── Budget status for current period ───────────────────────────────────────
  async getBudgetStatus(id: string, companyId: string) {
    await this.getById(id, companyId);
    const now = new Date();
    const periodYear = now.getFullYear();
    const periodMonth = now.getMonth() + 1;

    const budgetPeriods = await this.prisma.budgetPeriod.findMany({
      where: {
        periodYear,
        periodMonth,
        budget: { companyId, costCenterId: id },
      },
      include: { budget: { include: { account: { select: { code: true, name: true, accountType: true } } } } },
    });

    const totals = budgetPeriods.reduce(
      (acc, bp) => ({
        budgeted: acc.budgeted + Number(bp.budgetedAmount),
        actual: acc.actual + Number(bp.actualAmount),
      }),
      { budgeted: 0, actual: 0 }
    );

    return {
      costCenterId: id,
      period: `${periodYear}-${String(periodMonth).padStart(2, '0')}`,
      budgeted: totals.budgeted,
      actual: totals.actual,
      variance: totals.budgeted - totals.actual,
      variancePct: totals.budgeted !== 0
        ? ((totals.budgeted - totals.actual) / totals.budgeted) * 100
        : 0,
      lines: budgetPeriods.map((bp) => ({
        accountCode: (bp.budget as any).account?.code,
        accountName: (bp.budget as any).account?.name,
        budgeted: Number(bp.budgetedAmount),
        actual: Number(bp.actualAmount),
      })),
    };
  }
}
