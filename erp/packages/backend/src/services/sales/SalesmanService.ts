import { PrismaClient, Prisma } from '@prisma/client';

export type SalesmanTypeInput = 'SALESMAN' | 'SUPERVISOR' | 'VAN_SALESMAN' | 'MANAGER';

export interface CreateSalesmanInput {
  companyId: string;
  code?: string;
  name: string;
  shortName?: string | null;
  type?: SalesmanTypeInput;
  minMarkupPct?: number;
  maxVariancePct?: number;
  locationId?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  userId?: string | null;
  isActive?: boolean;
}

export type UpdateSalesmanInput = Partial<Omit<CreateSalesmanInput, 'companyId'>>;

function notFound(msg = 'Salesman not found') {
  return Object.assign(new Error(msg), { statusCode: 404 });
}
function invalid(msg: string) {
  return Object.assign(new Error(msg), { statusCode: 422 });
}

/**
 * Salesman master. A salesman is mapped to a customer (and, for group
 * companies, per company on the customer's company-terms grid) and carries the
 * markup / variance limits used when pricing a sales document.
 */
export class SalesmanService {
  constructor(private prisma: PrismaClient) {}

  async list(companyId: string, opts: { search?: string; isActive?: boolean } = {}) {
    const where: Prisma.SalesmanWhereInput = { companyId };
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    if (opts.search) {
      where.OR = [
        { code: { contains: opts.search, mode: 'insensitive' } },
        { name: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.salesman.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        location: { select: { code: true, name: true } },
        _count: { select: { customers: true } },
      },
    });
    return rows.map((r) => this.shape(r));
  }

  async search(companyId: string, q: string, limit = 20) {
    return this.prisma.salesman.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }],
      },
      select: { id: true, code: true, name: true },
      take: limit,
      orderBy: { code: 'asc' },
    });
  }

  async getById(id: string, companyId: string) {
    const row = await this.prisma.salesman.findFirst({
      where: { id, companyId },
      include: {
        location: { select: { code: true, name: true } },
        _count: { select: { customers: true } },
      },
    });
    if (!row) throw notFound();
    return this.shape(row);
  }

  async create(input: CreateSalesmanInput, userId: string) {
    await this.validateRefs(input.companyId, input);
    const type = input.type ?? 'SALESMAN';
    const code = input.code?.trim() || (await this.nextCode(input.companyId));
    const clash = await this.prisma.salesman.findFirst({ where: { companyId: input.companyId, code }, select: { id: true } });
    if (clash) throw Object.assign(new Error(`Salesman code "${code}" already exists`), { statusCode: 409 });

    const row = await this.prisma.salesman.create({
      data: {
        companyId: input.companyId,
        code,
        name: input.name,
        shortName: input.shortName ?? null,
        type: type as any,
        minMarkupPct: new Prisma.Decimal(input.minMarkupPct ?? 0),
        maxVariancePct: new Prisma.Decimal(input.maxVariancePct ?? 0),
        locationId: type === 'VAN_SALESMAN' ? input.locationId ?? null : null,
        contactNumber: input.contactNumber ?? null,
        email: input.email ?? null,
        userId: input.userId ?? null,
        isActive: input.isActive ?? true,
      },
    });
    await this.audit('CREATE', row.id, userId, { code: row.code, name: row.name });
    return this.getById(row.id, input.companyId);
  }

  async update(id: string, companyId: string, input: UpdateSalesmanInput, userId: string) {
    const existing = await this.prisma.salesman.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    await this.validateRefs(companyId, input);
    const nextType = (input.type ?? existing.type) as SalesmanTypeInput;

    await this.prisma.salesman.update({
      where: { id },
      data: {
        name: input.name,
        shortName: input.shortName,
        minMarkupPct: input.minMarkupPct !== undefined ? new Prisma.Decimal(input.minMarkupPct) : undefined,
        maxVariancePct: input.maxVariancePct !== undefined ? new Prisma.Decimal(input.maxVariancePct) : undefined,
        type: nextType as any,
        locationId: nextType === 'VAN_SALESMAN' ? input.locationId ?? existing.locationId : null,
        contactNumber: input.contactNumber,
        email: input.email,
        userId: input.userId,
        isActive: input.isActive,
      },
    });
    await this.audit('UPDATE', id, userId, { name: input.name ?? existing.name });
    return this.getById(id, companyId);
  }

  async toggleActive(id: string, companyId: string, userId: string) {
    const row = await this.prisma.salesman.findFirst({ where: { id, companyId } });
    if (!row) throw notFound();
    const updated = await this.prisma.salesman.update({ where: { id }, data: { isActive: !row.isActive } });
    await this.audit('UPDATE', id, userId, { isActive: updated.isActive });
    return this.getById(id, companyId);
  }

  async remove(id: string, companyId: string, userId: string) {
    const row = await this.prisma.salesman.findFirst({
      where: { id, companyId },
      include: { _count: { select: { customers: true, salesOrders: true, customerTerms: true } } },
    });
    if (!row) throw notFound();
    const used = row._count.customers + row._count.salesOrders + row._count.customerTerms;
    if (used > 0) throw Object.assign(new Error('Salesman is in use — deactivate instead of deleting'), { statusCode: 409 });
    await this.prisma.salesman.delete({ where: { id } });
    await this.audit('DELETE', id, userId, { code: row.code });
    return { ok: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private shape(r: any) {
    return {
      id: r.id,
      companyId: r.companyId,
      code: r.code,
      name: r.name,
      shortName: r.shortName,
      type: r.type,
      minMarkupPct: Number(r.minMarkupPct),
      maxVariancePct: Number(r.maxVariancePct),
      locationId: r.locationId,
      locationName: r.location ? `${r.location.code} — ${r.location.name}` : null,
      contactNumber: r.contactNumber,
      email: r.email,
      userId: r.userId,
      isActive: r.isActive,
      customerCount: r._count?.customers ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private async validateRefs(companyId: string, input: CreateSalesmanInput | UpdateSalesmanInput) {
    if (input.locationId) {
      const loc = await this.prisma.location.findFirst({ where: { id: input.locationId, companyId } });
      if (!loc) throw invalid('Location not found');
    }
    if (input.userId) {
      const u = await this.prisma.user.findFirst({ where: { id: input.userId, companyId } });
      if (!u) throw invalid('User not found');
    }
  }

  private async nextCode(companyId: string): Promise<string> {
    const count = await this.prisma.salesman.count({ where: { companyId, code: { startsWith: 'SM' } } });
    let n = count + 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const code = `SM${String(n).padStart(4, '0')}`;
      const exists = await this.prisma.salesman.findFirst({ where: { companyId, code }, select: { id: true } });
      if (!exists) return code;
      n += 1;
    }
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'salesmen', recordId, userId, action, newValues: values } });
  }
}
