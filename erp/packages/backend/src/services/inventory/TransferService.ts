import { PrismaClient } from '@prisma/client';
import { StockEngine } from './StockEngine.js';
import { getNextDocNo } from '../../utils/DocNumberService.js';

export interface CreateTransferInput {
  docDate: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  remarks?: string;
  lines: Array<{
    itemId: string;
    fromBinId?: string;
    toBinId?: string;
    transferQty: number;
    uomId: string;
    lineNo: number;
  }>;
}

export class TransferService {
  private readonly stockEngine: StockEngine;

  constructor(private readonly prisma: PrismaClient) {
    this.stockEngine = new StockEngine(prisma);
  }

  // ── List ──────────────────────────────────────────────────────────────────────
  async list(query: {
    companyId: string; page?: number; limit?: number;
    status?: string; fromWarehouseId?: string; toWarehouseId?: string;
    dateFrom?: string; dateTo?: string; search?: string;
  }) {
    const { companyId, page = 1, limit = 50, status,
            fromWarehouseId, toWarehouseId, dateFrom, dateTo, search } = query;

    const where: any = {
      companyId,
      ...(status          && { status }),
      ...(fromWarehouseId && { fromWarehouseId }),
      ...(toWarehouseId   && { toWarehouseId }),
      ...(search          && { docNo: { contains: search, mode: 'insensitive' } }),
      ...((dateFrom || dateTo) && {
        docDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          fromWarehouse: { select: { id: true, code: true, name: true } },
          toWarehouse:   { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const doc = await this.prisma.stockTransfer.findFirst({
      where: { id, companyId },
      include: {
        fromWarehouse: true,
        toWarehouse:   true,
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            item:    { select: { id: true, code: true, description: true } },
            fromBin: { select: { id: true, code: true } },
            toBin:   { select: { id: true, code: true } },
            uom:     { select: { code: true, symbol: true } },
          },
        },
      },
    });
    if (!doc) throw Object.assign(new Error('Stock Transfer not found'), { statusCode: 404 });
    return doc;
  }

  // ── Create draft ──────────────────────────────────────────────────────────────
  async create(input: CreateTransferInput, companyId: string, userId: string) {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw Object.assign(
        new Error('Source and destination warehouse must be different'),
        { statusCode: 422 },
      );
    }

    // Validate both warehouses belong to company
    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findFirst({ where: { id: input.fromWarehouseId, companyId } }),
      this.prisma.warehouse.findFirst({ where: { id: input.toWarehouseId,   companyId } }),
    ]);
    if (!fromWh) throw Object.assign(new Error('Source warehouse not found'), { statusCode: 404 });
    if (!toWh)   throw Object.assign(new Error('Destination warehouse not found'), { statusCode: 404 });

    // Pre-flight stock availability check
    for (const line of input.lines) {
      const balance = await this.stockEngine.getBalance(
        line.itemId, input.fromWarehouseId, line.fromBinId ?? null,
      );
      const available = (balance?.qtyOnHand ?? 0) - (balance?.qtyReserved ?? 0);
      if (line.transferQty > available) {
        const item = await this.prisma.item.findUnique({
          where: { id: line.itemId }, select: { code: true },
        });
        throw Object.assign(
          new Error(
            `Insufficient stock for item ${item?.code ?? line.itemId}: ` +
            `requested ${line.transferQty}, available ${available}`,
          ),
          { statusCode: 422 },
        );
      }
    }

    const docNo = await getNextDocNo(this.prisma, companyId, 'INVENTORY', 'ST');

    return this.prisma.stockTransfer.create({
      data: {
        companyId,
        docNo,
        docDate:        new Date(input.docDate),
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId:  input.toWarehouseId,
        remarks:        input.remarks ?? null,
        status:         'DRAFT',
        createdById:    userId,
        lines: {
          create: input.lines.map((l) => ({
            itemId:      l.itemId,
            fromBinId:   l.fromBinId ?? null,
            toBinId:     l.toBinId ?? null,
            transferQty: l.transferQty,
            uomId:       l.uomId,
            lineNo:      l.lineNo,
          })),
        },
      },
      include: {
        fromWarehouse: true,
        toWarehouse:   true,
        lines:         { orderBy: { lineNo: 'asc' } },
      },
    });
  }

  // ── Post transfer ─────────────────────────────────────────────────────────────
  async post(id: string, companyId: string, userId: string) {
    const doc = await this.getById(id, companyId);
    if (doc.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT transfers can be posted'), { statusCode: 422 });
    }
    if (!doc.lines.length) {
      throw Object.assign(new Error('Transfer has no lines'), { statusCode: 422 });
    }

    await this.prisma.$transaction(async () => {
      for (const line of doc.lines) {
        const qty = Number(line.transferQty);
        if (qty <= 0) continue;

        // Get current avg cost from source balance
        const srcBalance = await this.stockEngine.getBalance(
          line.itemId, doc.fromWarehouseId, line.fromBinId,
        );
        const avgCost = srcBalance?.avgCost ?? 0;

        // OUT from source
        await this.stockEngine.updateStock({
          itemId:          line.itemId,
          warehouseId:     doc.fromWarehouseId,
          binId:           line.fromBinId,
          qty:             -qty,
          avgCost,
          transactionType: 'TRANSFER_OUT',
          sourceDocId:     doc.id,
          sourceDocNo:     doc.docNo,
          userId,
          companyId,
        });

        // IN to destination — carries same avg cost
        await this.stockEngine.updateStock({
          itemId:          line.itemId,
          warehouseId:     doc.toWarehouseId,
          binId:           line.toBinId,
          qty:             qty,
          avgCost,
          transactionType: 'TRANSFER_IN',
          sourceDocId:     doc.id,
          sourceDocNo:     doc.docNo,
          userId,
          companyId,
        });
      }

      await this.prisma.stockTransfer.update({
        where: { id },
        data: { status: 'POSTED' },
      });
    });

    return this.getById(id, companyId);
  }

  // ── Cancel (DRAFT only) ───────────────────────────────────────────────────────
  async cancel(id: string, companyId: string) {
    const doc = await this.getById(id, companyId);
    if (doc.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT transfers can be cancelled'), { statusCode: 422 });
    }
    return this.prisma.stockTransfer.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
