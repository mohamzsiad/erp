import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { PriceResolutionService } from './PriceResolutionService.js';
import { SalesPricingService } from './SalesPricingService.js';

export interface QuotationLineInput {
  itemId: string;
  description?: string | null;
  uomId: string;
  qty: number;
  unitPrice?: number | null;   // if omitted, resolved from price lists
  discountPct?: number;
  taxCodeId?: string | null;
}

export interface CreateQuotationInput {
  companyId: string;
  customerId: string;
  enquiryId?: string | null;
  quotationDate: string;
  validTo?: string | null;
  paymentTerms?: string | null;
  salespersonId?: string | null;
  notes?: string | null;
  lines: QuotationLineInput[];
}

export type UpdateQuotationInput = Partial<Omit<CreateQuotationInput, 'companyId'>>;
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

interface SalesConfig { PRICE_OVERRIDE_ALLOWED: boolean; }

function notFound(msg = 'Quotation not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }

export class SalesQuotationService {
  private pricing: SalesPricingService;
  private resolver: PriceResolutionService;
  constructor(private prisma: PrismaClient) {
    this.pricing = new SalesPricingService(prisma);
    this.resolver = new PriceResolutionService(prisma);
  }

  private async config(companyId: string): Promise<SalesConfig> {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { salesConfig: true } });
    const cfg = (c?.salesConfig as any) ?? {};
    return { PRICE_OVERRIDE_ALLOWED: cfg.PRICE_OVERRIDE_ALLOWED ?? true };
  }

  async list(companyId: string, q: { search?: string; status?: string; customerId?: string; page?: number; limit?: number }) {
    const { search, status, customerId, page = 1, limit = 50 } = q;
    const where: Prisma.SalesQuotationWhereInput = { companyId };
    if (status) where.status = status as any;
    if (customerId) where.customerId = customerId;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      this.prisma.salesQuotation.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
      }),
      this.prisma.salesQuotation.count({ where }),
    ]);
    const data = rows.map((r) => ({
      id: r.id, docNo: r.docNo, rev: r.rev, customerId: r.customerId, customerName: r.customer?.name,
      quotationDate: r.quotationDate, validTo: r.validTo, status: r.status, totalAmount: Number(r.totalAmount), createdAt: r.createdAt,
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const q = await this.prisma.salesQuotation.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } }, taxCode: { select: { code: true, rate: true } } } },
      },
    });
    if (!q) throw notFound();
    return { ...q, subTotal: Number(q.subTotal), discountAmount: Number(q.discountAmount), taxAmount: Number(q.taxAmount), totalAmount: Number(q.totalAmount) };
  }

  /** Resolve unit prices, compute line/header amounts, and collect override warnings. */
  private async priceLines(companyId: string, customerId: string, dateStr: string, lines: QuotationLineInput[]) {
    const cfg = await this.config(companyId);
    const asOf = dateStr;
    const warnings: string[] = [];
    const priced: Array<Required<Pick<QuotationLineInput, 'itemId' | 'uomId'>> & { description: string | null; qty: number; unitPrice: number; discountPct: number; taxCodeId: string | null }> = [];

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      let unitPrice = l.unitPrice ?? null;
      let minPrice: number | null = null;
      const resolution = await this.resolver.resolvePrice({ companyId, customerId, itemId: l.itemId, uomId: l.uomId, date: asOf });
      minPrice = resolution.minPrice;
      if (unitPrice == null) unitPrice = resolution.unitPrice ?? 0;
      if (minPrice != null && unitPrice < minPrice) {
        if (!cfg.PRICE_OVERRIDE_ALLOWED) {
          throw Object.assign(new Error(`Line ${i + 1}: price ${unitPrice} is below the minimum ${minPrice} and overrides are not allowed`), { statusCode: 422 });
        }
        warnings.push(`Line ${i + 1}: unit price ${unitPrice} is below the minimum ${minPrice}`);
      }
      priced.push({
        itemId: l.itemId, uomId: l.uomId, description: l.description ?? null,
        qty: l.qty, unitPrice, discountPct: l.discountPct ?? 0, taxCodeId: l.taxCodeId ?? null,
      });
    }

    const totals = await this.pricing.computeForLines(companyId, priced);
    return { priced, totals, warnings };
  }

  async create(input: CreateQuotationInput, userId: string) {
    const { priced, totals, warnings } = await this.priceLines(input.companyId, input.customerId, input.quotationDate, input.lines);
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'SQL');
    const quotation = await this.prisma.salesQuotation.create({
      data: {
        companyId: input.companyId, docNo, customerId: input.customerId, enquiryId: input.enquiryId ?? null,
        rev: 0, quotationDate: toDate(input.quotationDate)!, validTo: toDate(input.validTo),
        paymentTerms: input.paymentTerms ?? null, salespersonId: input.salespersonId ?? null, notes: input.notes ?? null,
        status: 'DRAFT',
        subTotal: new Prisma.Decimal(totals.subTotal), discountAmount: new Prisma.Decimal(totals.discountAmount),
        taxAmount: new Prisma.Decimal(totals.taxAmount), totalAmount: new Prisma.Decimal(totals.totalAmount),
        createdById: userId,
        lines: { createMany: { data: priced.map((l, i) => ({
          itemId: l.itemId, description: l.description, uomId: l.uomId, qty: new Prisma.Decimal(l.qty),
          unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct),
          taxCodeId: l.taxCodeId, netAmount: new Prisma.Decimal(totals.lines[i].netAmount), lineNo: i + 1,
        })) } },
      },
    });
    await this.audit('CREATE', quotation.id, userId, { docNo });
    const full = await this.getById(quotation.id, input.companyId);
    return { ...full, warnings };
  }

  async update(id: string, companyId: string, input: UpdateQuotationInput, userId: string) {
    const existing = await this.prisma.salesQuotation.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    if (!['DRAFT', 'SENT'].includes(existing.status)) throw Object.assign(new Error('Only DRAFT or SENT quotations can be edited'), { statusCode: 409 });

    let warnings: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      const header: Prisma.SalesQuotationUpdateInput = {
        validTo: input.validTo !== undefined ? toDate(input.validTo) : undefined,
        paymentTerms: input.paymentTerms, salespersonId: input.salespersonId, notes: input.notes,
      };
      if (input.lines !== undefined) {
        const customerId = input.customerId ?? existing.customerId;
        const dateStr = input.quotationDate ?? existing.quotationDate.toISOString();
        const { priced, totals, warnings: w } = await this.priceLines(companyId, customerId, dateStr, input.lines);
        warnings = w;
        header.subTotal = new Prisma.Decimal(totals.subTotal);
        header.discountAmount = new Prisma.Decimal(totals.discountAmount);
        header.taxAmount = new Prisma.Decimal(totals.taxAmount);
        header.totalAmount = new Prisma.Decimal(totals.totalAmount);
        await tx.salesQuotationLine.deleteMany({ where: { quotationId: id } });
        await tx.salesQuotationLine.createMany({ data: priced.map((l, i) => ({
          quotationId: id, itemId: l.itemId, description: l.description, uomId: l.uomId, qty: new Prisma.Decimal(l.qty),
          unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct),
          taxCodeId: l.taxCodeId, netAmount: new Prisma.Decimal(totals.lines[i].netAmount), lineNo: i + 1,
        })) });
      }
      await tx.salesQuotation.update({ where: { id }, data: header });
    });
    await this.audit('UPDATE', id, userId, {});
    const full = await this.getById(id, companyId);
    return { ...full, warnings };
  }

  async setStatus(id: string, companyId: string, status: QuotationStatus, userId: string) {
    const q = await this.prisma.salesQuotation.findFirst({ where: { id, companyId } });
    if (!q) throw notFound();
    const updated = await this.prisma.salesQuotation.update({ where: { id }, data: { status } });
    await this.audit('UPDATE', id, userId, { status });
    return updated;
  }

  /** Create a new revision (new docNo, rev+1), copy lines, expire the prior one. */
  async revise(id: string, companyId: string, userId: string) {
    const prev = await this.getById(id, companyId);
    const docNo = await getNextDocNo(this.prisma, companyId, 'SALES', 'SQL');
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.salesQuotation.update({ where: { id }, data: { status: 'EXPIRED' } });
      return tx.salesQuotation.create({
        data: {
          companyId, docNo, customerId: prev.customerId, enquiryId: prev.enquiryId, rev: prev.rev + 1,
          quotationDate: new Date(), validTo: prev.validTo, paymentTerms: prev.paymentTerms, salespersonId: prev.salespersonId,
          notes: prev.notes, status: 'DRAFT',
          subTotal: new Prisma.Decimal(prev.subTotal), discountAmount: new Prisma.Decimal(prev.discountAmount),
          taxAmount: new Prisma.Decimal(prev.taxAmount), totalAmount: new Prisma.Decimal(prev.totalAmount), createdById: userId,
          lines: { createMany: { data: prev.lines.map((l, i) => ({
            itemId: l.itemId, description: l.description, uomId: l.uomId, qty: l.qty,
            unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId, netAmount: l.netAmount, lineNo: i + 1,
          })) } },
        },
      });
    });
    await this.audit('CREATE', created.id, userId, { revisionOf: id, rev: prev.rev + 1 });
    return this.getById(created.id, companyId);
  }

  /** Build a quotation from an enquiry, resolving prices, and mark the enquiry QUOTED. */
  async createFromEnquiry(enquiryId: string, companyId: string, userId: string) {
    const enq = await this.prisma.salesEnquiry.findFirst({ where: { id: enquiryId, companyId }, include: { lines: true } });
    if (!enq) throw Object.assign(new Error('Sales enquiry not found'), { statusCode: 404 });
    if (!enq.customerId) throw Object.assign(new Error('Enquiry has no customer; set a customer before quoting'), { statusCode: 422 });
    const dateStr = new Date().toISOString();
    const lines: QuotationLineInput[] = enq.lines.map((l) => ({
      itemId: l.itemId, description: l.description, uomId: l.uomId, qty: Number(l.qty),
      unitPrice: l.targetPrice != null ? Number(l.targetPrice) : null,
    }));
    const created = await this.create({ companyId, customerId: enq.customerId, enquiryId, quotationDate: dateStr, lines }, userId);
    await this.prisma.salesEnquiry.update({ where: { id: enquiryId }, data: { status: 'QUOTED' } });
    return created;
  }

  /** Create a DRAFT sales order from an ACCEPTED quotation (full order logic lands in the Sales Order prompt). */
  async convertToOrder(id: string, companyId: string, userId: string) {
    const q = await this.getById(id, companyId);
    if (q.status !== 'ACCEPTED') throw Object.assign(new Error('Only ACCEPTED quotations can be converted to an order'), { statusCode: 409 });
    const docNo = await getNextDocNo(this.prisma, companyId, 'SALES', 'SOL');
    const order = await this.prisma.salesOrder.create({
      data: {
        companyId, docNo, customerId: q.customerId, quotationId: q.id, orderType: 'STOCK',
        orderDate: new Date(), salespersonId: q.salespersonId, paymentTerms: q.paymentTerms, status: 'DRAFT',
        subTotal: new Prisma.Decimal(q.subTotal), discountAmount: new Prisma.Decimal(q.discountAmount),
        taxAmount: new Prisma.Decimal(q.taxAmount), totalAmount: new Prisma.Decimal(q.totalAmount), createdById: userId,
        lines: { createMany: { data: q.lines.map((l, i) => ({
          itemId: l.itemId, description: l.description, uomId: l.uomId, orderedQty: l.qty, unitPrice: l.unitPrice,
          discountPct: l.discountPct, taxCodeId: l.taxCodeId, netAmount: l.netAmount, lineNo: i + 1,
        })) } },
      },
    });
    await this.audit('CREATE', order.id, userId, { fromQuotation: id, orderDocNo: docNo });
    return { orderId: order.id, docNo };
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'sales_quotations', recordId, userId, action, newValues: values } });
  }
}
