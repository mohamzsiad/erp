import { PrismaClient } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { WorkflowService } from '../WorkflowService.js';
import { NotificationService } from '../NotificationService.js';

interface CreateMrlInput {
  companyId: string;
  locationId: string;
  chargeCodeId: string;
  docDate: string;
  deliveryDate: string;
  remarks?: string;
  lines: Array<{
    itemId: string;
    uomId: string;
    requestedQty: number;
    approxPrice?: number;
    grade1?: string;
    grade2?: string;
  }>;
}

interface UpdateMrlInput {
  chargeCodeId?: string;
  deliveryDate?: string;
  remarks?: string;
  lines?: Array<{
    id?: string;
    itemId: string;
    uomId: string;
    requestedQty: number;
    approxPrice?: number;
    grade1?: string;
    grade2?: string;
  }>;
}

interface ListMrlQuery {
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

export class MrlService {
  private workflow: WorkflowService;
  private notif: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.workflow = new WorkflowService(prisma);
    this.notif = new NotificationService(prisma);
  }

  // ── List ───────────────────────────────────────────────────────────────────
  async list(query: ListMrlQuery) {
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
      this.prisma.materialRequisition.findMany({
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
      this.prisma.materialRequisition.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID with lines and live free stock ───────────────────────────────
  async getById(id: string, companyId: string) {
    const mrl = await this.prisma.materialRequisition.findFirst({
      where: { id, companyId },
      include: {
        location: true,
        chargeCode: true,
        lines: {
          include: {
            item: { select: { id: true, code: true, description: true, trackingType: true } },
            uom: { select: { id: true, code: true, name: true } },
          },
          orderBy: { lineNo: 'asc' },
        },
      },
    });

    if (!mrl) {
      throw Object.assign(new Error('MRL not found'), { statusCode: 404 });
    }

    // Enrich lines with live free stock
    const enrichedLines = await Promise.all(
      mrl.lines.map(async (line) => {
        const stock = await this.prisma.stockBalance.findFirst({
          where: { itemId: line.itemId },
          select: { qtyOnHand: true, qtyReserved: true },
        });
        const qtyOnHand = Number(stock?.qtyOnHand ?? 0);
        const qtyReserved = Number(stock?.qtyReserved ?? 0);
        return {
          ...line,
          liveStock: {
            qtyOnHand,
            qtyReserved,
            freeStock: Math.max(0, qtyOnHand - qtyReserved),
          },
        };
      })
    );

    return { ...mrl, lines: enrichedLines };
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(input: CreateMrlInput, createdById: string) {
    if (!input.lines?.length) {
      throw Object.assign(new Error('MRL must have at least one line'), { statusCode: 422 });
    }

    const docNo = await getNextDocNo(this.prisma, input.companyId, 'PROCUREMENT', 'MRL');

    const mrl = await this.prisma.materialRequisition.create({
      data: {
        companyId: input.companyId,
        docNo,
        docDate: new Date(input.docDate),
        locationId: input.locationId,
        chargeCodeId: input.chargeCodeId,
        deliveryDate: new Date(input.deliveryDate),
        remarks: input.remarks ?? null,
        status: 'DRAFT',
        createdById,
        lines: {
          createMany: {
            data: input.lines.map((l, idx) => ({
              itemId: l.itemId,
              uomId: l.uomId,
              requestedQty: l.requestedQty,
              approvedQty: 0,
              approxPrice: l.approxPrice ?? 0,
              grade1: l.grade1 ?? null,
              grade2: l.grade2 ?? null,
              freeStock: 0,
              lineNo: idx + 1,
            })),
          },
        },
      },
      include: { lines: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'MRL',
        recordId: mrl.id,
        userId: createdById,
        action: 'CREATE',
        newValues: { docNo, status: 'DRAFT' },
      },
    });

    return mrl;
  }

  // ── Update (DRAFT only) ────────────────────────────────────────────────────
  async update(id: string, companyId: string, input: UpdateMrlInput, userId: string) {
    const mrl = await this.prisma.materialRequisition.findFirst({ where: { id, companyId } });
    if (!mrl) throw Object.assign(new Error('MRL not found'), { statusCode: 404 });
    if (mrl.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT MRLs can be edited'), { statusCode: 422 });
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.lines) {
        // Delete existing lines and recreate
        await tx.mrlLine.deleteMany({ where: { mrlId: id } });
        await tx.mrlLine.createMany({
          data: input.lines.map((l, idx) => ({
            mrlId: id,
            itemId: l.itemId,
            uomId: l.uomId,
            requestedQty: l.requestedQty,
            approvedQty: 0,
            approxPrice: l.approxPrice ?? 0,
            grade1: l.grade1 ?? null,
            grade2: l.grade2 ?? null,
            freeStock: 0,
            lineNo: idx + 1,
          })),
        });
      }

      return tx.materialRequisition.update({
        where: { id },
        data: {
          chargeCodeId: input.chargeCodeId,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
          remarks: input.remarks,
        },
        include: { lines: true },
      });
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async submit(id: string, companyId: string, userId: string) {
    const mrl = await this.prisma.materialRequisition.findFirst({ where: { id, companyId } });
    if (!mrl) throw Object.assign(new Error('MRL not found'), { statusCode: 404 });
    if (mrl.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT MRLs can be submitted'), { statusCode: 422 });
    }

    await this.prisma.materialRequisition.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'MRL',
        recordId: id,
        userId,
        action: 'UPDATE',
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'SUBMITTED' },
      },
    });

    // Notify approvers (find users with PROCUREMENT:MRL:APPROVE permission)
    await this.notifyApprovers(companyId, 'MRL', mrl.docNo, id);

    return { message: 'MRL submitted for approval', docNo: mrl.docNo };
  }

  // ── Approve ────────────────────────────────────────────────────────────────
  async approve(
    id: string,
    companyId: string,
    userId: string,
    comment?: string,
    lineAdjustments?: Array<{ lineId: string; approvedQty: number }>
  ) {
    return this.workflow.processApproval({
      docType: 'MRL',
      docId: id,
      userId,
      action: 'approve',
      comment,
      lineAdjustments,
    });
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  async reject(id: string, companyId: string, userId: string, reason: string) {
    if (!reason?.trim()) {
      throw Object.assign(new Error('Rejection reason is required'), { statusCode: 422 });
    }
    return this.workflow.processApproval({
      docType: 'MRL',
      docId: id,
      userId,
      action: 'reject',
      comment: reason,
    });
  }

  // ── Convert to PRL ─────────────────────────────────────────────────────────
  async convertToPrl(id: string, companyId: string, createdById: string) {
    const mrl = await this.prisma.materialRequisition.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });

    if (!mrl) throw Object.assign(new Error('MRL not found'), { statusCode: 404 });
    if (mrl.status !== 'APPROVED') {
      throw Object.assign(new Error('Only APPROVED MRLs can be converted to PRL'), { statusCode: 422 });
    }

    const docNo = await getNextDocNo(this.prisma, companyId, 'PROCUREMENT', 'PRL');

    const prl = await this.prisma.$transaction(async (tx) => {
      const newPrl = await tx.purchaseRequisition.create({
        data: {
          companyId,
          docNo,
          docDate: new Date(),
          locationId: mrl.locationId,
          chargeCodeId: mrl.chargeCodeId,
          deliveryDate: mrl.deliveryDate,
          remarks: mrl.remarks,
          status: 'DRAFT',
          mrlId: mrl.id,
          createdById,
          lines: {
            createMany: {
              data: mrl.lines.map((l) => ({
                itemId: l.itemId,
                uomId: l.uomId,
                requestedQty: l.approvedQty ?? l.requestedQty,
                approvedQty: 0,
                approxPrice: l.approxPrice,
                grade1: l.grade1,
                grade2: l.grade2,
                freeStock: l.freeStock,
                chargeCodeId: mrl.chargeCodeId,
                lineNo: l.lineNo,
                isShortClosed: false,
              })),
            },
          },
        },
      });

      await tx.materialRequisition.update({
        where: { id },
        data: { status: 'CONVERTED' },
      });

      return newPrl;
    });

    return { message: 'PRL created from MRL', prl };
  }

  // ── Private: notify approvers ──────────────────────────────────────────────
  private async notifyApprovers(companyId: string, docType: string, docNo: string, docId: string) {
    // Find users who have the approve permission for MRL
    const approvers = await this.prisma.user.findMany({
      where: {
        companyId,
        isActive: true,
        role: {
          permissions: {
            some: {
              module: 'PROCUREMENT',
              resource: 'MRL',
              action: 'APPROVE',
            },
          },
        },
      },
      select: { id: true },
    });

    await this.notif.createNotifications(
      approvers.map((a) => ({
        userId: a.id,
        type: 'APPROVAL_REQUIRED',
        title: `${docType} Awaiting Your Approval`,
        message: `Document ${docNo} requires your approval.`,
        docType,
        docId,
      }))
    );
  }
}
