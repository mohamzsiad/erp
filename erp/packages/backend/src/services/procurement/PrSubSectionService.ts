/**
 * PrSubSectionService
 * Handles all 7 sub-sections of a Purchase Requisition line:
 *   1. Delivery Schedule
 *   2. Account / Budget Details
 *   3. Alternate Items
 *   4. Item Status (read-only aggregation)
 *   5. Short Close / Reopen
 *   6. Attachments (Input)
 *   7. Lead Time
 */
import { PrismaClient, ShortCloseStatus, LeadTimeSource } from '@prisma/client';
import { config } from '../../config.js';

const PR_ATTACHMENTS_CONTAINER = 'pr-attachments';

// Azure Blob Storage — lazy singleton (optional)
let _blobClient: any = null;
function getBlobClient() {
  if (_blobClient) return _blobClient;
  if (!config.AZURE_STORAGE_CONNECTION_STRING) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BlobServiceClient } = require('@azure/storage-blob');
    _blobClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);
    return _blobClient;
  } catch {
    return null;
  }
}

export class PrSubSectionService {
  constructor(private prisma: PrismaClient) {}

  // ─── Guard: verify PR line belongs to company ────────────────────────────────
  private async assertLineOwnership(lineId: string, companyId: string) {
    const line = await this.prisma.prlLine.findFirst({
      where: { id: lineId, prl: { companyId } },
      select: {
        id: true,
        requestedQty: true,
        approxPrice: true,
        itemId: true,
        prlId: true,
        prl: { select: { status: true, deliveryDate: true, approvedById: true } },
      },
    });
    if (!line) throw Object.assign(new Error('PR line not found'), { statusCode: 404 });
    return line;
  }

  private isReadOnly(status: string) {
    return ['CLOSED', 'SHORT_CLOSED'].includes(status);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DELIVERY SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════

  async getDeliverySchedules(lineId: string, companyId: string) {
    await this.assertLineOwnership(lineId, companyId);
    return this.prisma.prDeliverySchedule.findMany({
      where: { prlLineId: lineId },
      include: { location: { select: { id: true, code: true, name: true } } },
      orderBy: { deliveryDate: 'asc' },
    });
  }

  async upsertDeliverySchedules(
    lineId: string,
    companyId: string,
    rows: Array<{ id?: string; deliveryDate: string; qty: number; locationId?: string; remarks?: string }>
  ) {
    const line = await this.assertLineOwnership(lineId, companyId);
    if (this.isReadOnly(line.prl.status)) {
      throw Object.assign(new Error('PR is closed — cannot modify delivery schedule'), { statusCode: 400 });
    }

    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    if (totalQty > Number(line.requestedQty)) {
      throw Object.assign(
        new Error(`Scheduled qty (${totalQty}) exceeds line req qty (${line.requestedQty})`),
        { statusCode: 400 }
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete removed rows
      const incomingIds = rows.filter((r) => r.id).map((r) => r.id as string);
      await tx.prDeliverySchedule.deleteMany({
        where: { prlLineId: lineId, id: { notIn: incomingIds } },
      });

      // Upsert each row
      const results = [];
      for (const row of rows) {
        const data = {
          prlLineId: lineId,
          deliveryDate: new Date(row.deliveryDate),
          qty: row.qty,
          locationId: row.locationId ?? null,
          remarks: row.remarks ?? null,
        };
        if (row.id) {
          results.push(await tx.prDeliverySchedule.update({ where: { id: row.id }, data }));
        } else {
          results.push(await tx.prDeliverySchedule.create({ data }));
        }
      }
      return results;
    });
  }

  async deleteDeliverySchedule(scheduleId: string, lineId: string, companyId: string) {
    const line = await this.assertLineOwnership(lineId, companyId);
    if (this.isReadOnly(line.prl.status)) {
      throw Object.assign(new Error('PR is closed'), { statusCode: 400 });
    }
    await this.prisma.prDeliverySchedule.deleteMany({
      where: { id: scheduleId, prlLineId: lineId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ACCOUNT / BUDGET DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAccountDetails(lineId: string, companyId: string) {
    await this.assertLineOwnership(lineId, companyId);
    return this.prisma.prAccountDetail.findMany({
      where: { prlLineId: lineId },
      include: {
        glAccount:  { select: { id: true, code: true, name: true } },
        costCentre: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertAccountDetails(
    lineId: string,
    companyId: string,
    rows: Array<{
      id?: string;
      glAccountId: string;
      costCentreId: string;
      projectCode?: string;
      percentage: number;
      budgetYear: number;
    }>
  ) {
    const line = await this.assertLineOwnership(lineId, companyId);
    if (this.isReadOnly(line.prl.status)) {
      throw Object.assign(new Error('PR is closed'), { statusCode: 400 });
    }

    const totalPct = rows.reduce((s, r) => s + r.percentage, 0);
    // Allow slight floating-point tolerance
    if (Math.abs(totalPct - 100) > 0.01) {
      throw Object.assign(
        new Error(`Percentages must sum to 100 (current total: ${totalPct.toFixed(2)})`),
        { statusCode: 400 }
      );
    }

    const lineValue = Number(line.approxPrice) * Number(line.requestedQty);

    return this.prisma.$transaction(async (tx) => {
      const incomingIds = rows.filter((r) => r.id).map((r) => r.id as string);
      await tx.prAccountDetail.deleteMany({
        where: { prlLineId: lineId, id: { notIn: incomingIds } },
      });

      const results = [];
      for (const row of rows) {
        const amount = (row.percentage / 100) * lineValue;
        const data = {
          prlLineId:   lineId,
          glAccountId: row.glAccountId,
          costCentreId: row.costCentreId,
          projectCode: row.projectCode ?? null,
          percentage:  row.percentage,
          amount,
          budgetYear:  row.budgetYear,
        };
        if (row.id) {
          results.push(await tx.prAccountDetail.update({ where: { id: row.id }, data }));
        } else {
          results.push(await tx.prAccountDetail.create({ data }));
        }
      }
      return results;
    });
  }

  async deleteAccountDetail(detailId: string, lineId: string, companyId: string) {
    const line = await this.assertLineOwnership(lineId, companyId);
    if (this.isReadOnly(line.prl.status)) {
      throw Object.assign(new Error('PR is closed'), { statusCode: 400 });
    }
    await this.prisma.prAccountDetail.deleteMany({
      where: { id: detailId, prlLineId: lineId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ALTERNATE ITEMS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAlternateItems(lineId: string, companyId: string) {
    await this.assertLineOwnership(lineId, companyId);
    return this.prisma.prAlternateItem.findMany({
      where: { prlLineId: lineId },
      include: { item: { select: { id: true, code: true, description: true } } },
      orderBy: { priority: 'asc' },
    });
  }

  async upsertAlternateItems(
    lineId: string,
    companyId: string,
    rows: Array<{
      id?: string;
      itemId: string;
      grade1?: string;
      grade2?: string;
      uom?: string;
      approxPrice?: number;
      priority: number;
      remarks?: string;
    }>
  ) {
    const line = await this.assertLineOwnership(lineId, companyId);
    if (this.isReadOnly(line.prl.status)) {
      throw Object.assign(new Error('PR is closed'), { statusCode: 400 });
    }

    return this.prisma.$transaction(async (tx) => {
      const incomingIds = rows.filter((r) => r.id).map((r) => r.id as string);
      await tx.prAlternateItem.deleteMany({
        where: { prlLineId: lineId, id: { notIn: incomingIds } },
      });

      const results = [];
      for (const row of rows) {
        const data = {
          prlLineId:  lineId,
          itemId:     row.itemId,
          grade1:     row.grade1 ?? null,
          grade2:     row.grade2 ?? null,
          uom:        row.uom ?? null,
          approxPrice: row.approxPrice ?? 0,
          priority:   row.priority,
          remarks:    row.remarks ?? null,
        };
        if (row.id) {
          results.push(await tx.prAlternateItem.update({ where: { id: row.id }, data }));
        } else {
          results.push(await tx.prAlternateItem.create({ data }));
        }
      }
      return results;
    });
  }

  async deleteAlternateItem(altId: string, lineId: string, companyId: string) {
    await this.assertLineOwnership(lineId, companyId);
    await this.prisma.prAlternateItem.deleteMany({
      where: { id: altId, prlLineId: lineId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ITEM STATUS  (aggregated read — no new model)
  // ═══════════════════════════════════════════════════════════════════════════

  async getItemStatus(lineId: string, companyId: string) {
    const line = await this.assertLineOwnership(lineId, companyId);

    const [item, stockBalance, openPRs, openPOs, lastPO] = await Promise.all([
      // Item master
      this.prisma.item.findUnique({
        where: { id: line.itemId },
        select: { id: true, code: true, description: true, reorderLevel: true, minStock: true },
      }),

      // Stock balance (sum across all warehouses for this company)
      this.prisma.stockBalance.aggregate({
        where: { itemId: line.itemId, warehouse: { companyId } },
        _sum: { qtyOnHand: true, qtyReserved: true },
      }),

      // Open PR qty (other lines, same item, same company, not closed)
      this.prisma.prlLine.aggregate({
        where: {
          itemId: line.itemId,
          id:     { not: lineId },
          prl:    { companyId, status: { notIn: ['CLOSED', 'SHORT_CLOSED'] } },
        },
        _sum: { requestedQty: true },
      }),

      // Open PO qty (not fully received)
      this.prisma.poLine.aggregate({
        where: {
          itemId: line.itemId,
          po:     { companyId, status: { notIn: ['RECEIVED', 'CLOSED', 'CANCELLED'] } },
        },
        _sum: { orderedQty: true },
      }),

      // Last PO for this item
      this.prisma.poLine.findFirst({
        where: { itemId: line.itemId, po: { companyId } },
        orderBy: { po: { docDate: 'desc' } },
        select: {
          unitPrice: true,
          po: {
            select: {
              docDate: true,
              supplier: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const currentStock  = Number(stockBalance._sum.qtyOnHand  ?? 0);
    const reservedQty   = Number(stockBalance._sum.qtyReserved ?? 0);
    const availableStock = currentStock - reservedQty;

    // Rough avg lead time from recent POs
    const recentPOs = await this.prisma.purchaseOrder.findMany({
      where: { companyId, lines: { some: { itemId: line.itemId } } },
      orderBy: { docDate: 'desc' },
      take: 10,
      select: { docDate: true, deliveryDate: true },
    });

    let avgLeadTimeDays: number | null = null;
    const diffs = recentPOs
      .filter((p) => p.deliveryDate)
      .map((p) =>
        Math.round(
          (new Date(p.deliveryDate!).getTime() - new Date(p.docDate).getTime()) / 86400000
        )
      )
      .filter((d) => d > 0);

    if (diffs.length > 0) {
      avgLeadTimeDays = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    }

    return {
      itemId:           item?.id,
      itemCode:         item?.code,
      description:      item?.description,
      currentStock,
      reservedQty,
      availableStock,
      openPRQty:        Number(openPRs._sum.requestedQty ?? 0),
      openPOQty:        Number(openPOs._sum.orderedQty   ?? 0),
      lastPurchaseDate:  lastPO?.po.docDate  ?? null,
      lastPurchasePrice: lastPO ? Number(lastPO.unitPrice) : null,
      lastSupplier:      lastPO?.po.supplier.name ?? null,
      avgLeadTimeDays,
      reorderLevel:     item ? Number(item.reorderLevel) : null,
      safetyStock:      item ? Number(item.minStock)     : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SHORT CLOSE
  // ═══════════════════════════════════════════════════════════════════════════

  async getShortCloseInfo(lineId: string, companyId: string) {
    const line = await this.prisma.prlLine.findFirst({
      where: { id: lineId, prl: { companyId } },
      select: {
        id: true,
        requestedQty: true,
        shortClosedQty: true,
        shortCloseReason: true,
        shortClosedAt: true,
        shortClosedById: true,
        shortCloseStatus: true,
        prl: { select: { status: true } },
      },
    });
    if (!line) throw Object.assign(new Error('PR line not found'), { statusCode: 404 });

    // Note: PoLine does not have a direct prlLineId FK in the current schema.
    // onPOQty is returned as 0 unless extended with a prlLineId relation.
    return {
      ...line,
      requestedQty:   Number(line.requestedQty),
      shortClosedQty: Number(line.shortClosedQty),
      onPOQty:        0,
      prStatus:       line.prl.status,
    };
  }

  async shortCloseLine(
    lineId: string,
    companyId: string,
    userId: string,
    qty: number,
    reason: string
  ) {
    const line = await this.assertLineOwnership(lineId, companyId);

    if (!['APPROVED', 'ENQUIRY_SENT', 'PO_CREATED'].includes(line.prl.status)) {
      throw Object.assign(
        new Error('Short close is only allowed on approved or in-progress PRs'),
        { statusCode: 400 }
      );
    }
    if (qty <= 0 || qty > Number(line.requestedQty)) {
      throw Object.assign(
        new Error(`Close qty must be between 1 and ${line.requestedQty}`),
        { statusCode: 400 }
      );
    }

    const status: ShortCloseStatus =
      qty >= Number(line.requestedQty) ? 'FULL' : 'PARTIAL';

    return this.prisma.prlLine.update({
      where: { id: lineId },
      data: {
        shortClosedQty:  qty,
        shortCloseReason: reason,
        shortClosedAt:   new Date(),
        shortClosedById: userId,
        shortCloseStatus: status,
        isShortClosed: status === 'FULL',
      },
    });
  }

  async reopenLine(lineId: string, companyId: string, userId: string) {
    const line = await this.assertLineOwnership(lineId, companyId);

    return this.prisma.prlLine.update({
      where: { id: lineId },
      data: {
        shortClosedQty:   0,
        shortCloseReason: null,
        shortClosedAt:    null,
        shortClosedById:  null,
        shortCloseStatus: 'NONE',
        isShortClosed:    false,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. ATTACHMENTS (INPUT)
  // ═══════════════════════════════════════════════════════════════════════════

  async getAttachments(lineId: string, companyId: string) {
    await this.assertLineOwnership(lineId, companyId);

    const attachments = await this.prisma.prLineAttachment.findMany({
      where: { prlLineId: lineId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    });

    // Return with sasUrl (in production, generate time-limited SAS token)
    return attachments.map((a: any) => ({ ...a, sasUrl: a.blobUrl }));
  }

  async uploadAttachment(
    lineId: string,
    companyId: string,
    userId: string,
    file: {
      filename: string;
      mimetype: string;
      buffer: Buffer;
    }
  ) {
    await this.assertLineOwnership(lineId, companyId);

    const ALLOWED_TYPES = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // DWG files
    ];

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw Object.assign(
        new Error('File type not allowed. Permitted: PDF, PNG, JPG, XLSX, DOCX, DWG'),
        { statusCode: 400 }
      );
    }

    if (file.buffer.length > 10 * 1024 * 1024) {
      throw Object.assign(new Error('File size exceeds 10 MB limit'), { statusCode: 400 });
    }

    // Check file count per line
    const count = await this.prisma.prLineAttachment.count({
      where: { prlLineId: lineId, deletedAt: null },
    });
    if (count >= 10) {
      throw Object.assign(new Error('Maximum 10 attachments per line'), { statusCode: 400 });
    }

    let blobUrl = '';
    const blobName = `${lineId}/${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const blobSvc = getBlobClient();
    if (blobSvc) {
      const container = blobSvc.getContainerClient(PR_ATTACHMENTS_CONTAINER);
      await container.createIfNotExists({ access: 'private' });
      const blockBlob = container.getBlockBlobClient(blobName);
      await blockBlob.upload(file.buffer, file.buffer.length, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });
      blobUrl = blockBlob.url;
    } else {
      // Dev fallback: store as data URL placeholder
      blobUrl = `/dev-uploads/${blobName}`;
    }

    return this.prisma.prLineAttachment.create({
      data: {
        prlLineId:    lineId,
        fileName:     file.filename,
        blobUrl,
        blobName,
        fileSize:     file.buffer.length,
        mimeType:     file.mimetype,
        uploadedById: userId,
      },
    });
  }

  async deleteAttachment(attachmentId: string, lineId: string, companyId: string, userId: string) {
    await this.assertLineOwnership(lineId, companyId);

    // Soft delete
    await this.prisma.prLineAttachment.updateMany({
      where: { id: attachmentId, prlLineId: lineId },
      data: { deletedAt: new Date() },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. LEAD TIME
  // ═══════════════════════════════════════════════════════════════════════════

  async getLeadTime(lineId: string, companyId: string) {
    const line = await this.prisma.prlLine.findFirst({
      where: { id: lineId, prl: { companyId } },
      select: {
        id: true,
        itemId: true,
        leadTimeDays: true,
        expectedDeliveryDate: true,
        leadTimeSource: true,
        prl: { select: { status: true, approvedById: true, updatedAt: true } },
      },
    });
    if (!line) throw Object.assign(new Error('PR line not found'), { statusCode: 404 });

    // Historical lead times from last 5 POs for this item
    const historicalPOs = await this.prisma.poLine.findMany({
      where: {
        itemId: line.itemId,
        po: { companyId, status: { notIn: ['CANCELLED', 'DRAFT'] } },
      },
      orderBy: { po: { docDate: 'desc' } },
      take: 5,
      select: {
        po: {
          select: {
            docNo:        true,
            docDate:      true,
            deliveryDate: true,
            supplier:     { select: { name: true } },
          },
        },
      },
    });

    const historicalLeadTimes = historicalPOs
      .filter((p) => p.po.deliveryDate)
      .map((p) => ({
        poNumber:     p.po.docNo,
        supplier:     p.po.supplier.name,
        poDate:       p.po.docDate,
        leadTimeDays: Math.round(
          (new Date(p.po.deliveryDate!).getTime() - new Date(p.po.docDate).getTime()) / 86400000
        ),
      }));

    // System average
    const systemLeadTimeDays =
      historicalLeadTimes.length > 0
        ? Math.round(
            historicalLeadTimes.reduce((s, h) => s + h.leadTimeDays, 0) /
              historicalLeadTimes.length
          )
        : null;

    const effectiveLeadTimeDays = line.leadTimeDays ?? systemLeadTimeDays ?? 0;

    // Find approval date (when status last changed to APPROVED)
    const prApprovalDate =
      line.prl.approvedById ? line.prl.updatedAt : null;

    return {
      itemId:               line.itemId,
      systemLeadTimeDays,
      manualLeadTimeDays:   line.leadTimeDays,
      effectiveLeadTimeDays,
      source:               line.leadTimeSource,
      expectedDeliveryDate: line.expectedDeliveryDate,
      prApprovalDate,
      historicalLeadTimes,
    };
  }

  async updateLeadTime(
    lineId: string,
    companyId: string,
    leadTimeDays: number | null
  ) {
    const line = await this.assertLineOwnership(lineId, companyId);

    let expectedDeliveryDate: Date | null = null;
    if (leadTimeDays !== null && line.prl.approvedById) {
      // Compute from approval date (approximated as updatedAt of the PR)
      const base = new Date();
      expectedDeliveryDate = new Date(base.getTime() + leadTimeDays * 86400000);
    }

    return this.prisma.prlLine.update({
      where: { id: lineId },
      data: {
        leadTimeDays,
        expectedDeliveryDate,
        leadTimeSource: leadTimeDays !== null ? LeadTimeSource.MANUAL : LeadTimeSource.SYSTEM,
      },
      select: {
        leadTimeDays: true,
        expectedDeliveryDate: true,
        leadTimeSource: true,
      },
    });
  }
}
