import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';

export interface ReturnLineInput { itemId: string; uomId: string; qty: number; }
export interface CreateReturnInput {
  companyId: string;
  salesInvoiceId?: string | null;
  deliveryNoteId?: string | null;
  customerId?: string | null;
  returnDate: string;
  reason?: string | null;
  lines: ReturnLineInput[];
}

// Pure helper — inbound stock restore.
export function computeReceive(onHand: number, qty: number): number {
  return onHand + qty;
}

function notFound(msg = 'Sales return not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }

export class SalesReturnService {
  constructor(private prisma: PrismaClient) {}

  async list(companyId: string, q: { search?: string; status?: string; page?: number; limit?: number }) {
    const { search, status, page = 1, limit = 50 } = q;
    const where: Prisma.SalesReturnWhereInput = { companyId };
    if (status) where.status = status as any;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      this.prisma.salesReturn.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { _count: { select: { lines: true } } } }),
      this.prisma.salesReturn.count({ where }),
    ]);
    const data = rows.map((r) => ({ id: r.id, docNo: r.docNo, salesInvoiceId: r.salesInvoiceId, deliveryNoteId: r.deliveryNoteId, customerId: r.customerId, returnDate: r.returnDate, reason: r.reason, status: r.status, lineCount: r._count.lines, createdAt: r.createdAt }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const r = await this.prisma.salesReturn.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } } } } },
    });
    if (!r) throw notFound();
    return r;
  }

  async create(input: CreateReturnInput, userId: string) {
    if (!input.lines.length) throw Object.assign(new Error('Return has no lines'), { statusCode: 422 });
    // Validate qty against delivered qty for the item (when linked to a delivery)
    if (input.deliveryNoteId) {
      const dl = await this.prisma.deliveryNoteLine.findMany({ where: { deliveryNoteId: input.deliveryNoteId }, select: { itemId: true, deliveredQty: true } });
      const deliveredByItem = new Map<string, number>();
      for (const l of dl) deliveredByItem.set(l.itemId, (deliveredByItem.get(l.itemId) ?? 0) + Number(l.deliveredQty));
      for (const l of input.lines) {
        const delivered = deliveredByItem.get(l.itemId) ?? 0;
        if (l.qty > delivered) throw Object.assign(new Error(`Return qty ${l.qty} exceeds delivered ${delivered} for an item`), { statusCode: 422 });
      }
    }
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'SRN');
    const rec = await this.prisma.salesReturn.create({
      data: {
        companyId: input.companyId, docNo, salesInvoiceId: input.salesInvoiceId ?? null, deliveryNoteId: input.deliveryNoteId ?? null,
        customerId: input.customerId ?? null, returnDate: toDate(input.returnDate)!, reason: input.reason ?? null, status: 'DRAFT', createdById: userId,
        lines: { createMany: { data: input.lines.map((l, i) => ({ itemId: l.itemId, uomId: l.uomId, qty: new Prisma.Decimal(l.qty), lineNo: i + 1 })) } },
      },
    });
    await this.audit('CREATE', rec.id, userId, { docNo });
    return this.getById(rec.id, input.companyId);
  }

  async approve(id: string, companyId: string, userId: string) {
    const r = await this.prisma.salesReturn.findFirst({ where: { id, companyId } });
    if (!r) throw notFound();
    if (r.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT returns can be approved'), { statusCode: 409 });
    await this.prisma.salesReturn.update({ where: { id }, data: { status: 'APPROVED' } });
    await this.audit('UPDATE', id, userId, { action: 'approve' });
    return this.getById(id, companyId);
  }

  // Receive → inbound stock movement restoring on-hand at the current WAC.
  async receive(id: string, companyId: string, userId: string) {
    const r = await this.prisma.salesReturn.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!r) throw notFound();
    if (r.status !== 'APPROVED') throw Object.assign(new Error('Only APPROVED returns can be received'), { statusCode: 409 });

    let warehouseId: string | null = null;
    if (r.deliveryNoteId) {
      const dn = await this.prisma.deliveryNote.findUnique({ where: { id: r.deliveryNoteId }, select: { warehouseId: true } });
      warehouseId = dn?.warehouseId ?? null;
    }

    await this.prisma.$transaction(async (tx) => {
      if (warehouseId) {
        for (const l of r.lines) {
          const qty = Number(l.qty);
          if (qty <= 0) continue;
          const bal = await tx.stockBalance.findFirst({ where: { itemId: l.itemId, warehouseId, binId: null } });
          const onHand = Number(bal?.qtyOnHand ?? 0);
          const avgCost = Number(bal?.avgCost ?? 0);
          const newOnHand = computeReceive(onHand, qty);
          if (bal) await tx.stockBalance.update({ where: { id: bal.id }, data: { qtyOnHand: new Prisma.Decimal(newOnHand) } });
          else await tx.stockBalance.create({ data: { itemId: l.itemId, warehouseId, binId: null, qtyOnHand: new Prisma.Decimal(newOnHand), qtyReserved: new Prisma.Decimal(0), avgCost: new Prisma.Decimal(0) } });
          await tx.stockMovement.create({ data: {
            itemId: l.itemId, warehouseId, binId: null, qty: new Prisma.Decimal(qty), avgCost: new Prisma.Decimal(avgCost), balanceAfter: new Prisma.Decimal(newOnHand),
            transactionType: 'SALES_RETURN', sourceDocId: r.id, sourceDocNo: r.docNo, companyId, userId,
          } });
        }
      }
      await tx.salesReturn.update({ where: { id }, data: { status: 'RECEIVED' } });
    });
    await this.audit('UPDATE', id, userId, { action: 'receive' });
    return this.getById(id, companyId);
  }

  async close(id: string, companyId: string, userId: string) {
    const r = await this.prisma.salesReturn.findFirst({ where: { id, companyId } });
    if (!r) throw notFound();
    if (r.status !== 'RECEIVED') throw Object.assign(new Error('Only RECEIVED returns can be closed'), { statusCode: 409 });
    await this.prisma.salesReturn.update({ where: { id }, data: { status: 'CLOSED' } });
    await this.audit('UPDATE', id, userId, { action: 'close' });
    return this.getById(id, companyId);
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'sales_returns', recordId, userId, action, newValues: values } });
  }
}
