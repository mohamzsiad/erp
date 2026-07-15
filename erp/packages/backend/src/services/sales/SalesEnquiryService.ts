import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';

export interface EnquiryLineInput {
  itemId: string;
  description?: string | null;
  uomId: string;
  qty: number;
  targetPrice?: number | null;
}

export interface CreateEnquiryInput {
  companyId: string;
  customerId?: string | null;
  prospectName?: string | null;
  enquiryDate: string;
  requiredByDate?: string | null;
  salespersonId?: string | null;
  source?: string | null;
  notes?: string | null;
  lines?: EnquiryLineInput[];
}

export type UpdateEnquiryInput = Partial<Omit<CreateEnquiryInput, 'companyId'>>;

export type EnquiryStatus = 'OPEN' | 'QUOTED' | 'WON' | 'LOST' | 'CLOSED';

function notFound(msg = 'Sales enquiry not found') {
  return Object.assign(new Error(msg), { statusCode: 404 });
}
function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

export class SalesEnquiryService {
  constructor(private prisma: PrismaClient) {}

  async list(companyId: string, q: { search?: string; status?: string; customerId?: string; page?: number; limit?: number }) {
    const { search, status, customerId, page = 1, limit = 50 } = q;
    const where: Prisma.SalesEnquiryWhereInput = { companyId };
    if (status) where.status = status as any;
    if (customerId) where.customerId = customerId;
    if (search) where.OR = [{ docNo: { contains: search, mode: 'insensitive' } }, { prospectName: { contains: search, mode: 'insensitive' } }];

    const [rows, total] = await Promise.all([
      this.prisma.salesEnquiry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } }, _count: { select: { lines: true } } },
      }),
      this.prisma.salesEnquiry.count({ where }),
    ]);
    const data = rows.map((r) => ({
      id: r.id, docNo: r.docNo, customerId: r.customerId, customerName: r.customer?.name ?? r.prospectName,
      enquiryDate: r.enquiryDate, requiredByDate: r.requiredByDate, status: r.status, source: r.source,
      lineCount: r._count.lines, createdAt: r.createdAt,
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const e = await this.prisma.salesEnquiry.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } } } },
      },
    });
    if (!e) throw notFound();
    return e;
  }

  async create(input: CreateEnquiryInput, userId: string) {
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'SEL');
    const enquiry = await this.prisma.salesEnquiry.create({
      data: {
        companyId: input.companyId,
        docNo,
        customerId: input.customerId ?? null,
        prospectName: input.prospectName ?? null,
        enquiryDate: toDate(input.enquiryDate)!,
        requiredByDate: toDate(input.requiredByDate),
        salespersonId: input.salespersonId ?? null,
        source: input.source ?? null,
        notes: input.notes ?? null,
        status: 'OPEN',
        createdById: userId,
        lines: input.lines?.length
          ? { createMany: { data: input.lines.map((l, i) => ({
              itemId: l.itemId, description: l.description ?? null, uomId: l.uomId,
              qty: new Prisma.Decimal(l.qty), targetPrice: l.targetPrice != null ? new Prisma.Decimal(l.targetPrice) : null, lineNo: i + 1,
            })) } }
          : undefined,
      },
    });
    await this.audit('CREATE', enquiry.id, userId, { docNo });
    return this.getById(enquiry.id, input.companyId);
  }

  async update(id: string, companyId: string, input: UpdateEnquiryInput, userId: string) {
    const existing = await this.prisma.salesEnquiry.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    if (existing.status !== 'OPEN') throw Object.assign(new Error('Only OPEN enquiries can be edited'), { statusCode: 409 });

    await this.prisma.$transaction(async (tx) => {
      await tx.salesEnquiry.update({
        where: { id },
        data: {
          customerId: input.customerId,
          prospectName: input.prospectName,
          enquiryDate: input.enquiryDate ? toDate(input.enquiryDate)! : undefined,
          requiredByDate: input.requiredByDate !== undefined ? toDate(input.requiredByDate) : undefined,
          salespersonId: input.salespersonId,
          source: input.source,
          notes: input.notes,
        },
      });
      if (input.lines !== undefined) {
        await tx.salesEnquiryLine.deleteMany({ where: { enquiryId: id } });
        if (input.lines.length) {
          await tx.salesEnquiryLine.createMany({ data: input.lines.map((l, i) => ({
            enquiryId: id, itemId: l.itemId, description: l.description ?? null, uomId: l.uomId,
            qty: new Prisma.Decimal(l.qty), targetPrice: l.targetPrice != null ? new Prisma.Decimal(l.targetPrice) : null, lineNo: i + 1,
          })) });
        }
      }
    });
    await this.audit('UPDATE', id, userId, {});
    return this.getById(id, companyId);
  }

  async setStatus(id: string, companyId: string, status: EnquiryStatus, userId: string, lostReason?: string) {
    const e = await this.prisma.salesEnquiry.findFirst({ where: { id, companyId } });
    if (!e) throw notFound();
    const updated = await this.prisma.salesEnquiry.update({
      where: { id },
      data: { status, lostReason: status === 'LOST' ? (lostReason ?? e.lostReason) : e.lostReason },
    });
    await this.audit('UPDATE', id, userId, { status });
    return updated;
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'sales_enquiries', recordId, userId, action, newValues: values } });
  }
}
