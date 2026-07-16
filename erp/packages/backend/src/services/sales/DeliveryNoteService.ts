import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';

export interface DeliveryLineInput {
  salesOrderLineId?: string | null;
  itemId: string;
  uomId: string;
  deliveredQty: number;
  binId?: string | null;
}
export interface CreateDeliveryInput {
  companyId: string;
  customerId: string;
  salesOrderId?: string | null;
  deliveryDate: string;
  shipToAddressId?: string | null;
  warehouseId: string;
  vehicleNo?: string | null;
  driver?: string | null;
  notes?: string | null;
  lines: DeliveryLineInput[];
}
export type UpdateDeliveryInput = Partial<Omit<CreateDeliveryInput, 'companyId'>>;

export class StockInsufficientError extends Error {
  statusCode = 422;
  constructor(itemId: string, requested: number, available: number) {
    super(`Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`);
  }
}

// ── Pure, unit-testable helpers ───────────────────────────────────────────────
export function outstandingDeliverable(orderedQty: number, deliveredQty: number): number {
  return Math.max(0, orderedQty - deliveredQty);
}

export function computeIssue(
  onHand: number, reserved: number, deliverQty: number, allowNegative: boolean,
): { newOnHand: number; newReserved: number; releaseQty: number } {
  const available = onHand - reserved;
  if (deliverQty > available && !allowNegative) {
    throw new StockInsufficientError('', deliverQty, available);
  }
  const releaseQty = Math.min(deliverQty, reserved);
  return { newOnHand: onHand - deliverQty, newReserved: reserved - releaseQty, releaseQty };
}

export function recomputeOrderStatus(
  lines: Array<{ orderedQty: number; deliveredQty: number }>,
): 'DELIVERED' | 'IN_PROGRESS' | null {
  const anyDelivered = lines.some((l) => l.deliveredQty > 0);
  const allDelivered = lines.length > 0 && lines.every((l) => l.deliveredQty >= l.orderedQty);
  if (allDelivered) return 'DELIVERED';
  if (anyDelivered) return 'IN_PROGRESS';
  return null;
}

function notFound(msg = 'Delivery note not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }

export class DeliveryNoteService {
  constructor(private prisma: PrismaClient) {}

  private async allowNegativeStock(companyId: string): Promise<boolean> {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { salesConfig: true } });
    return ((c?.salesConfig as any)?.ALLOW_NEGATIVE_STOCK ?? false) === true;
  }

  // ── Open (undelivered) lines for a sales order ─────────────────────────────
  async openOrderLines(companyId: string, salesOrderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, companyId },
      include: { lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } } } } },
    });
    if (!order) throw Object.assign(new Error('Sales order not found'), { statusCode: 404 });
    if (!['APPROVED', 'IN_PROGRESS'].includes(order.status)) {
      throw Object.assign(new Error(`Order ${order.docNo} is not approved for delivery`), { statusCode: 409 });
    }
    return {
      salesOrderId: order.id, docNo: order.docNo, customerId: order.customerId, warehouseId: order.warehouseId,
      lines: order.lines
        .map((l) => ({
          salesOrderLineId: l.id, itemId: l.itemId, uomId: l.uomId,
          itemCode: l.item?.code, itemDescription: l.item?.description, uomCode: l.uom?.code,
          orderedQty: Number(l.orderedQty), deliveredQty: Number(l.deliveredQty),
          outstanding: outstandingDeliverable(Number(l.orderedQty), Number(l.deliveredQty)),
        }))
        .filter((l) => l.outstanding > 0),
    };
  }

  async list(companyId: string, q: { search?: string; status?: string; customerId?: string; page?: number; limit?: number }) {
    const { search, status, customerId, page = 1, limit = 50 } = q;
    const where: Prisma.DeliveryNoteWhereInput = { companyId };
    if (status) where.status = status as any;
    if (customerId) where.customerId = customerId;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      this.prisma.deliveryNote.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } }, _count: { select: { lines: true } } } }),
      this.prisma.deliveryNote.count({ where }),
    ]);
    const data = rows.map((r) => ({
      id: r.id, docNo: r.docNo, customerId: r.customerId, customerName: r.customer?.name, salesOrderId: r.salesOrderId,
      deliveryDate: r.deliveryDate, status: r.status, lineCount: r._count.lines, createdAt: r.createdAt,
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const d = await this.prisma.deliveryNote.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } } } },
      },
    });
    if (!d) throw notFound();
    return d;
  }

  async create(input: CreateDeliveryInput, userId: string) {
    // Validate against SO outstanding
    for (const l of input.lines) {
      if (!l.salesOrderLineId) continue;
      const sol = await this.prisma.salesOrderLine.findUnique({ where: { id: l.salesOrderLineId } });
      if (!sol) throw Object.assign(new Error('Sales order line not found'), { statusCode: 422 });
      const outstanding = outstandingDeliverable(Number(sol.orderedQty), Number(sol.deliveredQty));
      if (l.deliveredQty > outstanding) {
        throw Object.assign(new Error(`Delivered qty ${l.deliveredQty} exceeds outstanding ${outstanding} for a line`), { statusCode: 422 });
      }
    }
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'DNL');
    const dn = await this.prisma.deliveryNote.create({
      data: {
        companyId: input.companyId, docNo, customerId: input.customerId, salesOrderId: input.salesOrderId ?? null,
        deliveryDate: toDate(input.deliveryDate)!, shipToAddressId: input.shipToAddressId ?? null, warehouseId: input.warehouseId,
        vehicleNo: input.vehicleNo ?? null, driver: input.driver ?? null, notes: input.notes ?? null, status: 'DRAFT', createdById: userId,
        lines: { createMany: { data: input.lines.map((l, i) => ({
          salesOrderLineId: l.salesOrderLineId ?? null, itemId: l.itemId, uomId: l.uomId,
          deliveredQty: new Prisma.Decimal(l.deliveredQty), binId: l.binId ?? null, unitCost: new Prisma.Decimal(0), lineNo: i + 1,
        })) } },
      },
    });
    await this.audit('CREATE', dn.id, userId, { docNo });
    return this.getById(dn.id, input.companyId);
  }

  async update(id: string, companyId: string, input: UpdateDeliveryInput, userId: string) {
    const existing = await this.prisma.deliveryNote.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT deliveries can be edited'), { statusCode: 409 });
    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryNote.update({ where: { id }, data: {
        deliveryDate: input.deliveryDate ? toDate(input.deliveryDate)! : undefined, shipToAddressId: input.shipToAddressId,
        warehouseId: input.warehouseId, vehicleNo: input.vehicleNo, driver: input.driver, notes: input.notes,
      } });
      if (input.lines !== undefined) {
        await tx.deliveryNoteLine.deleteMany({ where: { deliveryNoteId: id } });
        await tx.deliveryNoteLine.createMany({ data: input.lines.map((l, i) => ({
          deliveryNoteId: id, salesOrderLineId: l.salesOrderLineId ?? null, itemId: l.itemId, uomId: l.uomId,
          deliveredQty: new Prisma.Decimal(l.deliveredQty), binId: l.binId ?? null, unitCost: new Prisma.Decimal(0), lineNo: i + 1,
        })) });
      }
    });
    await this.audit('UPDATE', id, userId, {});
    return this.getById(id, companyId);
  }

  // ── Post (dispatch): deduct stock, release reservation, update SO ──────────
  async post(id: string, companyId: string, userId: string) {
    const dn = await this.prisma.deliveryNote.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!dn) throw notFound();
    if (dn.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT deliveries can be dispatched'), { statusCode: 409 });
    if (!dn.lines.length) throw Object.assign(new Error('Delivery has no lines'), { statusCode: 422 });
    const allowNeg = await this.allowNegativeStock(companyId);

    await this.prisma.$transaction(async (tx) => {
      const touchedOrderLines = new Set<string>();
      for (const l of dn.lines) {
        const deliverQty = Number(l.deliveredQty);
        if (deliverQty <= 0) continue;
        const bal = await tx.stockBalance.findFirst({ where: { itemId: l.itemId, warehouseId: dn.warehouseId, binId: l.binId ?? null } });
        const onHand = Number(bal?.qtyOnHand ?? 0);
        const reserved = Number(bal?.qtyReserved ?? 0);
        const avgCost = Number(bal?.avgCost ?? 0);
        const { newOnHand, newReserved } = computeIssue(onHand, reserved, deliverQty, allowNeg);

        if (bal) await tx.stockBalance.update({ where: { id: bal.id }, data: { qtyOnHand: new Prisma.Decimal(newOnHand), qtyReserved: new Prisma.Decimal(newReserved) } });
        else await tx.stockBalance.create({ data: { itemId: l.itemId, warehouseId: dn.warehouseId, binId: l.binId ?? null, qtyOnHand: new Prisma.Decimal(newOnHand), qtyReserved: new Prisma.Decimal(0), avgCost: new Prisma.Decimal(0) } });

        await tx.stockMovement.create({ data: {
          itemId: l.itemId, warehouseId: dn.warehouseId, binId: l.binId ?? null,
          qty: new Prisma.Decimal(-deliverQty), avgCost: new Prisma.Decimal(avgCost), balanceAfter: new Prisma.Decimal(newOnHand),
          transactionType: 'SALES_ISSUE', sourceDocId: dn.id, sourceDocNo: dn.docNo, companyId, userId,
        } });

        // capture cost for COGS
        await tx.deliveryNoteLine.update({ where: { id: l.id }, data: { unitCost: new Prisma.Decimal(avgCost) } });

        if (l.salesOrderLineId) {
          const sol = await tx.salesOrderLine.update({ where: { id: l.salesOrderLineId }, data: { deliveredQty: { increment: new Prisma.Decimal(deliverQty) } }, select: { orderId: true } });
          touchedOrderLines.add(sol.orderId);
        }
      }

      // Recompute affected order statuses
      for (const orderId of touchedOrderLines) {
        const lines = await tx.salesOrderLine.findMany({ where: { orderId }, select: { orderedQty: true, deliveredQty: true } });
        const next = recomputeOrderStatus(lines.map((x) => ({ orderedQty: Number(x.orderedQty), deliveredQty: Number(x.deliveredQty) })));
        if (next) await tx.salesOrder.update({ where: { id: orderId }, data: { status: next } });
      }

      await tx.deliveryNote.update({ where: { id }, data: { status: 'DISPATCHED' } });
    });
    await this.audit('UPDATE', id, userId, { action: 'post' });
    return this.getById(id, companyId);
  }

  async acknowledge(id: string, companyId: string, userId: string) {
    const dn = await this.prisma.deliveryNote.findFirst({ where: { id, companyId } });
    if (!dn) throw notFound();
    if (dn.status !== 'DISPATCHED') throw Object.assign(new Error('Only dispatched deliveries can be acknowledged'), { statusCode: 409 });
    await this.prisma.deliveryNote.update({ where: { id }, data: { status: 'DELIVERED' } });
    await this.audit('UPDATE', id, userId, { action: 'acknowledge' });
    return this.getById(id, companyId);
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'delivery_notes', recordId, userId, action, newValues: values } });
  }
}
