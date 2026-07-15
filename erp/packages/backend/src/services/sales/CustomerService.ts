import { PrismaClient, Prisma } from '@prisma/client';

// Credit limit above which a new customer requires Credit Controller approval
// before it becomes active. (Kept as a constant here; can be moved to
// Company.salesConfig later.)
const CREDIT_APPROVAL_THRESHOLD = 100000;

export interface UpsertContactInput {
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
}

export interface UpsertAddressInput {
  type: 'BILL_TO' | 'SHIP_TO';
  line1: string;
  line2?: string | null;
  city?: string | null;
  country?: string | null;
  isDefault?: boolean;
}

export interface CreateCustomerInput {
  companyId: string;
  code?: string;
  name: string;
  tradeName?: string | null;
  type?: 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
  trn?: string | null;
  defaultTaxCodeId?: string | null;
  isTaxExempt?: boolean;
  paymentTerms?: string | null;
  creditLimit?: number;
  creditHold?: boolean;
  priceListId?: string | null;
  salespersonId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  contacts?: UpsertContactInput[];
  addresses?: UpsertAddressInput[];
}

export type UpdateCustomerInput = Partial<Omit<CreateCustomerInput, 'companyId'>> & {
  isActive?: boolean;
};

export interface ListCustomersQuery {
  companyId: string;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  creditHold?: boolean;
  page?: number;
  limit?: number;
}

function notFound(msg = 'Customer not found') {
  return Object.assign(new Error(msg), { statusCode: 404 });
}

export class CustomerService {
  constructor(private prisma: PrismaClient) {}

  // ── List (paginated + search + filters) ────────────────────────────────────
  async list(query: ListCustomersQuery) {
    const { companyId, search, categoryId, isActive, creditHold, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = { companyId };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { tradeName: { contains: search, mode: 'insensitive' } },
        { trn: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;
    if (creditHold !== undefined) where.creditHold = creditHold;

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          tradeName: true,
          type: true,
          trn: true,
          paymentTerms: true,
          creditLimit: true,
          creditHold: true,
          isActive: true,
          categoryId: true,
          category: { select: { name: true } },
          createdAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const data = rows.map((c) => ({
      ...c,
      creditLimit: Number(c.creditLimit),
      categoryName: c.category?.name ?? null,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Quick search for lookup dropdowns ──────────────────────────────────────
  async search(companyId: string, q: string, limit = 20) {
    return this.prisma.customer.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, name: true },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  // ── Get by id (with contacts + addresses) ──────────────────────────────────
  async getById(id: string, companyId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        addresses: { orderBy: { isDefault: 'desc' } },
        category: { select: { id: true, name: true } },
      },
    });
    if (!customer) throw notFound();
    return { ...customer, creditLimit: Number(customer.creditLimit) };
  }

  // ── Duplicate detection (warn, not block) ──────────────────────────────────
  async findDuplicates(companyId: string, name: string, trn?: string | null, excludeId?: string) {
    const or: Prisma.CustomerWhereInput[] = [{ name: { equals: name, mode: 'insensitive' } }];
    if (trn) or.push({ trn: { equals: trn, mode: 'insensitive' } });
    const dups = await this.prisma.customer.findMany({
      where: { companyId, id: excludeId ? { not: excludeId } : undefined, OR: or },
      select: { id: true, code: true, name: true, trn: true },
      take: 5,
    });
    return dups;
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(input: CreateCustomerInput, userId: string) {
    await this.validateRefs(input.companyId, input);

    const code = input.code?.trim() || (await this.generateCustomerCode(input.companyId));

    // Unique code guard
    const clash = await this.prisma.customer.findFirst({
      where: { companyId: input.companyId, code },
      select: { id: true },
    });
    if (clash) throw Object.assign(new Error(`Customer code "${code}" already exists`), { statusCode: 409 });

    const warnings = await this.findDuplicates(input.companyId, input.name, input.trn ?? null);

    const creditLimit = input.creditLimit ?? 0;
    // Onboarding: high credit limit -> created inactive (pending Credit Controller approval)
    const needsCreditApproval = creditLimit > CREDIT_APPROVAL_THRESHOLD;

    const customer = await this.prisma.customer.create({
      data: {
        companyId: input.companyId,
        code,
        name: input.name,
        tradeName: input.tradeName ?? null,
        type: (input.type ?? 'COMPANY') as any,
        trn: input.trn ?? null,
        defaultTaxCodeId: input.defaultTaxCodeId ?? null,
        isTaxExempt: input.isTaxExempt ?? false,
        paymentTerms: input.paymentTerms ?? null,
        creditLimit,
        creditHold: input.creditHold ?? false,
        priceListId: input.priceListId ?? null,
        salespersonId: input.salespersonId ?? null,
        categoryId: input.categoryId ?? null,
        notes: input.notes ?? null,
        isActive: !needsCreditApproval,
        contacts: input.contacts?.length
          ? { createMany: { data: input.contacts.map((c) => ({
              name: c.name, role: c.role ?? null, email: c.email ?? null,
              phone: c.phone ?? null, isPrimary: c.isPrimary ?? false,
            })) } }
          : undefined,
        addresses: input.addresses?.length
          ? { createMany: { data: input.addresses.map((a) => ({
              type: a.type as any, line1: a.line1, line2: a.line2 ?? null,
              city: a.city ?? null, country: a.country ?? null, isDefault: a.isDefault ?? false,
            })) } }
          : undefined,
      },
      include: { contacts: true, addresses: true },
    });

    await this.audit('CREATE', customer.id, userId, { code: customer.code, name: customer.name });

    if (needsCreditApproval) {
      await this.notifyCreditApproval(customer.id, customer.name, creditLimit);
    }

    return {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      pendingCreditApproval: needsCreditApproval,
      warnings,
    };
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(id: string, companyId: string, input: UpdateCustomerInput, userId: string) {
    const existing = await this.prisma.customer.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    await this.validateRefs(companyId, input);

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        name: input.name,
        tradeName: input.tradeName,
        type: input.type as any,
        trn: input.trn,
        defaultTaxCodeId: input.defaultTaxCodeId,
        isTaxExempt: input.isTaxExempt,
        paymentTerms: input.paymentTerms,
        creditLimit: input.creditLimit,
        creditHold: input.creditHold,
        priceListId: input.priceListId,
        salespersonId: input.salespersonId,
        categoryId: input.categoryId,
        notes: input.notes,
        isActive: input.isActive,
      },
    });

    // Replace contacts / addresses when provided
    if (input.contacts !== undefined) {
      await this.prisma.customerContact.deleteMany({ where: { customerId: id } });
      if (input.contacts.length) {
        await this.prisma.customerContact.createMany({
          data: input.contacts.map((c) => ({
            customerId: id, name: c.name, role: c.role ?? null,
            email: c.email ?? null, phone: c.phone ?? null, isPrimary: c.isPrimary ?? false,
          })),
        });
      }
    }
    if (input.addresses !== undefined) {
      await this.prisma.customerAddress.deleteMany({ where: { customerId: id } });
      if (input.addresses.length) {
        await this.prisma.customerAddress.createMany({
          data: input.addresses.map((a) => ({
            customerId: id, type: a.type as any, line1: a.line1, line2: a.line2 ?? null,
            city: a.city ?? null, country: a.country ?? null, isDefault: a.isDefault ?? false,
          })),
        });
      }
    }

    await this.audit('UPDATE', id, userId, { before: existing.name, after: input.name ?? existing.name });
    return { ...updated, creditLimit: Number(updated.creditLimit) };
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  async toggleActive(id: string, companyId: string, userId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, companyId } });
    if (!c) throw notFound();
    const updated = await this.prisma.customer.update({ where: { id }, data: { isActive: !c.isActive } });
    await this.audit('UPDATE', id, userId, { isActive: updated.isActive });
    return { ...updated, creditLimit: Number(updated.creditLimit) };
  }

  // ── Set / release credit hold (Credit Controller) ──────────────────────────
  async setCreditHold(id: string, companyId: string, hold: boolean, userId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, companyId } });
    if (!c) throw notFound();
    const updated = await this.prisma.customer.update({ where: { id }, data: { creditHold: hold } });
    await this.audit('UPDATE', id, userId, { creditHold: hold });
    return { ...updated, creditLimit: Number(updated.creditLimit) };
  }

  // ── Approve onboarding (activate a pending customer) ───────────────────────
  async approveOnboarding(id: string, companyId: string, userId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, companyId } });
    if (!c) throw notFound();
    const updated = await this.prisma.customer.update({ where: { id }, data: { isActive: true } });
    await this.audit('UPDATE', id, userId, { approved: true });
    return { ...updated, creditLimit: Number(updated.creditLimit) };
  }

  // ── Financial summary (from AR + open sales orders) ────────────────────────
  async financialSummary(id: string, companyId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
      select: { id: true, creditLimit: true },
    });
    if (!customer) throw notFound();

    const invoices = await this.prisma.arInvoice.findMany({
      where: { companyId, customerId: id },
      select: { totalAmount: true, paidAmount: true, dueDate: true, status: true },
    });

    const today = new Date();
    let outstandingBalance = 0;
    let overdueAmount = 0;
    for (const inv of invoices) {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED') continue;
      const bal = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (bal <= 0) continue;
      outstandingBalance += bal;
      if (inv.dueDate < today) overdueAmount += bal;
    }

    const openOrders = await this.prisma.salesOrder.findMany({
      where: {
        companyId,
        customerId: id,
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'CREDIT_HOLD', 'IN_PROGRESS'] },
      },
      select: { totalAmount: true },
    });
    const openOrderValue = openOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

    const creditLimit = Number(customer.creditLimit);
    const availableCredit = creditLimit - (outstandingBalance + openOrderValue);

    return {
      customerId: id,
      creditLimit,
      outstandingBalance: round(outstandingBalance),
      overdueAmount: round(overdueAmount),
      openOrderValue: round(openOrderValue),
      availableCredit: round(availableCredit),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private async validateRefs(companyId: string, input: CreateCustomerInput | UpdateCustomerInput) {
    if (input.defaultTaxCodeId) {
      const tc = await this.prisma.taxCode.findFirst({ where: { id: input.defaultTaxCodeId, companyId } });
      if (!tc) throw Object.assign(new Error('Tax code not found'), { statusCode: 422 });
    }
    if (input.priceListId) {
      const pl = await this.prisma.priceList.findFirst({ where: { id: input.priceListId, companyId } });
      if (!pl) throw Object.assign(new Error('Price list not found'), { statusCode: 422 });
    }
    if (input.categoryId) {
      const cat = await this.prisma.customerCategory.findFirst({ where: { id: input.categoryId, companyId } });
      if (!cat) throw Object.assign(new Error('Customer category not found'), { statusCode: 422 });
    }
  }

  private async generateCustomerCode(companyId: string): Promise<string> {
    const count = await this.prisma.customer.count({
      where: { companyId, code: { startsWith: 'CUST' } },
    });
    // Find a free code (guards against gaps / manual codes colliding)
    let n = count + 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const code = `CUST${String(n).padStart(4, '0')}`;
      const exists = await this.prisma.customer.findFirst({ where: { companyId, code }, select: { id: true } });
      if (!exists) return code;
      n += 1;
    }
  }

  private async notifyCreditApproval(customerId: string, name: string, creditLimit: number) {
    // Notify all users who can perform credit control (via CREDIT_CONTROL permission)
    const approvers = await this.prisma.user.findMany({
      where: {
        role: { permissions: { some: { module: 'SALES', resource: 'CREDIT_CONTROL' } } },
      },
      select: { id: true },
    });
    if (!approvers.length) return;
    await this.prisma.notification.createMany({
      data: approvers.map((u) => ({
        userId: u.id,
        type: 'CREDIT_APPROVAL',
        title: 'Customer credit approval required',
        message: `Customer "${name}" has a credit limit of ${creditLimit} and needs approval before activation.`,
        docType: 'CUSTOMER',
        docId: customerId,
      })),
    });
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({
      data: { tableName: 'customers', recordId, userId, action, newValues: values },
    });
  }
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
