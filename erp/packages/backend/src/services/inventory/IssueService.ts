import { PrismaClient } from '@prisma/client';
import type { CreateIssueInput } from '@clouderp/shared';
import { StockEngine } from './StockEngine.js';
import { getNextDocNo } from '../../utils/DocNumberService.js';

export class IssueService {
  private readonly stockEngine: StockEngine;

  constructor(private readonly prisma: PrismaClient) {
    this.stockEngine = new StockEngine(prisma);
  }

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
      this.prisma.stockIssue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          chargeCode: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.stockIssue.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const issue = await this.prisma.stockIssue.findFirst({
      where: { id, companyId },
      include: {
        warehouse: true,
        chargeCode: true,
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
    if (!issue) throw Object.assign(new Error('Stock Issue not found'), { statusCode: 404 });
    return issue;
  }

  async create(input: CreateIssueInput, companyId: string, userId: string) {
    // Validate warehouse
    const wh = await this.prisma.warehouse.findFirst({ where: { id: input.warehouseId, companyId } });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });

    // Pre-flight availability check (non-locking)
    for (const line of input.lines) {
      const balance = await this.stockEngine.getBalance(line.itemId, input.warehouseId, line.binId ?? null);
      const available = (balance?.qtyOnHand ?? 0) - (balance?.qtyReserved ?? 0);
      if (line.issuedQty > available) {
        const item = await this.prisma.item.findUnique({ where: { id: line.itemId } });
        throw Object.assign(
          new Error(
            `Insufficient stock for item ${item?.code ?? line.itemId}: ` +
            `requested ${line.issuedQty}, available ${available}`,
          ),
          { statusCode: 422 },
        );
      }
    }

    const docNo = await getNextDocNo(this.prisma, companyId, 'INVENTORY', 'SI');

    return this.prisma.stockIssue.create({
      data: {
        companyId,
        docNo,
        docDate:     new Date(input.docDate),
        warehouseId: input.warehouseId,
        chargeCodeId: input.chargeCodeId,
        mrlId:        input.mrlId ?? null,
        remarks:      input.remarks ?? null,
        status:       'DRAFT',
        createdById:  userId,
        lines: {
          create: input.lines.map((l) => ({
            itemId:    l.itemId,
            binId:     l.binId ?? null,
            issuedQty: l.issuedQty,
            uomId:     l.uomId,
            avgCost:   0,
            lineNo:    l.lineNo,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
        warehouse: true,
      },
    });
  }

  async post(id: string, companyId: string, userId: string) {
    const issue = await this.getById(id, companyId);
    if (issue.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT issues can be posted'), { statusCode: 422 });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of issue.lines) {
        const qty = Number(line.issuedQty);
        if (qty <= 0) continue;

        // Get current avg cost before deducting
        const balance = await this.stockEngine.getBalance(
          line.itemId, issue.warehouseId, line.binId,
        );
        const currentAvgCost = balance?.avgCost ?? 0;

        await this.stockEngine.updateStock({
          itemId:          line.itemId,
          warehouseId:     issue.warehouseId,
          binId:           line.binId,
          qty:             -qty,
          avgCost:         currentAvgCost,
          transactionType: 'ISSUE',
          sourceDocId:     issue.id,
          sourceDocNo:     issue.docNo,
          userId,
          companyId,
        });

        // Stamp avg cost on issue line for audit
        await tx.stockIssueLine.update({
          where: { id: line.id },
          data: { avgCost: currentAvgCost },
        });
      }

      await tx.stockIssue.update({
        where: { id },
        data: { status: 'POSTED' },
      });
    });

    return this.getById(id, companyId);
  }

  async cancel(id: string, companyId: string) {
    const issue = await this.getById(id, companyId);
    if (issue.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT issues can be cancelled'), { statusCode: 422 });
    }
    return this.prisma.stockIssue.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
