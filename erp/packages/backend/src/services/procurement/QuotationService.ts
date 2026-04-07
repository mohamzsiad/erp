import { PrismaClient } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';

interface CreateQuotationInput {
  companyId: string;
  supplierId: string;
  enquiryId: string;
  validityDate: string;
  currencyId: string;
  paymentTerms?: string;
  totalAmount: number;
}

export class QuotationService {
  constructor(private prisma: PrismaClient) {}

  // ── List ───────────────────────────────────────────────────────────────────
  async list(companyId: string, filters: { supplierId?: string; enquiryId?: string; page?: number; limit?: number } = {}) {
    const { supplierId, enquiryId, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (supplierId) where.supplierId = supplierId;
    if (enquiryId) where.enquiryId = enquiryId;

    const [items, total] = await Promise.all([
      this.prisma.purchaseQuotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { code: true, name: true } },
          currency: { select: { code: true } },
          enquiry: { select: { docNo: true } },
        },
      }),
      this.prisma.purchaseQuotation.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID ──────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const pq = await this.prisma.purchaseQuotation.findFirst({
      where: { id, companyId },
      include: {
        supplier: true,
        enquiry: { include: { prl: { select: { docNo: true } } } },
        currency: true,
      },
    });

    if (!pq) throw Object.assign(new Error('Quotation not found'), { statusCode: 404 });
    return pq;
  }

  // ── Comparison view: items as rows, suppliers as columns ──────────────────
  async compare(enquiryId: string, companyId: string) {
    const enquiry = await this.prisma.purchaseEnquiry.findFirst({
      where: { id: enquiryId, companyId },
      include: {
        prl: {
          include: {
            lines: {
              include: {
                item: { select: { code: true, name: true } },
                uom: { select: { code: true } },
              },
            },
          },
        },
        quotations: {
          include: {
            supplier: { select: { code: true, name: true } },
            currency: { select: { code: true } },
          },
        },
      },
    });

    if (!enquiry) throw Object.assign(new Error('Purchase Enquiry not found'), { statusCode: 404 });

    const prlLines = enquiry.prl?.lines ?? [];
    const quotations = enquiry.quotations;

    // Build comparison matrix
    const comparison = prlLines.map((line) => ({
      lineId: line.id,
      itemCode: line.item.code,
      itemName: line.item.name,
      uom: line.uom.code,
      requestedQty: Number(line.requestedQty),
      supplierPrices: quotations.map((pq) => ({
        quotationId: pq.id,
        supplierId: pq.supplierId,
        supplierCode: pq.supplier.code,
        supplierName: pq.supplier.name,
        currency: pq.currency.code,
        unitPrice: null as number | null, // line-level prices would need a separate QuotationLine model
        totalAmount: Number(pq.totalAmount),
        paymentTerms: pq.paymentTerms,
        validityDate: pq.validityDate,
        status: pq.status,
      })),
    }));

    return {
      enquiryDocNo: enquiry.docNo,
      enquiryStatus: enquiry.status,
      suppliers: quotations.map((pq) => ({
        quotationId: pq.id,
        docNo: pq.docNo,
        supplierCode: pq.supplier.code,
        supplierName: pq.supplier.name,
        currency: pq.currency.code,
        totalAmount: Number(pq.totalAmount),
        validityDate: pq.validityDate,
        status: pq.status,
      })),
      comparison,
    };
  }

  // ── Create quotation (supplier response) ──────────────────────────────────
  async create(input: CreateQuotationInput, createdById: string) {
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'PROCUREMENT', 'PQ');

    const pq = await this.prisma.purchaseQuotation.create({
      data: {
        companyId: input.companyId,
        docNo,
        supplierId: input.supplierId,
        enquiryId: input.enquiryId,
        validityDate: new Date(input.validityDate),
        currencyId: input.currencyId,
        paymentTerms: input.paymentTerms ?? null,
        totalAmount: input.totalAmount,
        status: 'RECEIVED',
        createdById,
      },
    });

    return pq;
  }

  // ── Award quotation — creates a PO draft, marks others as LOST ─────────
  async award(id: string, companyId: string, userId: string) {
    const pq = await this.prisma.purchaseQuotation.findFirst({
      where: { id, companyId },
      include: {
        enquiry: {
          include: {
            prl: {
              include: {
                lines: { where: { isShortClosed: false } },
              },
            },
          },
        },
        supplier: { select: { id: true, code: true, name: true } },
        currency: { select: { id: true } },
      },
    });

    if (!pq) throw Object.assign(new Error('Quotation not found'), { statusCode: 404 });
    if (pq.status === 'AWARDED') {
      throw Object.assign(new Error('Quotation already awarded'), { statusCode: 422 });
    }

    return this.prisma.$transaction(async (tx) => {
      // Mark this quotation as AWARDED
      await tx.purchaseQuotation.update({
        where: { id },
        data: { status: 'AWARDED' },
      });

      // Mark sibling quotations (same enquiry) as LOST
      if (pq.enquiryId) {
        await tx.purchaseQuotation.updateMany({
          where: {
            enquiryId: pq.enquiryId,
            id: { not: id },
            companyId,
          },
          data: { status: 'LOST' },
        });
      }

      // Create draft PO from quotation
      const docNo = await getNextDocNo(tx as any, companyId, 'PROCUREMENT', 'PO');
      const prlLines = pq.enquiry?.prl?.lines ?? [];

      const po = await tx.purchaseOrder.create({
        data: {
          companyId,
          docNo,
          docDate: new Date(),
          supplierId: pq.supplierId,
          currencyId: pq.currencyId,
          exchangeRate: 1,
          paymentTerms: pq.paymentTerms,
          totalAmount: pq.totalAmount,
          status: 'DRAFT',
          createdById: userId,
          lines: prlLines.length
            ? {
                createMany: {
                  data: prlLines.map((l, idx) => ({
                    itemId: l.itemId,
                    uomId: l.uomId,
                    orderedQty: l.requestedQty,
                    receivedQty: 0,
                    invoicedQty: 0,
                    unitPrice: 0, // to be updated in PO
                    discountPct: 0,
                    taxPct: 0,
                    netAmount: 0,
                    chargeCodeId: l.chargeCodeId,
                    lineNo: idx + 1,
                  })),
                },
              }
            : undefined,
        },
      });

      return { message: 'Quotation awarded', po };
    });
  }
}
