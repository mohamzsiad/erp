import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { PriceResolutionService } from './PriceResolutionService.js';
import { SalesPricingService } from './SalesPricingService.js';

export type CreditCheckMode = 'BLOCK' | 'WARN' | 'OFF';

export interface OrderLineInput {
  itemId: string;
  description?: string | null;
  uomId: string;
  orderedQty: number;
  unitPrice?: number | null;
  discountPct?: number;
  taxCodeId?: string | null;
  requestedDate?: string | null;
}

export interface CreateOrderInput {
  companyId: string;
  customerId: string;
  quotationId?: string | null;
  contractId?: string | null;
  orderType?: 'STOCK' | 'SERVICE' | 'PROJECT' | 'DIRECT';
  orderDate: string;
  requestedDate?: string | null;
  billToAddressId?: string | null;
  shipToAddressId?: string | null;
  salespersonId?: string | null;
  paymentTerms?: string | null;
  warehouseId?: string | null;
  notes?: string | null;
  lines: OrderLineInput[];
}

export type UpdateOrderInput = Partial<Omit<CreateOrderInput, 'companyId'>>;

interface SalesConfig {
  CREDIT_CHECK_MODE: CreditCheckMode;
  RESERVE_STOCK_ON_ORDER: boolean;
  ALLOW_NEGATIVE_STOCK: boolean;
  SO_APPROVAL_REQUIRED: boolean;
  SO_APPROVAL_THRESHOLD: number;
}

export interface CreditInputs {
  mode: CreditCheckMode;
  creditLimit: number;
  outstanding: number;
  overdue: number;
  openOrders: number;
  orderValue: number;
}
export interface CreditDecision {
  decision: 'PASS' | 'HOLD' | 'BLOCK';
  availableCredit: number;
  exceeded: boolean;
  hasOverdue: boolean;
  reason?: string;
}

// ── Pure, unit-testable helpers ───────────────────────────────────────────────
export function evaluateCredit(a: CreditInputs): CreditDecision {
  const availableCredit = a.creditLimit - (a.outstanding + a.openOrders);
  const exceeded = a.orderValue > availableCredit;
  const hasOverdue = a.overdue > 0;
  if (a.mode === 'OFF' || (!exceeded && !hasOverdue)) {
    return { decision: 'PASS', availableCredit, exceeded, hasOverdue };
  }
  const parts: string[] = [];
  if (exceeded) parts.push(`order value ${a.orderValue} exceeds available credit ${availableCredit}`);
  if (hasOverdue) parts.push(`customer has ${a.overdue} overdue`);
  const reason = parts.join('; ');
  return { decision: a.mode === 'BLOCK' ? 'BLOCK' : 'HOLD', availableCredit, exceeded, hasOverdue, reason };
}

export function needsApproval(orderValue: number, soApprovalRequired: boolean, approvalThreshold: number): boolean {
  if (!soApprovalRequired) return false;
  return orderValue > approvalThreshold;
}

// Outstanding quantities to reserve/release for an order's stock lines (pure).
export function outstandingReservations(order: {
  orderType: string;
  warehouseId: string | null;
  lines: Array<{ itemId: string; orderedQty: number | string; deliveredQty?: number | string }>;
}): Array<{ itemId: string; qty: number }> {
  if (!['STOCK', 'DIRECT'].includes(order.orderType) || !order.warehouseId) return [];
  const out: Array<{ itemId: string; qty: number }> = [];
  for (const l of order.lines) {
    const qty = Number(l.orderedQty) - Number(l.deliveredQty ?? 0);
    if (qty > 0) out.push({ itemId: l.itemId, qty });
  }
  return out;
}

function notFound(msg = 'Sales order not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }
const OPEN_ORDER_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'CREDIT_HOLD', 'IN_PROGRESS'] as const;
const RESERVED_STATUSES = ['APPROVED', 'IN_PROGRESS'];

export class SalesOrderService {
  private pricing: SalesPricingService;
  private resolver: PriceResolutionService;
  constructor(private prisma: PrismaClient) {
    this.pricing = new SalesPricingService(prisma);
    this.resolver = new PriceResolutionService(prisma);
  }

  private async config(companyId: string): Promise<SalesConfig> {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { salesConfig: true } });
    const cfg = (c?.salesConfig as any) ?? {};
    return {
      CREDIT_CHECK_MODE: (cfg.CREDIT_CHECK_MODE ?? 'WARN') as CreditCheckMode,
      RESERVE_STOCK_ON_ORDER: cfg.RESERVE_STOCK_ON_ORDER ?? true,
      ALLOW_NEGATIVE_STOCK: cfg.ALLOW_NEGATIVE_STOCK ?? false,
      SO_APPROVAL_REQUIRED: cfg.SO_APPROVAL_REQUIRED ?? true,
      SO_APPROVAL_THRESHOLD: Number(cfg.SO_APPROVAL_THRESHOLD ?? 0),
    };
  }

  private async approvalThreshold(companyId: string, cfg: SalesConfig): Promise<number> {
    // Prefer a WorkflowConfig(SALES, SOL) first-level maxAmount as the auto-approve ceiling.
    const wf = await this.prisma.workflowConfig.findUnique({
      where: { companyId_module_docType: { companyId, module: 'SALES', docType: 'SOL' } },
    }).catch(() => null);
    const levels = ((wf?.levels as any) as Array<{ minAmount?: number; maxAmount?: number }> | undefined) ?? [];
    if (levels.length) {
      const ceilings = levels.map((l) => Number(l.minAmount ?? 0)).filter((n) => n > 0);
      if (ceilings.length) return Math.min(...ceilings) - 0.001; // approval needed at/above the lowest configured floor
    }
    return cfg.SO_APPROVAL_THRESHOLD;
  }

  // ── List / Get ─────────────────────────────────────────────────────────────
  async list(companyId: string, q: { search?: string; status?: string; customerId?: string; page?: number; limit?: number }) {
    const { search, status, customerId, page = 1, limit = 50 } = q;
    const where: Prisma.SalesOrderWhereInput = { companyId };
    if (status) where.status = status as any;
    if (customerId) where.customerId = customerId;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      this.prisma.salesOrder.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } } } }),
      this.prisma.salesOrder.count({ where }),
    ]);
    const data = rows.map((r) => ({
      id: r.id, docNo: r.docNo, customerId: r.customerId, customerName: r.customer?.name, orderType: r.orderType,
      orderDate: r.orderDate, status: r.status, totalAmount: Number(r.totalAmount), creditHoldReason: r.creditHoldReason, createdAt: r.createdAt,
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const o = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { lineNo: 'asc' }, include: { item: { select: { code: true, description: true } }, uom: { select: { code: true } } } },
      },
    });
    if (!o) throw notFound();
    return { ...o, subTotal: Number(o.subTotal), discountAmount: Number(o.discountAmount), taxAmount: Number(o.taxAmount), totalAmount: Number(o.totalAmount) };
  }

  private async priceLines(companyId: string, customerId: string, dateStr: string, lines: OrderLineInput[]) {
    const priced = [];
    for (const l of lines) {
      let unitPrice = l.unitPrice ?? null;
      if (unitPrice == null) {
        const r = await this.resolver.resolvePrice({ companyId, customerId, itemId: l.itemId, uomId: l.uomId, date: dateStr });
        unitPrice = r.unitPrice ?? 0;
      }
      priced.push({ itemId: l.itemId, description: l.description ?? null, uomId: l.uomId, orderedQty: l.orderedQty, unitPrice, discountPct: l.discountPct ?? 0, taxCodeId: l.taxCodeId ?? null, requestedDate: l.requestedDate ?? null });
    }
    const totals = await this.pricing.computeForLines(companyId, priced.map((l) => ({ qty: l.orderedQty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId })));
    return { priced, totals };
  }

  async create(input: CreateOrderInput, userId: string) {
    const { priced, totals } = await this.priceLines(input.companyId, input.customerId, input.orderDate, input.lines);
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'SOL');
    const order = await this.prisma.salesOrder.create({
      data: {
        companyId: input.companyId, docNo, customerId: input.customerId, quotationId: input.quotationId ?? null, contractId: input.contractId ?? null,
        orderType: (input.orderType ?? 'STOCK') as any, orderDate: toDate(input.orderDate)!, requestedDate: toDate(input.requestedDate),
        billToAddressId: input.billToAddressId ?? null, shipToAddressId: input.shipToAddressId ?? null, salespersonId: input.salespersonId ?? null,
        paymentTerms: input.paymentTerms ?? null, warehouseId: input.warehouseId ?? null, notes: input.notes ?? null, status: 'DRAFT',
        subTotal: new Prisma.Decimal(totals.subTotal), discountAmount: new Prisma.Decimal(totals.discountAmount),
        taxAmount: new Prisma.Decimal(totals.taxAmount), totalAmount: new Prisma.Decimal(totals.totalAmount), createdById: userId,
        lines: { createMany: { data: priced.map((l, i) => ({
          itemId: l.itemId, description: l.description, uomId: l.uomId, orderedQty: new Prisma.Decimal(l.orderedQty),
          unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct), taxCodeId: l.taxCodeId,
          netAmount: new Prisma.Decimal(totals.lines[i].netAmount), requestedDate: toDate(l.requestedDate), lineNo: i + 1,
        })) } },
      },
    });
    await this.audit('CREATE', order.id, userId, { docNo });
    return this.getById(order.id, input.companyId);
  }

  async update(id: string, companyId: string, input: UpdateOrderInput, userId: string) {
    const existing = await this.prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!existing) throw notFound();
    if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT orders can be edited'), { statusCode: 409 });

    await this.prisma.$transaction(async (tx) => {
      const header: Prisma.SalesOrderUpdateInput = {
        requestedDate: input.requestedDate !== undefined ? toDate(input.requestedDate) : undefined,
        billToAddressId: input.billToAddressId, shipToAddressId: input.shipToAddressId, salespersonId: input.salespersonId,
        paymentTerms: input.paymentTerms, warehouseId: input.warehouseId, notes: input.notes,
        orderType: input.orderType as any,
      };
      if (input.lines !== undefined) {
        const customerId = input.customerId ?? existing.customerId;
        const dateStr = input.orderDate ?? existing.orderDate.toISOString();
        const { priced, totals } = await this.priceLines(companyId, customerId, dateStr, input.lines);
        header.subTotal = new Prisma.Decimal(totals.subTotal); header.discountAmount = new Prisma.Decimal(totals.discountAmount);
        header.taxAmount = new Prisma.Decimal(totals.taxAmount); header.totalAmount = new Prisma.Decimal(totals.totalAmount);
        await tx.salesOrderLine.deleteMany({ where: { orderId: id } });
        await tx.salesOrderLine.createMany({ data: priced.map((l, i) => ({
          orderId: id, itemId: l.itemId, description: l.description, uomId: l.uomId, orderedQty: new Prisma.Decimal(l.orderedQty),
          unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct), taxCodeId: l.taxCodeId,
          netAmount: new Prisma.Decimal(totals.lines[i].netAmount), requestedDate: toDate(l.requestedDate), lineNo: i + 1,
        })) });
      }
      await tx.salesOrder.update({ where: { id }, data: header });
    });
    await this.audit('UPDATE', id, userId, {});
    return this.getById(id, companyId);
  }

  // ── Credit status (from AR + open orders) ──────────────────────────────────
  async creditStatus(companyId: string, customerId: string, excludeOrderId?: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { creditLimit: true } });
    const creditLimit = Number(customer?.creditLimit ?? 0);
    const invoices = await this.prisma.arInvoice.findMany({ where: { companyId, customerId }, select: { totalAmount: true, paidAmount: true, dueDate: true, status: true } });
    const today = new Date();
    let outstanding = 0, overdue = 0;
    for (const inv of invoices) {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED') continue;
      const bal = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (bal <= 0) continue;
      outstanding += bal;
      if (inv.dueDate < today) overdue += bal;
    }
    const openRows = await this.prisma.salesOrder.findMany({
      where: { companyId, customerId, status: { in: OPEN_ORDER_STATUSES as any }, id: excludeOrderId ? { not: excludeOrderId } : undefined },
      select: { totalAmount: true },
    });
    const openOrders = openRows.reduce((s, o) => s + Number(o.totalAmount), 0);
    return { creditLimit, outstanding, overdue, openOrders };
  }

  // ── Confirm (credit → approval → reservation) ──────────────────────────────
  async confirm(id: string, companyId: string, userId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (order.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT orders can be confirmed'), { statusCode: 409 });

    const cfg = await this.config(companyId);
    const orderValue = Number(order.totalAmount);
    const cs = await this.creditStatus(companyId, order.customerId, id);
    const credit = evaluateCredit({ mode: cfg.CREDIT_CHECK_MODE, creditLimit: cs.creditLimit, outstanding: cs.outstanding, overdue: cs.overdue, openOrders: cs.openOrders, orderValue });

    if (credit.decision === 'BLOCK') {
      throw Object.assign(new Error(`Credit check failed: ${credit.reason}`), { statusCode: 422 });
    }

    let result: any;
    await this.prisma.$transaction(async (tx) => {
      if (credit.decision === 'HOLD') {
        await tx.salesOrder.update({ where: { id }, data: { status: 'CREDIT_HOLD', creditHoldReason: credit.reason ?? 'Credit hold' } });
        await this.notifyRole(tx, companyId, 'CREDIT_CONTROL', 'Credit hold', `Order ${order.docNo} is on credit hold: ${credit.reason}`, 'SOL', id);
        result = { status: 'CREDIT_HOLD', credit };
        return;
      }
      const threshold = await this.approvalThreshold(companyId, cfg);
      if (needsApproval(orderValue, cfg.SO_APPROVAL_REQUIRED, threshold)) {
        await tx.salesOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } });
        await this.notifyRole(tx, companyId, 'SALES_ORDER', 'Order approval required', `Order ${order.docNo} (${orderValue}) needs approval`, 'SOL', id, 'APPROVE');
        result = { status: 'PENDING_APPROVAL', credit };
        return;
      }
      await this.approveInTx(tx, companyId, order, cfg, userId);
      result = { status: 'APPROVED', credit };
    });
    await this.audit('UPDATE', id, userId, { action: 'confirm', ...result });
    return { ...(await this.getById(id, companyId)), creditCheck: credit, warnings: credit.decision === 'HOLD' ? [credit.reason] : [] };
  }

  async approve(id: string, companyId: string, userId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (order.status !== 'PENDING_APPROVAL') throw Object.assign(new Error('Order is not pending approval'), { statusCode: 409 });
    const cfg = await this.config(companyId);
    await this.prisma.$transaction(async (tx) => { await this.approveInTx(tx, companyId, order, cfg, userId); });
    await this.audit('UPDATE', id, userId, { action: 'approve' });
    return this.getById(id, companyId);
  }

  async reject(id: string, companyId: string, userId: string, reason?: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!order) throw notFound();
    if (!['PENDING_APPROVAL', 'CREDIT_HOLD'].includes(order.status)) throw Object.assign(new Error('Order cannot be rejected in its current state'), { statusCode: 409 });
    await this.prisma.salesOrder.update({ where: { id }, data: { status: 'DRAFT', creditHoldReason: reason ?? null } });
    await this.audit('UPDATE', id, userId, { action: 'reject', reason });
    return this.getById(id, companyId);
  }

  // Credit Controller releases a hold → re-runs approval routing.
  async releaseHold(id: string, companyId: string, userId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (order.status !== 'CREDIT_HOLD') throw Object.assign(new Error('Order is not on credit hold'), { statusCode: 409 });
    const cfg = await this.config(companyId);
    const orderValue = Number(order.totalAmount);
    const threshold = await this.approvalThreshold(companyId, cfg);
    await this.prisma.$transaction(async (tx) => {
      if (needsApproval(orderValue, cfg.SO_APPROVAL_REQUIRED, threshold)) {
        await tx.salesOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL', creditHoldReason: null } });
      } else {
        await tx.salesOrder.update({ where: { id }, data: { creditHoldReason: null } });
        await this.approveInTx(tx, companyId, order, cfg, userId);
      }
    });
    await this.audit('UPDATE', id, userId, { action: 'release-hold' });
    return this.getById(id, companyId);
  }

  async cancel(id: string, companyId: string, userId: string, reason?: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (['CLOSED', 'CANCELLED'].includes(order.status)) throw Object.assign(new Error('Order already closed/cancelled'), { statusCode: 409 });
    await this.prisma.$transaction(async (tx) => {
      if (RESERVED_STATUSES.includes(order.status)) await this.releaseReservation(tx, order);
      await tx.salesOrder.update({ where: { id }, data: { status: 'CANCELLED', notes: reason ? `${order.notes ?? ''}\nCancelled: ${reason}` : order.notes } });
    });
    await this.audit('UPDATE', id, userId, { action: 'cancel', reason });
    return this.getById(id, companyId);
  }

  // Short-close: release outstanding reservation and close the order.
  async shortClose(id: string, companyId: string, userId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (!RESERVED_STATUSES.includes(order.status)) throw Object.assign(new Error('Only active orders can be short-closed'), { statusCode: 409 });
    await this.prisma.$transaction(async (tx) => {
      await this.releaseReservation(tx, order);
      await tx.salesOrder.update({ where: { id }, data: { status: 'CLOSED' } });
    });
    await this.audit('UPDATE', id, userId, { action: 'short-close' });
    return this.getById(id, companyId);
  }

  // ── Available-to-Promise per line ──────────────────────────────────────────
  async availability(id: string, companyId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    const wh = order.warehouseId;
    const out = [];
    for (const l of order.lines) {
      let onHand = 0, reserved = 0;
      if (wh) {
        const bal = await this.prisma.stockBalance.findFirst({ where: { itemId: l.itemId, warehouseId: wh, binId: null }, select: { qtyOnHand: true, qtyReserved: true } });
        onHand = Number(bal?.qtyOnHand ?? 0); reserved = Number(bal?.qtyReserved ?? 0);
      }
      out.push({ lineId: l.id, itemId: l.itemId, orderedQty: Number(l.orderedQty), onHand, reserved, availableToPromise: onHand - reserved });
    }
    return { orderId: id, warehouseId: wh, lines: out };
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  private async approveInTx(tx: Prisma.TransactionClient, companyId: string, order: { id: string; orderType: string; warehouseId: string | null; lines: any[] }, cfg: SalesConfig, userId: string) {
    await tx.salesOrder.update({ where: { id: order.id }, data: { status: 'APPROVED', approvedById: userId } });
    if (cfg.RESERVE_STOCK_ON_ORDER) await this.reserveStock(tx, order);
  }

  private async reserveStock(tx: Prisma.TransactionClient, order: { orderType: string; warehouseId: string | null; lines: any[] }) {
    for (const r of outstandingReservations(order)) {
      const bal = await tx.stockBalance.findFirst({ where: { itemId: r.itemId, warehouseId: order.warehouseId!, binId: null } });
      if (bal) await tx.stockBalance.update({ where: { id: bal.id }, data: { qtyReserved: { increment: r.qty } } });
      else await tx.stockBalance.create({ data: { itemId: r.itemId, warehouseId: order.warehouseId!, binId: null, qtyOnHand: 0, qtyReserved: r.qty, avgCost: 0 } });
    }
  }

  private async releaseReservation(tx: Prisma.TransactionClient, order: { orderType: string; warehouseId: string | null; lines: any[] }) {
    for (const r of outstandingReservations(order)) {
      const bal = await tx.stockBalance.findFirst({ where: { itemId: r.itemId, warehouseId: order.warehouseId!, binId: null } });
      if (bal) await tx.stockBalance.update({ where: { id: bal.id }, data: { qtyReserved: { decrement: r.qty } } });
    }
  }

  private async notifyRole(tx: Prisma.TransactionClient, companyId: string, resource: string, title: string, message: string, docType: string, docId: string, action = 'VIEW') {
    const users = await tx.user.findMany({ where: { companyId, role: { permissions: { some: { module: 'SALES', resource, action: action as any } } } }, select: { id: true } });
    if (!users.length) return;
    await tx.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: 'SALES_ORDER', title, message, docType, docId })) });
  }

  private async audit(action: 'CREATE' | 'UPDATE' | 'DELETE', recordId: string, userId: string, values: any) {
    await this.prisma.auditLog.create({ data: { tableName: 'sales_orders', recordId, userId, action, newValues: values } });
  }
}
