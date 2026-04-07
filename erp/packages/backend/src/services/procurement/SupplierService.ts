import { PrismaClient } from '@prisma/client';

interface CreateSupplierInput {
  companyId: string;
  locationId: string; // used for code generation
  name: string;
  shortName: string;
  controlAccountId?: string | null;
  creditDays?: number;
  creditAmount?: number;
  parentSupplierId?: string | null;
  shipmentMode?: 'AIR' | 'SEA' | 'LAND' | 'NA';
  isTdsApplicable?: boolean;
  isTdsParty?: boolean;
  isParentSupplier?: boolean;
  contacts?: Array<{
    name: string;
    designation?: string;
    email?: string;
    phone?: string;
    isPrimary?: boolean;
  }>;
  bankDetails?: Array<{
    bankName: string;
    accountNo: string;
    iban?: string;
    swiftCode?: string;
  }>;
}

interface UpdateSupplierInput {
  name?: string;
  shortName?: string;
  controlAccountId?: string | null;
  creditDays?: number;
  creditAmount?: number;
  parentSupplierId?: string | null;
  shipmentMode?: 'AIR' | 'SEA' | 'LAND' | 'NA';
  isTdsApplicable?: boolean;
  isTdsParty?: boolean;
  isParentSupplier?: boolean;
}

interface ListSuppliersQuery {
  companyId: string;
  search?: string;
  isActive?: boolean;
  locationId?: string;
  supplierId?: string;
  page?: number;
  limit?: number;
}

export class SupplierService {
  constructor(private prisma: PrismaClient) {}

  // ── List suppliers (paginated) ─────────────────────────────────────────────
  async list(query: ListSuppliersQuery) {
    const { companyId, search, isActive, supplierId, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;
    if (supplierId) where.id = supplierId;

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          shortName: true,
          creditDays: true,
          creditAmount: true,
          shipmentMode: true,
          isActive: true,
          isParentSupplier: true,
          createdAt: true,
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Quick search for lookup dropdowns ─────────────────────────────────────
  async search(companyId: string, q: string, limit = 20) {
    return this.prisma.supplier.findMany({
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

  // ── Get by ID with all sub-records ─────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId },
      include: {
        bankDetails: true,
        contacts: { orderBy: { isPrimary: 'desc' } },
        parentSupplier: { select: { id: true, code: true, name: true } },
      },
    });
    if (!supplier) {
      throw Object.assign(new Error('Supplier not found'), { statusCode: 404 });
    }
    return supplier;
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(input: CreateSupplierInput, creatingUserId: string) {
    // Validate control account if provided
    if (input.controlAccountId) {
      const gl = await this.prisma.glAccount.findFirst({
        where: { id: input.controlAccountId, companyId: input.companyId },
      });
      if (!gl) {
        throw Object.assign(new Error('Control account not found'), { statusCode: 422 });
      }
    }

    // Generate supplier code
    const code = await this.generateSupplierCode(input.companyId, input.locationId);

    const supplier = await this.prisma.supplier.create({
      data: {
        companyId: input.companyId,
        code,
        name: input.name,
        shortName: input.shortName,
        controlAccountId: input.controlAccountId ?? null,
        creditDays: input.creditDays ?? 0,
        creditAmount: input.creditAmount ?? 0,
        parentSupplierId: input.parentSupplierId ?? null,
        shipmentMode: (input.shipmentMode ?? 'NA') as any,
        isTdsApplicable: input.isTdsApplicable ?? false,
        isTdsParty: input.isTdsParty ?? false,
        isParentSupplier: input.isParentSupplier ?? false,
        isActive: true,
        contacts: input.contacts?.length
          ? {
              createMany: {
                data: input.contacts.map((c) => ({
                  name: c.name,
                  designation: c.designation ?? null,
                  email: c.email ?? null,
                  phone: c.phone ?? null,
                  isPrimary: c.isPrimary ?? false,
                })),
              },
            }
          : undefined,
        bankDetails: input.bankDetails?.length
          ? {
              createMany: {
                data: input.bankDetails.map((b) => ({
                  bankName: b.bankName,
                  accountNo: b.accountNo,
                  iban: b.iban ?? null,
                  swiftCode: b.swiftCode ?? null,
                  isActive: true,
                })),
              },
            }
          : undefined,
      },
      include: { bankDetails: true, contacts: true },
    });

    // Audit
    await this.prisma.auditLog.create({
      data: {
        tableName: 'suppliers',
        recordId: supplier.id,
        userId: creatingUserId,
        action: 'CREATE',
        newValues: { code: supplier.code, name: supplier.name },
      },
    });

    return supplier;
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(id: string, companyId: string, input: UpdateSupplierInput, userId: string) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw Object.assign(new Error('Supplier not found'), { statusCode: 404 });
    }

    if (input.controlAccountId) {
      const gl = await this.prisma.glAccount.findFirst({
        where: { id: input.controlAccountId, companyId },
      });
      if (!gl) {
        throw Object.assign(new Error('Control account not found'), { statusCode: 422 });
      }
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: input.name,
        shortName: input.shortName,
        controlAccountId: input.controlAccountId,
        creditDays: input.creditDays,
        creditAmount: input.creditAmount,
        parentSupplierId: input.parentSupplierId,
        shipmentMode: input.shipmentMode as any,
        isTdsApplicable: input.isTdsApplicable,
        isTdsParty: input.isTdsParty,
        isParentSupplier: input.isParentSupplier,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'suppliers',
        recordId: id,
        userId,
        action: 'UPDATE',
        oldValues: existing as any,
        newValues: input as any,
      },
    });

    return updated;
  }

  // ── Toggle active status ───────────────────────────────────────────────────
  async toggleActive(id: string, companyId: string, userId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, companyId } });
    if (!supplier) {
      throw Object.assign(new Error('Supplier not found'), { statusCode: 404 });
    }
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: !supplier.isActive },
    });
  }

  // ── Supplier statement of account ─────────────────────────────────────────
  async getStatement(id: string, companyId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId },
      select: { id: true, code: true, name: true },
    });
    if (!supplier) {
      throw Object.assign(new Error('Supplier not found'), { statusCode: 404 });
    }

    const [invoices, payments] = await Promise.all([
      this.prisma.apInvoice.findMany({
        where: { supplierId: id, companyId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          docNo: true,
          invoiceDate: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          currencyId: true,
        },
      }),
      this.prisma.apPayment.findMany({
        where: { supplierId: id, companyId },
        orderBy: { paymentDate: 'asc' },
        select: {
          id: true,
          docNo: true,
          paymentDate: true,
          amount: true,
          method: true,
          currencyId: true,
        },
      }),
    ]);

    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

    return {
      supplier,
      invoices,
      payments,
      summary: {
        totalInvoiced,
        totalPaid,
        outstanding: totalInvoiced - totalPaid,
      },
    };
  }

  // ── Private: generate supplier code ────────────────────────────────────────
  private async generateSupplierCode(companyId: string, locationId: string): Promise<string> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId },
      select: { code: true },
    });

    // Take first 2 chars of location code as prefix (e.g., "SA" from "SAUDI")
    const locPrefix = (location?.code ?? 'XX').slice(0, 2).toUpperCase();

    // Count existing suppliers with this prefix pattern to get next seq
    const pattern = `MCL${locPrefix}%`;
    const count = await this.prisma.supplier.count({
      where: { companyId, code: { startsWith: `MCL${locPrefix}` } },
    });

    const seq = String(count + 1).padStart(3, '0');
    return `MCL${locPrefix}${seq}`;
  }
}
