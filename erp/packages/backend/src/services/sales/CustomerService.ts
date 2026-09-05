import { PrismaClient, Prisma } from '@prisma/client';
import { deriveShortName, validateVatNumber } from '@clouderp/shared';

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
  name?: string | null;
  line1: string;
  line2?: string | null;
  line3?: string | null;
  line4?: string | null;
  line5?: string | null;
  countryId?: string | null;
  country?: string | null;
  cityId?: string | null;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  // Contact details live on the address (bill-to and ship-to each carry their own)
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  // Statutory registration numbers
  vatNo?: string | null;
  crNo?: string | null;
  taxCardNo?: string | null;
  isDefault?: boolean;
}

/** Company-wise commercial terms for a customer of a group company. */
export interface UpsertCustomerCompanyInput {
  companyId: string;
  salesmanId?: string | null;
  priceListId?: string | null;
  paymentTermId?: string | null;
  creditLimit?: number;
  creditExposureLimit?: number;
  closeToExpiryDays?: number | null;
  isBlackListed?: boolean;
  isGreyListed?: boolean;
  isActive?: boolean;
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
  paymentTermId?: string | null;
  currencyId?: string | null;
  creditLimit?: number;
  creditHold?: boolean;
  isBlackListed?: boolean;
  priceListId?: string | null;
  salespersonId?: string | null;
  salesmanId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  contacts?: UpsertContactInput[];
  addresses?: UpsertAddressInput[];
  companyTerms?: UpsertCustomerCompanyInput[];
  /** Currencies this customer may transact in; the first is the default. */
  currencyIds?: string[];
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
          paymentTerms: true,
          creditLimit: true,
          creditHold: true,
          isBlackListed: true,
          isActive: true,
          categoryId: true,
          category: { select: { name: true } },
          salesmanId: true,
          salesman: { select: { code: true, name: true } },
          createdAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const data = rows.map((c) => ({
      ...c,
      creditLimit: Number(c.creditLimit),
      categoryName: c.category?.name ?? null,
      salesmanName: c.salesman ? `${c.salesman.code} — ${c.salesman.name}` : null,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Companies in the group — the selectable rows of the company-terms grid. */
  async listGroupCompanies() {
    return this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, baseCurrency: true },
      orderBy: { code: 'asc' },
    });
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

  // ── Get by id (addresses carry their own contact details) ──────────────────
  async getById(id: string, companyId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        addresses: {
          orderBy: [{ type: 'asc' }, { isDefault: 'desc' }],
          include: {
            countryMaster: { select: { code: true, name: true, vatPrefix: true, vatLength: true } },
            cityMaster: { select: { code: true, name: true } },
          },
        },
        category: { select: { id: true, name: true } },
        salesman: { select: { id: true, code: true, name: true } },
        paymentTerm: { select: { id: true, code: true, name: true, creditDays: true } },
        currency: { select: { id: true, code: true, name: true } },
        currencies: { include: { currency: { select: { id: true, code: true, name: true } } } },
        priceList: { select: { id: true, code: true, name: true, type: true } },
        companyTerms: {
          orderBy: { companyId: 'asc' },
          include: {
            company: { select: { code: true, name: true } },
            salesman: { select: { code: true, name: true } },
            priceList: { select: { name: true } },
            paymentTerm: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!customer) throw notFound();
    return {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      salesmanName: customer.salesman ? `${customer.salesman.code} — ${customer.salesman.name}` : null,
      paymentTermName: customer.paymentTerm?.name ?? customer.paymentTerms ?? null,
      currencyCode: customer.currency?.code ?? null,
      priceListLabel: customer.priceList ? `${customer.priceList.code} — ${customer.priceList.name}` : null,
      currencyIds: customer.currencies.map((c) => c.currencyId),
      allowedCurrencies: customer.currencies.map((c) => ({
        currencyId: c.currencyId, code: c.currency.code, name: c.currency.name, isDefault: c.isDefault,
      })),
      companyTerms: customer.companyTerms.map((t) => ({
        id: t.id,
        companyId: t.companyId,
        companyName: t.company ? `${t.company.code} — ${t.company.name}` : null,
        salesmanId: t.salesmanId,
        salesmanName: t.salesman ? `${t.salesman.code} — ${t.salesman.name}` : null,
        priceListId: t.priceListId,
        priceListName: t.priceList?.name ?? null,
        paymentTermId: t.paymentTermId,
        paymentTermName: t.paymentTerm?.name ?? null,
        creditLimit: Number(t.creditLimit),
        creditExposureLimit: Number(t.creditExposureLimit),
        closeToExpiryDays: t.closeToExpiryDays,
        isBlackListed: t.isBlackListed,
        isGreyListed: t.isGreyListed,
        isActive: t.isActive,
      })),
    };
  }

  /**
   * Commercial terms that apply when this customer transacts with `companyId`:
   * the company-terms row when one exists, otherwise the customer header.
   * Used by sales documents to spool payment terms, currency, price list and
   * salesman off the master.
   */
  async effectiveTerms(customerId: string, companyId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId },
      include: {
        paymentTerm: { select: { id: true, name: true } },
        companyTerms: {
          where: { companyId },
          include: { paymentTerm: { select: { id: true, name: true } } },
        },
      },
    });
    if (!customer) throw notFound();
    const t = customer.companyTerms[0] ?? null;
    return {
      customerId,
      companyId,
      salesmanId: t?.salesmanId ?? customer.salesmanId ?? null,
      priceListId: t?.priceListId ?? customer.priceListId ?? null,
      paymentTermId: t?.paymentTermId ?? customer.paymentTermId ?? null,
      paymentTerms: t?.paymentTerm?.name ?? customer.paymentTerm?.name ?? customer.paymentTerms ?? null,
      currencyId: customer.currencyId ?? null,
      // The credit limit is maintained per company on the Companies grid; the
      // customer header value is only a fallback for rows created before that.
      creditLimit: Number(t?.creditLimit ?? customer.creditLimit),
      hasCompanyTerms: !!t,
      creditExposureLimit: Number(t?.creditExposureLimit ?? 0),
      creditHold: customer.creditHold,
      isBlackListed: (t?.isBlackListed ?? false) || customer.isBlackListed,
      isGreyListed: t?.isGreyListed ?? false,
      isActive: customer.isActive && (t?.isActive ?? true),
      defaultTaxCodeId: customer.defaultTaxCodeId,
      isTaxExempt: customer.isTaxExempt,
    };
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
        tradeName: deriveShortName(input.tradeName || input.name),
        type: (input.type ?? 'COMPANY') as any,
        trn: input.trn ?? null,
        defaultTaxCodeId: input.defaultTaxCodeId ?? null,
        isTaxExempt: input.isTaxExempt ?? false,
        paymentTerms: input.paymentTerms ?? null,
        paymentTermId: input.paymentTermId ?? null,
        currencyId: input.currencyId ?? null,
        creditLimit,
        creditHold: input.creditHold ?? false,
        isBlackListed: input.isBlackListed ?? false,
        priceListId: input.priceListId ?? null,
        salespersonId: input.salespersonId ?? null,
        salesmanId: input.salesmanId ?? null,
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
          ? { createMany: { data: input.addresses.map((a) => addressData(a)) } }
          : undefined,
        companyTerms: input.companyTerms?.length
          ? { createMany: { data: input.companyTerms.map((t) => companyTermData(t)) } }
          : undefined,
        currencies: input.currencyIds?.length
          ? { createMany: { data: input.currencyIds.map((cid, i) => ({ currencyId: cid, isDefault: i === 0 })) } }
          : undefined,
      },
      include: { contacts: true, addresses: true, companyTerms: true },
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
        tradeName: input.tradeName !== undefined || input.name !== undefined
          ? deriveShortName(input.tradeName || input.name || existing.name)
          : undefined,
        type: input.type as any,
        trn: input.trn,
        defaultTaxCodeId: input.defaultTaxCodeId,
        isTaxExempt: input.isTaxExempt,
        paymentTerms: input.paymentTerms,
        paymentTermId: input.paymentTermId,
        currencyId: input.currencyId,
        creditLimit: input.creditLimit,
        creditHold: input.creditHold,
        isBlackListed: input.isBlackListed,
        priceListId: input.priceListId,
        salespersonId: input.salespersonId,
        salesmanId: input.salesmanId,
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
          data: input.addresses.map((a) => ({ customerId: id, ...addressData(a) })),
        });
      }
    }
    if (input.currencyIds !== undefined) {
      await this.prisma.customerCurrency.deleteMany({ where: { customerId: id } });
      if (input.currencyIds.length) {
        await this.prisma.customerCurrency.createMany({
          data: input.currencyIds.map((cid, i) => ({ customerId: id, currencyId: cid, isDefault: i === 0 })),
        });
      }
    }
    if (input.companyTerms !== undefined) {
      await this.prisma.customerCompany.deleteMany({ where: { customerId: id } });
      if (input.companyTerms.length) {
        await this.prisma.customerCompany.createMany({
          data: input.companyTerms.map((t) => ({ customerId: id, ...companyTermData(t) })),
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
      select: { id: true, creditLimit: true, companyTerms: { where: { companyId }, select: { creditLimit: true } } },
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

    const creditLimit = Number(customer.companyTerms[0]?.creditLimit ?? customer.creditLimit);
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
    if (input.paymentTermId) {
      const pt = await this.prisma.paymentTerm.findFirst({ where: { id: input.paymentTermId, companyId } });
      if (!pt) throw Object.assign(new Error('Payment term not found'), { statusCode: 422 });
    }
    if (input.currencyId) {
      const cur = await this.prisma.currency.findFirst({ where: { id: input.currencyId, companyId } });
      if (!cur) throw Object.assign(new Error('Currency not found'), { statusCode: 422 });
    }
    if (input.salesmanId) {
      const sm = await this.prisma.salesman.findFirst({ where: { id: input.salesmanId, companyId } });
      if (!sm) throw Object.assign(new Error('Salesman not found'), { statusCode: 422 });
    }
    if (input.currencyIds?.length) {
      const found = await this.prisma.currency.count({ where: { id: { in: input.currencyIds }, companyId } });
      if (found !== new Set(input.currencyIds).size) {
        throw Object.assign(new Error('One or more currencies not found'), { statusCode: 422 });
      }
    }
    if (input.addresses?.length) await this.validateAddresses(input.addresses);
    if (input.companyTerms?.length) {
      const seen = new Set<string>();
      for (const t of input.companyTerms) {
        if (seen.has(t.companyId)) {
          throw Object.assign(new Error('A customer can have only one terms row per company'), { statusCode: 422 });
        }
        seen.add(t.companyId);
        const co = await this.prisma.company.findFirst({ where: { id: t.companyId }, select: { id: true } });
        if (!co) throw Object.assign(new Error('Company not found'), { statusCode: 422 });
      }
    }
  }

  /**
   * Cities must belong to the address's country and the VAT registration number
   * must satisfy that country's rule. The printed country/city text is filled in
   * from the masters here, so a caller only ever has to send the ids.
   */
  private async validateAddresses(addresses: UpsertAddressInput[]) {
    for (const a of addresses) {
      if (!a.countryId) continue;
      const country = await this.prisma.country.findUnique({
        where: { id: a.countryId },
        select: { id: true, name: true, vatPrefix: true, vatLength: true },
      });
      if (!country) throw Object.assign(new Error('Country not found'), { statusCode: 422 });
      a.country = country.name;

      if (a.cityId) {
        const city = await this.prisma.city.findFirst({
          where: { id: a.cityId, countryId: a.countryId },
          select: { id: true, name: true },
        });
        if (!city) throw Object.assign(new Error('City does not belong to the selected country'), { statusCode: 422 });
        a.city = city.name;
      }

      const verdict = validateVatNumber(a.vatNo, country);
      if (!verdict.ok) {
        throw Object.assign(new Error(`${a.type === 'SHIP_TO' ? 'Ship to' : 'Bill to'} address: ${verdict.message}`), { statusCode: 422 });
      }
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

function addressData(a: UpsertAddressInput) {
  return {
    type: a.type as any,
    name: a.name ?? null,
    line1: a.line1,
    line2: a.line2 ?? null,
    line3: a.line3 ?? null,
    line4: a.line4 ?? null,
    line5: a.line5 ?? null,
    countryId: a.countryId ?? null,
    country: a.country ?? null,
    cityId: a.cityId ?? null,
    city: a.city ?? null,
    postalCode: a.postalCode ?? null,
    street: a.street ?? null,
    contactPerson: a.contactPerson ?? null,
    email: a.email ?? null,
    phone: a.phone ?? null,
    mobile: a.mobile ?? null,
    fax: a.fax ?? null,
    vatNo: a.vatNo ?? null,
    crNo: a.crNo ?? null,
    taxCardNo: a.taxCardNo ?? null,
    isDefault: a.isDefault ?? false,
  };
}

function companyTermData(t: UpsertCustomerCompanyInput) {
  return {
    companyId: t.companyId,
    salesmanId: t.salesmanId ?? null,
    priceListId: t.priceListId ?? null,
    paymentTermId: t.paymentTermId ?? null,
    creditLimit: new Prisma.Decimal(t.creditLimit ?? 0),
    creditExposureLimit: new Prisma.Decimal(t.creditExposureLimit ?? 0),
    closeToExpiryDays: t.closeToExpiryDays ?? null,
    isBlackListed: t.isBlackListed ?? false,
    isGreyListed: t.isGreyListed ?? false,
    isActive: t.isActive ?? true,
  };
}
