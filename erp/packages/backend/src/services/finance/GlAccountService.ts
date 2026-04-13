import { PrismaClient } from '@prisma/client';

export class GlAccountService {
  constructor(private prisma: PrismaClient) {}

  // ── List ───────────────────────────────────────────────────────────────────
  async list(companyId: string, params: { accountType?: string; isActive?: boolean; search?: string }) {
    const where: any = { companyId };
    if (params.accountType) where.accountType = params.accountType;
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.glAccount.findMany({ where, orderBy: [{ accountType: 'asc' }, { code: 'asc' }] });
  }

  // ── Tree ───────────────────────────────────────────────────────────────────
  async tree(companyId: string) {
    const all = await this.prisma.glAccount.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
    const map = new Map<string, any>();
    all.forEach((a) => map.set(a.id, { ...a, children: [] }));
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

  // ── Search (for lookup fields) ─────────────────────────────────────────────
  async search(companyId: string, q: string, leafOnly = false) {
    const where: any = {
      companyId,
      isActive: true,
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (leafOnly) where.children = { none: {} };
    return this.prisma.glAccount.findMany({ where, take: 20, orderBy: { code: 'asc' } });
  }

  // ── Get by ID ──────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const acc = await this.prisma.glAccount.findFirst({ where: { id, companyId } });
    if (!acc) throw Object.assign(new Error('GL Account not found'), { statusCode: 404 });
    return acc;
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(companyId: string, data: {
    code: string; name: string; accountType: string; parentId?: string;
    isControl?: boolean; currencyId?: string;
  }) {
    const existing = await this.prisma.glAccount.findFirst({ where: { companyId, code: data.code } });
    if (existing) throw Object.assign(new Error(`Account code ${data.code} already exists`), { statusCode: 409 });
    return this.prisma.glAccount.create({
      data: { companyId, ...data, accountType: data.accountType as any },
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(id: string, companyId: string, data: {
    name?: string; isControl?: boolean; isActive?: boolean; currencyId?: string; parentId?: string;
  }) {
    await this.getById(id, companyId);
    return this.prisma.glAccount.update({ where: { id }, data });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);
    const hasJournals = await this.prisma.journalLine.count({ where: { accountId: id } });
    if (hasJournals > 0) {
      throw Object.assign(
        new Error('Cannot delete account with posted journal entries. Deactivate instead.'),
        { statusCode: 409 }
      );
    }
    const hasChildren = await this.prisma.glAccount.count({ where: { parentId: id } });
    if (hasChildren > 0) {
      throw Object.assign(new Error('Cannot delete account with child accounts'), { statusCode: 409 });
    }
    return this.prisma.glAccount.delete({ where: { id } });
  }
}
