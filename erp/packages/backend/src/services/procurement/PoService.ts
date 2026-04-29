import { PrismaClient, PoStatus } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { WorkflowService } from '../WorkflowService.js';
import { NotificationService } from '../NotificationService.js';

export interface CreatePoInput {
  companyId: string;
  supplierId: string;
  currencyId: string;
  exchangeRate?: number;
  paymentTerms?: string;
  incoterms?: string;
  docDate: string;
  deliveryDate?: string;
  shipToLocationId?: string;
  warehouseId?: string;
  notes?: string;
  lines: Array<{
    itemId: string;
    uomId: string;
    orderedQty: number;
    unitPrice: number;
    discountPct?: number;
    taxPct?: number;
    chargeCodeId: string;
  }>;
}

export interface UpdatePoInput {
  paymentTerms?: string;
  incoterms?: string;
  deliveryDate?: string;
  shipToLocationId?: string;
  warehouseId?: string;
  notes?: string;
  lines?: Array<{
    id?: string;
    itemId: string;
    uomId: string;
    orderedQty: number;
    unitPrice: number;
    discountPct?: number;
    taxPct?: number;
    chargeCodeId: string;
  }>;
}

interface ListPoQuery {
  companyId: string;
  status?: PoStatus;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

function calcLineAmount(orderedQty: number, unitPrice: number, discountPct: number, taxPct: number) {
  const gross = orderedQty * unitPrice;
  const discount = gross * (discountPct / 100);
  const net = gross - discount;
  const tax = net * (taxPct / 100);
  return +(net + tax).toFixed(3);
}

export class PoService {
  private workflow: WorkflowService;
  private notif: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.workflow = new WorkflowService(prisma);
    this.notif = new NotificationService(prisma);
  }

  // ── List ───────────────────────────────────────────────────────────────────
  async list(query: ListPoQuery) {
    const { companyId, status, supplierId, dateFrom, dateTo, search, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.docDate = {};
      if (dateFrom) where.docDate.gte = new Date(dateFrom);
      if (dateTo) where.docDate.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { code: true, name: true } },
          currency: { select: { code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID with GRN status and invoice status per line ─────────────────
  async getById(id: string, companyId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        supplier: {
          include: {
            contacts: true,
            bankDetails: true,
          },
        },
        currency: true,
        shipToLocation: true,
        warehouse: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        lines: {
          include: {
            item: { select: { id: true, code: true, description: true } },
            uom: { select: { id: true, code: true } },
            chargeCode: { select: { id: true, code: true, name: true } },
          },
          orderBy: { lineNo: 'asc' },
        },
        grnHeaders: {
          select: { id: true, docNo: true, status: true, docDate: true },
        },
        apInvoices: {
          select: { id: true, docNo: true, status: true, invoiceDate: true, totalAmount: true },
        },
      },
    });

    if (!po) throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });

    // Compute line-level GRN and invoice status
    const enrichedLines = po.lines.map((line) => ({
      ...line,
      pendingQty: Math.max(0, Number(line.orderedQty) - Number(line.receivedQty)),
      completionPct:
        Number(line.orderedQty) > 0
          ? Math.min(100, (Number(line.receivedQty) / Number(line.orderedQty)) * 100)
          : 0,
    }));

    return { ...po, lines: enrichedLines };
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(input: CreatePoInput, createdById: string) {
    if (!input.lines?.length) {
      throw Object.assign(new Error('PO must have at least one line'), { statusCode: 422 });
    }

    // Validate supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, companyId: input.companyId, isActive: true },
    });
    if (!supplier) {
      throw Object.assign(new Error('Supplier not found or inactive'), { statusCode: 422 });
    }

    const docNo = await getNextDocNo(this.prisma, input.companyId, 'PROCUREMENT', 'PO');

    const lineData = input.lines.map((l, idx) => ({
      itemId: l.itemId,
      uomId: l.uomId,
      orderedQty: l.orderedQty,
      receivedQty: 0,
      invoicedQty: 0,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct ?? 0,
      taxPct: l.taxPct ?? 0,
      netAmount: calcLineAmount(l.orderedQty, l.unitPrice, l.discountPct ?? 0, l.taxPct ?? 0),
      chargeCodeId: l.chargeCodeId,
      lineNo: idx + 1,
    }));

    const totalAmount = lineData.reduce((s, l) => s + l.netAmount, 0);

    const po = await this.prisma.purchaseOrder.create({
      data: {
        companyId: input.companyId,
        docNo,
        docDate: new Date(input.docDate),
        supplierId: input.supplierId,
        currencyId: input.currencyId,
        exchangeRate: input.exchangeRate ?? 1,
        paymentTerms: input.paymentTerms ?? null,
        incoterms: input.incoterms ?? null,
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
        shipToLocationId: input.shipToLocationId ?? null,
        warehouseId: input.warehouseId ?? null,
        notes: input.notes ?? null,
        status: 'DRAFT',
        createdById,
        totalAmount,
        lines: { createMany: { data: lineData } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'PO',
        recordId: po.id,
        userId: createdById,
        action: 'CREATE',
        newValues: { docNo, status: 'DRAFT', totalAmount },
      },
    });

    return this.getById(po.id, input.companyId);
  }

  // ── Update (DRAFT only) ────────────────────────────────────────────────────
  async update(id: string, companyId: string, input: UpdatePoInput, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });
    if (po.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT POs can be edited'), { statusCode: 422 });
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.lines) {
        await tx.poLine.deleteMany({ where: { poId: id } });
        const lineData = input.lines.map((l, idx) => ({
          poId: id,
          itemId: l.itemId,
          uomId: l.uomId,
          orderedQty: l.orderedQty,
          receivedQty: 0,
          invoicedQty: 0,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct ?? 0,
          taxPct: l.taxPct ?? 0,
          netAmount: calcLineAmount(l.orderedQty, l.unitPrice, l.discountPct ?? 0, l.taxPct ?? 0),
          chargeCodeId: l.chargeCodeId,
          lineNo: idx + 1,
        }));
        await tx.poLine.createMany({ data: lineData });

        const totalAmount = lineData.reduce((s, l) => s + l.netAmount, 0);
        return tx.purchaseOrder.update({
          where: { id },
          data: {
            paymentTerms: input.paymentTerms,
            incoterms: input.incoterms,
            deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
            shipToLocationId: input.shipToLocationId,
            warehouseId: input.warehouseId,
            notes: input.notes,
            totalAmount,
          },
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          paymentTerms: input.paymentTerms,
          incoterms: input.incoterms,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
          shipToLocationId: input.shipToLocationId,
          warehouseId: input.warehouseId,
          notes: input.notes,
        },
      });
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async submit(id: string, companyId: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });
    if (po.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT POs can be submitted'), { statusCode: 422 });
    }

    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'SUBMITTED' } });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'PO',
        recordId: id,
        userId,
        action: 'UPDATE',
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'SUBMITTED' },
      },
    });

    // Notify approvers
    await this.notifyApprovers(companyId, 'PO', po.docNo, id);

    return { message: 'PO submitted for approval', docNo: po.docNo };
  }

  // ── Approve ────────────────────────────────────────────────────────────────
  async approve(id: string, companyId: string, userId: string, comment?: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: { supplier: { include: { contacts: { where: { isPrimary: true } } } } },
    });
    if (!po) throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });

    const result = await this.workflow.processApproval({
      docType: 'PO',
      docId: id,
      userId,
      action: 'approve',
      comment,
      totalAmount: Number(po.totalAmount),
    });

    // Send confirmation email to supplier if fully approved
    if (result.status === 'APPROVED') {
      const primaryContact = (po.supplier as any).contacts?.[0];
      if (primaryContact?.email) {
        await this.notif.sendEmail({
          to: primaryContact.email,
          subject: `Purchase Order Confirmation - ${po.docNo}`,
          html: `<p>Dear ${primaryContact.name},</p><p>Please find attached Purchase Order <strong>${po.docNo}</strong> for your action.</p>`,
        });
      }
    }

    return result;
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  async reject(id: string, companyId: string, userId: string, reason: string) {
    if (!reason?.trim()) {
      throw Object.assign(new Error('Rejection reason is required'), { statusCode: 422 });
    }
    return this.workflow.processApproval({
      docType: 'PO',
      docId: id,
      userId,
      action: 'reject',
      comment: reason,
    });
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────
  async cancel(id: string, companyId: string, userId: string, reason: string) {
    if (!reason?.trim()) {
      throw Object.assign(new Error('Cancellation reason is required'), { statusCode: 422 });
    }
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });
    if (['RECEIVED', 'INVOICED', 'CLOSED', 'CANCELLED'].includes(po.status)) {
      throw Object.assign(
        new Error(`Cannot cancel a PO with status ${po.status}`),
        { statusCode: 422 }
      );
    }

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'PO',
        recordId: id,
        userId,
        action: 'UPDATE',
        oldValues: { status: po.status },
        newValues: { status: 'CANCELLED', reason },
      },
    });

    return { message: 'Purchase Order cancelled', docNo: po.docNo };
  }

  // ── Short close ────────────────────────────────────────────────────────────
  async shortClose(id: string, companyId: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });
    if (!['APPROVED', 'PARTIAL'].includes(po.status)) {
      throw Object.assign(new Error('Only APPROVED or PARTIAL POs can be short-closed'), { statusCode: 422 });
    }

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    return { message: 'Purchase Order short-closed', docNo: po.docNo };
  }

  // ── Private ────────────────────────────────────────────────────────────────
  private async notifyApprovers(companyId: string, docType: string, docNo: string, docId: string) {
    const approvers = await this.prisma.user.findMany({
      where: {
        companyId,
        isActive: true,
        role: {
          permissions: {
            some: { module: 'PROCUREMENT', resource: 'PO', action: 'APPROVE' },
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
