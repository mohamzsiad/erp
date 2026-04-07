import { PrismaClient } from '@prisma/client';
import { NotificationService } from './NotificationService.js';
import type { WorkflowLevel } from '@clouderp/shared';

export type WorkflowDocType = 'MRL' | 'PRL' | 'PO' | 'GRN' | 'SI' | 'SA' | 'JE' | 'API';

interface ApproveInput {
  docType: WorkflowDocType;
  docId: string;
  userId: string;
  action: 'approve' | 'reject';
  comment?: string;
  /** MRL/PRL specific: line-level quantity override on approval */
  lineAdjustments?: Array<{ lineId: string; approvedQty: number }>;
  /** The document's total value (for amount-based routing) */
  totalAmount?: number;
}

interface PendingTask {
  docType: string;
  docId: string;
  docNo: string;
  subject: string;
  requestedBy: string;
  requestedAt: Date;
  status: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generic workflow engine — used by Procurement, Inventory and Finance.
 *
 * WorkflowConfig.levels JSON shape:
 * [
 *   { "level": 1, "approverRole": "<roleId>", "minAmount": 0, "maxAmount": 10000 },
 *   { "level": 2, "approverRole": "<roleId>", "minAmount": 10000, "maxAmount": null }
 * ]
 *
 * Approval history is stored in AuditLog with tableName = docType (e.g. "MRL").
 */
export class WorkflowService {
  private notif: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notif = new NotificationService(prisma);
  }

  // ── Public: process an approve/reject action ──────────────────────────────
  async processApproval(input: ApproveInput): Promise<{ status: string; message: string }> {
    const { docType, docId, userId, action, comment, lineAdjustments, totalAmount } = input;

    // Get the document dynamically
    const doc = await this.getDocument(docType, docId);
    if (!doc) {
      throw Object.assign(new Error(`${docType} ${docId} not found`), { statusCode: 404 });
    }

    // Guard: must be in SUBMITTED / APPROVED state to action
    const validStatuses = ['SUBMITTED', 'PENDING'];
    if (!validStatuses.includes(doc.status)) {
      throw Object.assign(
        new Error(`Document is in status ${doc.status} — cannot ${action}`),
        { statusCode: 422 }
      );
    }

    // Load workflow config for this doc type
    const wfConfig = await this.prisma.workflowConfig.findUnique({
      where: {
        companyId_module_docType: {
          companyId: doc.companyId,
          module: this.moduleForDocType(docType),
          docType,
        },
      },
    });

    // Determine new status
    let newStatus: string;
    if (action === 'reject') {
      newStatus = 'REJECTED';
    } else {
      // Check if multi-level approval is needed
      const levels = ((wfConfig?.levels as unknown) as WorkflowLevel[] | null) ?? [];
      const requiredLevel = this.resolveRequiredLevel(levels, totalAmount ?? 0);
      const approvalCount = await this.countApprovals(docType, docId);

      if (requiredLevel > 1 && approvalCount < requiredLevel - 1) {
        // More approvals needed — stay in SUBMITTED, bump level
        newStatus = 'SUBMITTED';
      } else {
        newStatus = 'APPROVED';
      }
    }

    // Apply line adjustments before status update (MRL/PRL only)
    if (lineAdjustments?.length && (docType === 'MRL' || docType === 'PRL')) {
      await this.applyLineAdjustments(docType, lineAdjustments);
    }

    // Update document status
    await this.updateDocumentStatus(docType, docId, userId, newStatus, comment);

    // Record in audit log
    await this.prisma.auditLog.create({
      data: {
        tableName: docType,
        recordId: docId,
        userId,
        action: 'UPDATE',
        oldValues: { status: doc.status },
        newValues: { status: newStatus, action, comment },
      },
    });

    // Notify requestor
    if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
      await this.notif.notifyRequestor(
        doc.createdById,
        docType,
        doc.docNo,
        docId,
        action === 'approve' ? 'approved' : 'rejected',
        comment
      );
    }

    return {
      status: newStatus,
      message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    };
  }

  // ── Public: get approval history for a document ───────────────────────────
  async getApprovalStatus(docType: WorkflowDocType, docId: string) {
    const history = await this.prisma.auditLog.findMany({
      where: { tableName: docType, recordId: docId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });

    return history
      .filter((h) => {
        const nv = h.newValues as Record<string, unknown> | null;
        return nv?.action === 'approve' || nv?.action === 'reject';
      })
      .map((h) => {
        const nv = h.newValues as Record<string, unknown>;
        return {
          id: h.id,
          action: nv.action,
          status: nv.status,
          comment: nv.comment ?? null,
          approvedBy: h.user
            ? `${h.user.firstName} ${h.user.lastName}`
            : h.userId,
          approvedAt: h.createdAt,
        };
      });
  }

  // ── Public: get pending tasks for a user (for dashboard My Work) ──────────
  async getPendingTasksForUser(userId: string, companyId: string): Promise<PendingTask[]> {
    const tasks: PendingTask[] = [];

    // Get the user's role to check what they can approve
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });
    if (!user) return tasks;

    // Find all workflow configs for this company
    const wfConfigs = await this.prisma.workflowConfig.findMany({
      where: { companyId },
    });

    const approverDocTypes = wfConfigs
      .filter((wf) => {
        const levels = (wf.levels as unknown) as WorkflowLevel[];
        return levels.some((l) => l.approverRole === user.roleId);
      })
      .map((wf) => wf.docType);

    // Query submitted MRLs
    if (approverDocTypes.includes('MRL')) {
      const mrls = await this.prisma.materialRequisition.findMany({
        where: { companyId, status: 'SUBMITTED' },
        include: { location: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const mrl of mrls) {
        tasks.push({
          docType: 'MRL',
          docId: mrl.id,
          docNo: mrl.docNo,
          subject: `Material Requisition - ${mrl.location.name}`,
          requestedBy: mrl.createdById,
          requestedAt: mrl.createdAt,
          status: mrl.status,
          priority: 'medium',
        });
      }
    }

    // Query submitted PRLs
    if (approverDocTypes.includes('PRL')) {
      const prls = await this.prisma.purchaseRequisition.findMany({
        where: { companyId, status: 'DRAFT' },
        include: { location: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const prl of prls) {
        tasks.push({
          docType: 'PRL',
          docId: prl.id,
          docNo: prl.docNo,
          subject: `Purchase Requisition - ${prl.location.name}`,
          requestedBy: prl.createdById,
          requestedAt: prl.createdAt,
          status: prl.status,
          priority: 'medium',
        });
      }
    }

    // Query submitted POs
    if (approverDocTypes.includes('PO')) {
      const pos = await this.prisma.purchaseOrder.findMany({
        where: { companyId, status: 'SUBMITTED' },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const po of pos) {
        tasks.push({
          docType: 'PO',
          docId: po.id,
          docNo: po.docNo,
          subject: `Purchase Order - ${po.supplier.name}`,
          requestedBy: po.createdById,
          requestedAt: po.createdAt,
          status: po.status,
          priority: Number(po.totalAmount) > 50000 ? 'high' : 'medium',
        });
      }
    }

    return tasks;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getDocument(
    docType: WorkflowDocType,
    docId: string
  ): Promise<{ status: string; companyId: string; docNo: string; createdById: string } | null> {
    switch (docType) {
      case 'MRL': {
        const r = await this.prisma.materialRequisition.findUnique({
          where: { id: docId },
          select: { status: true, companyId: true, docNo: true, createdById: true },
        });
        return r ? { ...r, status: r.status as string } : null;
      }
      case 'PRL': {
        const r = await this.prisma.purchaseRequisition.findUnique({
          where: { id: docId },
          select: { status: true, companyId: true, docNo: true, createdById: true },
        });
        return r ? { ...r, status: r.status as string } : null;
      }
      case 'PO': {
        const r = await this.prisma.purchaseOrder.findUnique({
          where: { id: docId },
          select: { status: true, companyId: true, docNo: true, createdById: true },
        });
        return r ? { ...r, status: r.status as string } : null;
      }
      default:
        return null;
    }
  }

  private async updateDocumentStatus(
    docType: WorkflowDocType,
    docId: string,
    userId: string,
    status: string,
    comment?: string
  ) {
    const approvedData =
      status === 'APPROVED'
        ? { approvedById: userId, approvedAt: new Date() }
        : {};

    switch (docType) {
      case 'MRL':
        await this.prisma.materialRequisition.update({
          where: { id: docId },
          data: { status: status as any, ...approvedData },
        });
        break;
      case 'PRL':
        await this.prisma.purchaseRequisition.update({
          where: { id: docId },
          data: { status: status as any, ...approvedData },
        });
        break;
      case 'PO':
        await this.prisma.purchaseOrder.update({
          where: { id: docId },
          data: { status: status as any, ...approvedData },
        });
        break;
    }
  }

  private async applyLineAdjustments(
    docType: 'MRL' | 'PRL',
    adjustments: Array<{ lineId: string; approvedQty: number }>
  ) {
    for (const adj of adjustments) {
      if (docType === 'MRL') {
        await this.prisma.mrlLine.update({
          where: { id: adj.lineId },
          data: { approvedQty: adj.approvedQty },
        });
      } else {
        await this.prisma.prlLine.update({
          where: { id: adj.lineId },
          data: { approvedQty: adj.approvedQty },
        });
      }
    }
  }

  private async countApprovals(docType: string, docId: string): Promise<number> {
    const logs = await this.prisma.auditLog.count({
      where: {
        tableName: docType,
        recordId: docId,
        newValues: { path: ['action'], equals: 'approve' },
      },
    });
    return logs;
  }

  private resolveRequiredLevel(levels: WorkflowLevel[], amount: number): number {
    if (!levels.length) return 1;
    for (const level of [...levels].sort((a, b) => a.level - b.level)) {
      const withinMin = amount >= level.minAmount;
      const withinMax = level.maxAmount === null || amount <= level.maxAmount;
      if (withinMin && withinMax) return level.level;
    }
    return levels[levels.length - 1].level;
  }

  private moduleForDocType(docType: WorkflowDocType): string {
    const map: Record<WorkflowDocType, string> = {
      MRL: 'PROCUREMENT',
      PRL: 'PROCUREMENT',
      PO: 'PROCUREMENT',
      GRN: 'INVENTORY',
      SI: 'INVENTORY',
      SA: 'INVENTORY',
      JE: 'FINANCE',
      API: 'FINANCE',
    };
    return map[docType] ?? 'CORE';
  }
}
