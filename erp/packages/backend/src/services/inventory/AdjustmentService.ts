import { PrismaClient } from '@prisma/client';
import { StockEngine } from './StockEngine.js';
import { WorkflowService } from '../WorkflowService.js';
import { getNextDocNo } from '../../utils/DocNumberService.js';

// Adjustments whose absolute total variance value exceeds this require approval
const DEFAULT_APPROVAL_THRESHOLD = 500; // USD

export interface CreateAdjustmentInput {
  docDate: string;
  warehouseId: string;
  reasonId: string;
  lines: Array<{
    itemId: string;
    binId?: string;
    systemQty: number;
    physicalQty: number;
    uomId: string;
    lineNo: number;
  }>;
}

export class AdjustmentService {
  private readonly stockEngine: StockEngine;
  private readonly workflow: WorkflowService;

  constructor(private readonly prisma: PrismaClient) {
    this.stockEngine = new StockEngine(prisma);
    this.workflow    = new WorkflowService(prisma);
  }

  // ── List ──────────────────────────────────────────────────────────────────────
  async list(query: {
    companyId: string; page?: number; limit?: number;
    status?: string; warehouseId?: string;
    dateFrom?: string; dateTo?: string; search?: string;
  }) {
    const { companyId, page = 1, limit = 50, status, warehouseId,
            dateFrom, dateTo, search } = query;

    const where: any = {
      companyId,
      ...(status      && { status }),
      ...(warehouseId && { warehouseId }),
      ...(search      && { docNo: { contains: search, mode: 'insensitive' } }),
      ...((dateFrom || dateTo) && {
        docDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse:  { select: { id: true, code: true, name: true } },
          reason:     { select: { id: true, code: true, name: true } },
          _count:     { select: { lines: true } },
        },
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const doc = await this.prisma.stockAdjustment.findFirst({
      where: { id, companyId },
      include: {
        warehouse: true,
        reason:    true,
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            item: { select: { id: true, code: true, description: true } },
            bin:  { select: { id: true, code: true } },
            uom:  { select: { code: true, symbol: true } },
          },
        },
      },
    });
    if (!doc) throw Object.assign(new Error('Stock Adjustment not found'), { statusCode: 404 });
    return doc;
  }

  // ── Create draft ──────────────────────────────────────────────────────────────
  async create(input: CreateAdjustmentInput, companyId: string, userId: string) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id: input.warehouseId, companyId } });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });

    const reason = await this.prisma.adjustmentReason.findFirst({
      where: { id: input.reasonId, companyId },
    });
    if (!reason) throw Object.assign(new Error('Adjustment reason not found'), { statusCode: 404 });

    const docNo = await getNextDocNo(this.prisma, companyId, 'INVENTORY', 'SA');

    // Compute variance qty for each line
    const linesWithVariance = input.lines.map((l) => ({
      ...l,
      varianceQty: l.physicalQty - l.systemQty,
    }));

    return this.prisma.stockAdjustment.create({
      data: {
        companyId,
        docNo,
        docDate:     new Date(input.docDate),
        warehouseId: input.warehouseId,
        reasonId:    input.reasonId,
        status:      'DRAFT',
        createdById: userId,
        lines: {
          create: linesWithVariance.map((l) => ({
            itemId:      l.itemId,
            binId:       l.binId ?? null,
            systemQty:   l.systemQty,
            physicalQty: l.physicalQty,
            varianceQty: l.varianceQty,
            uomId:       l.uomId,
            avgCost:     0, // stamped on approval/post
            lineNo:      l.lineNo,
          })),
        },
      },
      include: {
        warehouse: true,
        reason:    true,
        lines:     { orderBy: { lineNo: 'asc' } },
      },
    });
  }

  // ── Submit for approval ───────────────────────────────────────────────────────
  async submit(id: string, companyId: string, userId: string) {
    const doc = await this.getById(id, companyId);
    if (doc.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT adjustments can be submitted'), { statusCode: 422 });
    }

    // Calculate total variance value
    const totalVarianceValue = await this.calcTotalVarianceValue(doc);

    // Determine whether approval is required
    const needsApproval = totalVarianceValue > DEFAULT_APPROVAL_THRESHOLD;

    if (!needsApproval) {
      // Self-approve and post directly
      await this.prisma.stockAdjustment.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: userId },
      });
      return this.postAdjustment(id, companyId, userId);
    }

    // Requires approval — move to SUBMITTED
    await this.prisma.stockAdjustment.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    return this.getById(id, companyId);
  }

  // ── Approve (manager action) ──────────────────────────────────────────────────
  async approve(id: string, companyId: string, userId: string) {
    const doc = await this.getById(id, companyId);
    if (doc.status !== 'SUBMITTED') {
      throw Object.assign(new Error('Only SUBMITTED adjustments can be approved'), { statusCode: 422 });
    }

    await this.prisma.stockAdjustment.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId },
    });

    return this.postAdjustment(id, companyId, userId);
  }

  // ── Reject ────────────────────────────────────────────────────────────────────
  async reject(id: string, companyId: string, userId: string) {
    const doc = await this.getById(id, companyId);
    if (!['DRAFT', 'SUBMITTED'].includes(doc.status)) {
      throw Object.assign(new Error('Cannot reject a posted adjustment'), { statusCode: 422 });
    }
    return this.prisma.stockAdjustment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ── Internal: post approved adjustment ───────────────────────────────────────
  private async postAdjustment(id: string, companyId: string, userId: string) {
    const doc = await this.getById(id, companyId);

    await this.prisma.$transaction(async (tx) => {
      for (const line of doc.lines) {
        const variance = Number(line.varianceQty);
        if (variance === 0) continue;

        // Get current avg cost
        const balance = await this.stockEngine.getBalance(
          line.itemId, doc.warehouseId, line.binId,
        );
        const avgCost = balance?.avgCost ?? 0;

        // Stamp avg cost on line for audit
        await tx.stockAdjustmentLine.update({
          where: { id: line.id },
          data: { avgCost },
        });

        // Negative variance: stock going DOWN; positive: stock going UP
        await this.stockEngine.updateStock({
          itemId:          line.itemId,
          warehouseId:     doc.warehouseId,
          binId:           line.binId,
          qty:             variance,
          avgCost,
          transactionType: 'ADJUSTMENT',
          sourceDocId:     doc.id,
          sourceDocNo:     doc.docNo,
          userId,
          companyId,
        });
      }

      await tx.stockAdjustment.update({
        where: { id },
        data: { status: 'POSTED' },
      });
    });

    return this.getById(id, companyId);
  }

  // ── List adjustment reasons ───────────────────────────────────────────────────
  async listReasons(companyId: string) {
    return this.prisma.adjustmentReason.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }

  async createReason(companyId: string, code: string, name: string) {
    const existing = await this.prisma.adjustmentReason.findFirst({ where: { companyId, code } });
    if (existing) throw Object.assign(new Error(`Reason code '${code}' already exists`), { statusCode: 409 });
    return this.prisma.adjustmentReason.create({ data: { companyId, code, name } });
  }

  // ── Helper: compute total absolute variance value ─────────────────────────────
  private async calcTotalVarianceValue(doc: any): Promise<number> {
    let total = 0;
    for (const line of doc.lines) {
      const balance = await this.stockEngine.getBalance(
        line.itemId, doc.warehouseId, line.binId,
      );
      const avgCost = balance?.avgCost ?? 0;
      total += Math.abs(Number(line.varianceQty)) * avgCost;
    }
    return total;
  }
}
