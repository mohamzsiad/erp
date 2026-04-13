import { PrismaClient } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { WorkflowService } from '../WorkflowService.js';
import { NotificationService } from '../NotificationService.js';

interface CreatePrlInput {
  companyId: string;
  locationId: string;
  chargeCodeId: string;
  docDate: string;
  deliveryDate: string;
  remarks?: string;
  mrlId?: string; // if converting from MRL
  lines: Array<{
    itemId: string;
    uomId: string;
    chargeCodeId: string;
    requestedQty: number;
    approxPrice?: number;
    grade1?: string;
    grade2?: string;
  }>;
}

interface ListPrlQuery {
  companyId: string;
  status?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
  createdBy?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class PrlService {
  private workflow: WorkflowService;
  private notif: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.workflow = new WorkflowService(prisma);
    this.notif = new NotificationService(prisma);
  }

  // ── List ───────────────────────────────────────────────────────────────────
  async list(query: ListPrlQuery) {
    const { companyId, status, locationId, dateFrom, dateTo, createdBy, search, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;
    if (createdBy) where.createdById = createdBy;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.docDate = {};
      if (dateFrom) where.docDate.gte = new Date(dateFrom);
      if (dateTo) where.docDate.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.purchaseRequisition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          location: { select: { code: true, name: true } },
          chargeCode: { select: { code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.purchaseRequisition.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID ──────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const prl = await this.prisma.purchaseRequisition.findFirst({
      where: { id, companyId },
      include: {
        location: true,
        chargeCode: true,
        lines: {
          include: {
            item: { select: { id: true, code: true, description: true } },
            uom: { select: { id: true, code: true, name: true } },
          },
          orderBy: { lineNo: 'asc' },
        },
      },
    });

    if (!prl) throw Object.assign(new Error('PRL not found'), { statusCode: 404 });

    // Enrich with live free stock
    const enrichedLines = await Promise.all(
      prl.lines.map(async (line) => {
        const stock = await this.prisma.stockBalance.findFirst({
          where: { itemId: line.itemId },
          select: { qtyOnHand: true, qtyReserved: true },
        });
        const qtyOnHand = Number(stock?.qtyOnHand ?? 0);
        const qtyReserved = Number(stock?.qtyReserved ?? 0);
        return {
          ...line,
          liveStock: { qtyOnHand, qtyReserved, freeStock: Math.max(0, qtyOnHand - qtyReserved) },
        };
      })
    );

    return { ...prl, lines: enrichedLines };
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(input: CreatePrlInput, createdById: string) {
    if (!input.lines?.length) {
      throw Object.assign(new Error('PRL must have at least one line'), { statusCode: 422 });
    }

    const docNo = await getNextDocNo(this.prisma, input.companyId, 'PROCUREMENT', 'PRL');

    const prl = await this.prisma.purchaseRequisition.create({
      data: {
        companyId: input.companyId,
        docNo,
        docDate: new Date(input.docDate),
        locationId: input.locationId,
        chargeCodeId: input.chargeCodeId,
        deliveryDate: new Date(input.deliveryDate),
        remarks: input.remarks ?? null,
        status: 'DRAFT',
        mrlId: input.mrlId ?? null,
        createdById,
        lines: {
          createMany: {
            data: input.lines.map((l, idx) => ({
              itemId: l.itemId,
              uomId: l.uomId,
              chargeCodeId: l.chargeCodeId,
              requestedQty: l.requestedQty,
              approvedQty: 0,
              approxPrice: l.approxPrice ?? 0,
              grade1: l.grade1 ?? null,
              grade2: l.grade2 ?? null,
              freeStock: 0,
              lineNo: idx + 1,
              isShortClosed: false,
            })),
          },
        },
      },
      include: { lines: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'PRL',
        recordId: prl.id,
        userId: createdById,
        action: 'CREATE',
        newValues: { docNo, status: 'DRAFT', mrlId: input.mrlId },
      },
    });

    return prl;
  }

  // ── Short close specific lines ─────────────────────────────────────────────
  async shortClose(id: string, companyId: string, lineIds: string[], userId: string) {
    const prl = await this.prisma.purchaseRequisition.findFirst({ where: { id, companyId } });
    if (!prl) throw Object.assign(new Error('PRL not found'), { statusCode: 404 });

    if (!['DRAFT', 'APPROVED', 'ENQUIRY_SENT'].includes(prl.status)) {
      throw Object.assign(new Error('Cannot short-close a PRL in its current status'), { statusCode: 422 });
    }

    await this.prisma.prlLine.updateMany({
      where: { prlId: id, id: { in: lineIds } },
      data: { isShortClosed: true },
    });

    // If all lines are short closed, close the PRL
    const openLines = await this.prisma.prlLine.count({
      where: { prlId: id, isShortClosed: false },
    });
    if (openLines === 0) {
      await this.prisma.purchaseRequisition.update({
        where: { id },
        data: { status: 'SHORT_CLOSED' },
      });
    }

    return { message: 'Lines short closed successfully', openLinesRemaining: openLines };
  }

  // ── Create enquiry from PRL lines ─────────────────────────────────────────
  async createEnquiry(
    id: string,
    companyId: string,
    createdById: string,
    supplierIds: string[],
    lineIds?: string[]
  ) {
    const prl = await this.prisma.purchaseRequisition.findFirst({
      where: { id, companyId },
      include: { lines: { where: { isShortClosed: false } } },
    });
    if (!prl) throw Object.assign(new Error('PRL not found'), { statusCode: 404 });
    if (!['APPROVED', 'ENQUIRY_SENT'].includes(prl.status as string)) {
      throw Object.assign(new Error('PRL must be APPROVED to create enquiry'), { statusCode: 422 });
    }

    const docNo = await getNextDocNo(this.prisma, companyId, 'PROCUREMENT', 'PE');

    const enquiry = await this.prisma.purchaseEnquiry.create({
      data: {
        companyId,
        docNo,
        docDate: new Date(),
        prlId: id,
        status: 'DRAFT',
        createdById,
      },
    });

    // Mark PRL as enquiry sent
    await this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: 'ENQUIRY_SENT' },
    });

    return enquiry;
  }

  // ── Fulfilment status ──────────────────────────────────────────────────────
  async getFulfilmentStatus(id: string, companyId: string) {
    const prl = await this.prisma.purchaseRequisition.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: {
            item: { select: { code: true, description: true } },
          },
        },
        enquiries: {
          include: { quotations: true },
        },
      },
    });

    if (!prl) throw Object.assign(new Error('PRL not found'), { statusCode: 404 });

    const lineStatuses = prl.lines.map((line) => {
      const orderedQty = 0; // would join with PO lines in a full implementation
      return {
        lineId: line.id,
        itemCode: line.item.code,
        itemName: line.item.name,
        requestedQty: Number(line.requestedQty),
        orderedQty,
        isShortClosed: line.isShortClosed,
        fulfilmentPct: line.requestedQty > 0 ? Math.min(100, (orderedQty / Number(line.requestedQty)) * 100) : 0,
      };
    });

    return {
      docNo: prl.docNo,
      status: prl.status,
      enquiryCount: prl.enquiries.length,
      lineStatuses,
    };
  }
}
