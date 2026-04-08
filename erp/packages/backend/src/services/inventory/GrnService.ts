import { PrismaClient, GrnStatus, PoStatus } from '@prisma/client';
import type { CreateGrnInput } from '@clouderp/shared';
import { StockEngine } from './StockEngine.js';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { NotificationService } from '../NotificationService.js';

export class GrnService {
  private readonly stockEngine: StockEngine;
  private readonly notif: NotificationService;

  constructor(private readonly prisma: PrismaClient) {
    this.stockEngine = new StockEngine(prisma);
    this.notif = new NotificationService(prisma);
  }

  // ── List GRNs ────────────────────────────────────────────────────────────────
  async list(query: {
    companyId: string; page?: number; limit?: number;
    status?: string; supplierId?: string; poId?: string;
    dateFrom?: string; dateTo?: string; search?: string;
  }) {
    const { companyId, page = 1, limit = 50, status, supplierId, poId,
            dateFrom, dateTo, search } = query;

    const where: any = {
      companyId,
      ...(status     && { status }),
      ...(supplierId && { supplierId }),
      ...(poId       && { poId }),
      ...(search     && { docNo: { contains: search, mode: 'insensitive' } }),
      ...((dateFrom || dateTo) && {
        docDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.grnHeader.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          po: { select: { id: true, docNo: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.grnHeader.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const grn = await this.prisma.grnHeader.findFirst({
      where: { id, companyId },
      include: {
        supplier: true,
        po: {
          include: {
            lines: {
              include: { item: { select: { id: true, code: true, description: true } }, uom: true },
            },
          },
        },
        warehouse: true,
        location: true,
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            item: { select: { id: true, code: true, description: true } },
            bin:  { select: { id: true, code: true, name: true } },
            poLine: true,
          },
        },
      },
    });
    if (!grn) throw Object.assign(new Error('GRN not found'), { statusCode: 404 });
    return grn;
  }

  // ── Create draft GRN from a PO ────────────────────────────────────────────────
  async create(input: CreateGrnInput, companyId: string, userId: string) {
    // Validate PO
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: input.poId, companyId },
      include: {
        lines: {
          include: { item: true, uom: true },
        },
      },
    });
    if (!po) throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });
    if (!['APPROVED', 'PARTIAL'].includes(po.status)) {
      throw Object.assign(
        new Error(`PO must be APPROVED or PARTIAL to create a GRN (current status: ${po.status})`),
        { statusCode: 422 },
      );
    }

    // Validate warehouse
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: input.warehouseId, companyId },
    });
    if (!warehouse) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });

    const docNo = await getNextDocNo(this.prisma, companyId, 'INVENTORY', 'GRN');

    return this.prisma.grnHeader.create({
      data: {
        companyId,
        docNo,
        poId: input.poId,
        supplierId: po.supplierId,
        warehouseId: input.warehouseId,
        locationId: input.locationId ?? null,
        docDate: new Date(input.docDate),
        remarks: input.remarks ?? null,
        status: GrnStatus.DRAFT,
        createdById: userId,
        lines: {
          create: input.lines.map((l) => ({
            itemId:      l.itemId,
            poLineId:    l.poLineId,
            receivedQty: l.receivedQty,
            acceptedQty: l.acceptedQty,
            rejectedQty: l.rejectedQty ?? 0,
            binId:       l.binId ?? null,
            lotNo:       l.lotNo ?? null,
            batchNo:     l.batchNo ?? null,
            expiryDate:  l.expiryDate ? new Date(l.expiryDate) : null,
            lineNo:      l.lineNo,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
        supplier: true,
        po: { select: { id: true, docNo: true } },
        warehouse: true,
      },
    });
  }

  // ── Update draft GRN ──────────────────────────────────────────────────────────
  async update(id: string, companyId: string, input: Partial<CreateGrnInput>) {
    const grn = await this.getById(id, companyId);
    if (grn.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT GRNs can be edited'), { statusCode: 422 });
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete existing lines, re-create
      if (input.lines) {
        await tx.grnLine.deleteMany({ where: { grnId: id } });
      }

      return tx.grnHeader.update({
        where: { id },
        data: {
          ...(input.docDate    && { docDate: new Date(input.docDate) }),
          ...(input.warehouseId && { warehouseId: input.warehouseId }),
          ...(input.locationId  && { locationId: input.locationId }),
          ...(input.remarks !== undefined && { remarks: input.remarks }),
          ...(input.lines && {
            lines: {
              create: input.lines.map((l) => ({
                itemId:      l.itemId,
                poLineId:    l.poLineId,
                receivedQty: l.receivedQty,
                acceptedQty: l.acceptedQty,
                rejectedQty: l.rejectedQty ?? 0,
                binId:       l.binId ?? null,
                lotNo:       l.lotNo ?? null,
                batchNo:     l.batchNo ?? null,
                expiryDate:  l.expiryDate ? new Date(l.expiryDate) : null,
                lineNo:      l.lineNo,
              })),
            },
          }),
        },
        include: {
          lines: { orderBy: { lineNo: 'asc' } },
          supplier: true,
          po: { select: { id: true, docNo: true } },
          warehouse: true,
        },
      });
    });
  }

  // ── POST (confirm) GRN — irreversible ─────────────────────────────────────────
  async post(id: string, companyId: string, userId: string) {
    const grn = await this.getById(id, companyId);
    if (grn.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT GRNs can be posted'), { statusCode: 422 });
    }
    if (!grn.lines.length) {
      throw Object.assign(new Error('GRN has no lines'), { statusCode: 422 });
    }

    // Pull PO lines to find unit prices
    const poLineMap = new Map<string, { unitPrice: number }>();
    if (grn.po?.lines) {
      for (const pl of (grn.po as any).lines) {
        poLineMap.set(pl.id, { unitPrice: Number(pl.unitPrice) });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // ── a) Update each accepted GRN line → stock engine ──────────────────
      for (const line of grn.lines) {
        if (Number(line.acceptedQty) <= 0) continue;

        const poLine  = line.poLineId ? poLineMap.get(line.poLineId) : null;
        const unitPrice = poLine?.unitPrice ?? 0;

        await this.stockEngine.updateStock({
          itemId:          line.itemId,
          warehouseId:     grn.warehouseId,
          binId:           line.binId,
          qty:             Number(line.acceptedQty),
          avgCost:         unitPrice,
          transactionType: 'GRN',
          sourceDocId:     grn.id,
          sourceDocNo:     grn.docNo,
          userId,
          companyId,
        });

        // ── b) Update PO line receivedQty ─────────────────────────────────
        if (line.poLineId) {
          await tx.poLine.update({
            where: { id: line.poLineId },
            data: { receivedQty: { increment: Number(line.acceptedQty) } },
          });
        }
      }

      // ── c) Mark GRN as POSTED ─────────────────────────────────────────────
      await tx.grnHeader.update({
        where: { id },
        data: { status: GrnStatus.POSTED, postedAt: new Date() },
      });

      // ── d) Check if PO is fully received → update PO status ───────────────
      if (grn.poId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: grn.poId },
          include: { lines: true },
        });
        if (po) {
          const fullyReceived = po.lines.every(
            (l) => Number(l.receivedQty) >= Number(l.orderedQty),
          );
          const partiallyReceived = po.lines.some((l) => Number(l.receivedQty) > 0);

          if (fullyReceived) {
            await tx.purchaseOrder.update({
              where: { id: po.id },
              data: { status: PoStatus.RECEIVED },
            });
          } else if (partiallyReceived && po.status !== 'PARTIAL') {
            await tx.purchaseOrder.update({
              where: { id: po.id },
              data: { status: PoStatus.PARTIAL },
            });
          }
        }
      }

      // ── e) Finance journal (if FINANCE module enabled) ────────────────────
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { modulesEnabled: true },
      });
      const financeEnabled = (company?.modulesEnabled as string[] ?? []).includes('FINANCE');
      if (financeEnabled && grn.poId) {
        await this.postGrnJournal(tx, grn, companyId, userId);
      }
    });

    // ── f) Notify procurement team ────────────────────────────────────────────
    const procTeam = await this.prisma.user.findMany({
      where: {
        companyId,
        role: { permissions: { some: { module: 'PROCUREMENT', resource: 'GRN', action: 'VIEW' } } },
      },
      select: { id: true },
    });
    for (const u of procTeam.slice(0, 20)) {
      await this.notif.createNotification({
        userId:  u.id,
        type:    'GRN_POSTED',
        title:   `GRN ${grn.docNo} Posted`,
        message: `Goods Receipt Note ${grn.docNo} has been posted to the warehouse.`,
        docType: 'GRN',
        docId:   grn.id,
      });
    }

    return this.getById(id, companyId);
  }

  // ── Minimal GRN journal (Inventory Dr / GRN Clearing Cr) ─────────────────────
  private async postGrnJournal(
    tx: any,
    grn: any,
    companyId: string,
    userId: string,
  ) {
    // Calculate total value from accepted lines × their PO unit price
    const poLineMap = new Map<string, number>();
    if (grn.po?.lines) {
      for (const pl of grn.po.lines) poLineMap.set(pl.id, Number(pl.unitPrice));
    }
    const totalValue = grn.lines.reduce(
      (s: number, l: any) => s + Number(l.acceptedQty) * (l.poLineId ? (poLineMap.get(l.poLineId) ?? 0) : 0),
      0,
    );
    if (totalValue <= 0) return;

    // Find inventory and GRN clearing accounts
    const [inventoryAcc, clearingAcc] = await Promise.all([
      tx.glAccount.findFirst({ where: { companyId, code: '1310' } }),
      tx.glAccount.findFirst({ where: { companyId, code: '2200' } }),
    ]);
    if (!inventoryAcc || !clearingAcc) return; // Chart of accounts not yet set up

    const jeDocNo = `JE-GRN-${grn.docNo}`;
    await tx.journalEntry.create({
      data: {
        companyId,
        docNo:        jeDocNo,
        entryDate:    grn.docDate,
        description:  `GRN posting: ${grn.docNo}`,
        status:       'POSTED',
        sourceModule: 'INVENTORY',
        sourceDocId:  grn.id,
        postedAt:     new Date(),
        createdById:  userId,
        lines: {
          create: [
            {
              accountId:   inventoryAcc.id,
              description: `Inventory receipt: ${grn.docNo}`,
              debit:       totalValue,
              credit:      0,
              lineNo:      1,
            },
            {
              accountId:   clearingAcc.id,
              description: `GRN clearing: ${grn.docNo}`,
              debit:       0,
              credit:      totalValue,
              lineNo:      2,
            },
          ],
        },
      },
    });
  }

  // ── Cancel (only DRAFT) ───────────────────────────────────────────────────────
  async cancel(id: string, companyId: string) {
    const grn = await this.getById(id, companyId);
    if (grn.status !== 'DRAFT') {
      throw Object.assign(new Error('Only DRAFT GRNs can be cancelled'), { statusCode: 422 });
    }
    return this.prisma.grnHeader.update({
      where: { id },
      data: { status: GrnStatus.CANCELLED },
    });
  }
}
