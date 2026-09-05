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
  // Stock reservation captured on the line
  reservedQty?: number;
  reserveWarehouseId?: string | null;
  reserveUntil?: string | null;
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
  salesmanId?: string | null;
  paymentTerms?: string | null;
  paymentTermId?: string | null;
  currencyId?: string | null;
  exchangeRate?: number;
  locationId?: string | null;
  warehouseId?: string | null;
  notes?: string | null;
  /** Optional at creation — the header is saved first, then lines are added. */
  lines?: OrderLineInput[];
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
  lines: Array<{ itemId: string; orderedQty: number | string; deliveredQty?: number | string; reservedQty?: number | string }>;
}): Array<{ itemId: string; qty: number }> {
  if (!['STOCK', 'DIRECT'].includes(order.orderType) || !order.warehouseId) return [];
  const out: Array<{ itemId: string; qty: number }> = [];
  for (const l of order.lines) {
    // Whatever the line already holds explicitly is not reserved again on approval.
    const qty = Number(l.orderedQty) - Number(l.deliveredQty ?? 0) - Number(l.reservedQty ?? 0);
    if (qty > 0) out.push({ itemId: l.itemId, qty });
  }
  return out;
}

export interface ReservationRequest {
  itemId: string;
  warehouseId: string;
  qty: number;
}

/**
 * Free (available-to-promise) stock given a balance row: what is on hand less
 * what is already reserved, never below zero.
 */
export function freeStock(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

/**
 * Validates an explicit line reservation against free stock, excluding whatever
 * this line already holds (so editing a reservation upward only needs the delta).
 */
export function evaluateReservation(args: {
  requestedQty: number;
  orderedQty: number;
  currentlyReserved: number;
  onHand: number;
  reservedByOthers: number;
  allowNegativeStock: boolean;
}): { ok: boolean; delta: number; available: number; reason?: string } {
  const available = freeStock(args.onHand, args.reservedByOthers);
  const delta = args.requestedQty - args.currentlyReserved;
  if (args.requestedQty < 0) return { ok: false, delta, available, reason: 'Reservation quantity cannot be negative' };
  if (args.requestedQty > args.orderedQty) {
    return { ok: false, delta, available, reason: `Cannot reserve ${args.requestedQty} against an ordered quantity of ${args.orderedQty}` };
  }
  if (delta > 0 && delta > available && !args.allowNegativeStock) {
    return { ok: false, delta, available, reason: `Only ${available} available to reserve in this warehouse` };
  }
  return { ok: true, delta, available };
}

function notFound(msg = 'Sales order not found') { return Object.assign(new Error(msg), { statusCode: 404 }); }
function toDate(v?: string | null): Date | null { return v ? new Date(v) : null; }
const OPEN_ORDER_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'CREDIT_HOLD', 'IN_PROGRESS'] as const;
const RESERVED_STATUSES = ['APPROVED', 'IN_PROGRESS'];
// Anything past DRAFT is closed off rather than cancelled.
const SHORT_CLOSEABLE = ['PENDING_APPROVAL', 'CREDIT_HOLD', 'APPROVED', 'IN_PROGRESS', 'DELIVERED'];

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
        salesman: { select: { id: true, code: true, name: true } },
        paymentTerm: { select: { id: true, code: true, name: true } },
        currency: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            item: { select: { code: true, description: true, reservationAllowed: true } },
            uom: { select: { code: true } },
            reserveWarehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!o) throw notFound();
    return {
      ...o,
      subTotal: Number(o.subTotal),
      discountAmount: Number(o.discountAmount),
      taxAmount: Number(o.taxAmount),
      totalAmount: Number(o.totalAmount),
      exchangeRate: Number(o.exchangeRate),
      salesmanName: o.salesman ? `${o.salesman.code} — ${o.salesman.name}` : null,
      currencyCode: o.currency?.code ?? null,
      locationName: o.location ? `${o.location.code} — ${o.location.name}` : null,
      lines: o.lines.map((l) => ({
        ...l,
        orderedQty: Number(l.orderedQty),
        deliveredQty: Number(l.deliveredQty),
        invoicedQty: Number(l.invoicedQty),
        unitPrice: Number(l.unitPrice),
        discountPct: Number(l.discountPct),
        netAmount: Number(l.netAmount),
        reservedQty: Number(l.reservedQty),
        reserveWarehouseCode: l.reserveWarehouse?.code ?? null,
        reservationAllowed: l.item?.reservationAllowed ?? false,
      })),
    };
  }

  /**
   * Stock position for an item: the selected warehouse on its own, plus the
   * group total across every warehouse in the company. Feeds the two stock
   * columns on the order line.
   */
  async itemStock(companyId: string, itemId: string, warehouseId?: string | null) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    const balances = await this.prisma.stockBalance.findMany({
      where: { itemId, warehouseId: { in: warehouses.map((w) => w.id) }, binId: null },
      select: { warehouseId: true, qtyOnHand: true, qtyReserved: true },
    });
    const byWarehouse = warehouses.map((w) => {
      const b = balances.find((x) => x.warehouseId === w.id);
      const onHand = Number(b?.qtyOnHand ?? 0);
      const reserved = Number(b?.qtyReserved ?? 0);
      return { warehouseId: w.id, warehouseCode: w.code, warehouseName: w.name, onHand, reserved, available: freeStock(onHand, reserved) };
    });
    const selected = warehouseId ? byWarehouse.find((w) => w.warehouseId === warehouseId) ?? null : null;
    return {
      itemId,
      warehouseId: warehouseId ?? null,
      warehouseOnHand: selected?.onHand ?? 0,
      warehouseReserved: selected?.reserved ?? 0,
      warehouseAvailable: selected?.available ?? 0,
      groupOnHand: byWarehouse.reduce((s, w) => s + w.onHand, 0),
      groupReserved: byWarehouse.reduce((s, w) => s + w.reserved, 0),
      groupAvailable: byWarehouse.reduce((s, w) => s + w.available, 0),
      byWarehouse,
    };
  }

  /**
   * Prices every line from the price list. The rate is never taken from the
   * request: an item with no price simply comes through at 0, which is what the
   * business asked for rather than letting a user type their own rate.
   */
  private async priceLines(companyId: string, customerId: string, dateStr: string, lines: OrderLineInput[]) {
    const priced = [];
    for (const l of lines) {
      const r = await this.resolver.resolvePrice({ companyId, customerId, itemId: l.itemId, uomId: l.uomId, date: dateStr });
      const unitPrice = r.unitPrice ?? 0;
      priced.push({ itemId: l.itemId, description: l.description ?? null, uomId: l.uomId, orderedQty: l.orderedQty, unitPrice, discountPct: l.discountPct ?? 0, taxCodeId: l.taxCodeId ?? null, requestedDate: l.requestedDate ?? null });
    }
    const totals = await this.pricing.computeForLines(companyId, priced.map((l) => ({ qty: l.orderedQty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxCodeId: l.taxCodeId })));
    return { priced, totals };
  }

  /**
   * Commercial terms spooled off the customer master (company-terms row first,
   * then the customer header) so the order carries the right payment terms,
   * currency, salesman and price list without the user retyping them.
   */
  async spoolCustomerDefaults(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId },
      include: {
        paymentTerm: { select: { id: true, name: true } },
        currency: { select: { id: true, code: true } },
        addresses: { select: { id: true, type: true, isDefault: true } },
        currencies: { select: { currencyId: true, isDefault: true } },
        companyTerms: { where: { companyId }, include: { paymentTerm: { select: { id: true, name: true } } } },
      },
    });
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 422 });
    const t = customer.companyTerms[0] ?? null;
    const billTo = customer.addresses.find((a) => a.type === 'BILL_TO' && a.isDefault) ?? customer.addresses.find((a) => a.type === 'BILL_TO');
    const shipTo = customer.addresses.find((a) => a.type === 'SHIP_TO' && a.isDefault) ?? customer.addresses.find((a) => a.type === 'SHIP_TO');
    return {
      paymentTermId: t?.paymentTermId ?? customer.paymentTermId ?? null,
      paymentTerms: t?.paymentTerm?.name ?? customer.paymentTerm?.name ?? customer.paymentTerms ?? null,
      currencyId: customer.currencyId ?? customer.currencies.find((c) => c.isDefault)?.currencyId ?? null,
      currencyCode: customer.currency?.code ?? null,
      allowedCurrencyIds: customer.currencies.map((c) => c.currencyId),
      salesmanId: t?.salesmanId ?? customer.salesmanId ?? null,
      priceListId: t?.priceListId ?? customer.priceListId ?? null,
      billToAddressId: billTo?.id ?? null,
      shipToAddressId: shipTo?.id ?? null,
      creditHold: customer.creditHold,
      isBlackListed: t?.isBlackListed ?? false,
    };
  }

  async create(input: CreateOrderInput, userId: string) {
    // The customer master drives the commercial terms; anything sent explicitly wins.
    const spooled = await this.spoolCustomerDefaults(input.companyId, input.customerId);
    const lines = input.lines ?? [];
    const { priced, totals } = await this.priceLines(input.companyId, input.customerId, input.orderDate, lines);
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'SALES', 'SOL');
    const order = await this.prisma.salesOrder.create({
      data: {
        companyId: input.companyId, docNo, customerId: input.customerId, quotationId: input.quotationId ?? null, contractId: input.contractId ?? null,
        orderType: (input.orderType ?? 'STOCK') as any, orderDate: toDate(input.orderDate)!, requestedDate: toDate(input.requestedDate),
        billToAddressId: input.billToAddressId ?? spooled.billToAddressId,
        shipToAddressId: input.shipToAddressId ?? spooled.shipToAddressId,
        salespersonId: input.salespersonId ?? null,
        salesmanId: input.salesmanId ?? spooled.salesmanId,
        paymentTerms: input.paymentTerms ?? spooled.paymentTerms,
        paymentTermId: input.paymentTermId ?? spooled.paymentTermId,
        currencyId: input.currencyId ?? spooled.currencyId,
        exchangeRate: new Prisma.Decimal(input.exchangeRate ?? 1),
        locationId: input.locationId ?? null,
        warehouseId: input.warehouseId ?? null, notes: input.notes ?? null, status: 'DRAFT',
        subTotal: new Prisma.Decimal(totals.subTotal), discountAmount: new Prisma.Decimal(totals.discountAmount),
        taxAmount: new Prisma.Decimal(totals.taxAmount), totalAmount: new Prisma.Decimal(totals.totalAmount), createdById: userId,
        lines: priced.length
          ? { createMany: { data: priced.map((l, i) => ({
              itemId: l.itemId, description: l.description, uomId: l.uomId, orderedQty: new Prisma.Decimal(l.orderedQty),
              unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct), taxCodeId: l.taxCodeId,
              netAmount: new Prisma.Decimal(totals.lines[i].netAmount), requestedDate: toDate(l.requestedDate), lineNo: i + 1,
            })) } }
          : undefined,
      },
    });
    await this.audit('CREATE', order.id, userId, { docNo });
    return this.getById(order.id, input.companyId);
  }

  async update(id: string, companyId: string, input: UpdateOrderInput, userId: string) {
    const existing = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!existing) throw notFound();
    if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT orders can be edited'), { statusCode: 409 });
    // Once the header is saved the document number is issued against this
    // customer, so the customer is frozen for the life of the order.
    if (input.customerId && input.customerId !== existing.customerId) {
      throw Object.assign(
        new Error('The customer cannot be changed once the order header is saved — cancel this order and raise a new one'),
        { statusCode: 409 }
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const header: Prisma.SalesOrderUncheckedUpdateInput = {
        requestedDate: input.requestedDate !== undefined ? toDate(input.requestedDate) : undefined,
        billToAddressId: input.billToAddressId, shipToAddressId: input.shipToAddressId, salespersonId: input.salespersonId,
        salesmanId: input.salesmanId, paymentTerms: input.paymentTerms, paymentTermId: input.paymentTermId,
        currencyId: input.currencyId,
        exchangeRate: input.exchangeRate !== undefined ? new Prisma.Decimal(input.exchangeRate) : undefined,
        locationId: input.locationId,
        warehouseId: input.warehouseId, notes: input.notes,
        orderType: input.orderType as any,
      };
      if (input.lines !== undefined) {
        const customerId = input.customerId ?? existing.customerId;
        const dateStr = input.orderDate ?? existing.orderDate.toISOString();
        const { priced, totals } = await this.priceLines(companyId, customerId, dateStr, input.lines);
        header.subTotal = new Prisma.Decimal(totals.subTotal); header.discountAmount = new Prisma.Decimal(totals.discountAmount);
        header.taxAmount = new Prisma.Decimal(totals.taxAmount); header.totalAmount = new Prisma.Decimal(totals.totalAmount);
        // Lines are replaced wholesale; carry any reservation already blocked in
        // the warehouse across to the matching new line so stock is not orphaned.
        const held = new Map(existing.lines.map((l) => [`${l.itemId}|${l.uomId}`, l]));
        await tx.salesOrderLine.deleteMany({ where: { orderId: id } });
        await tx.salesOrderLine.createMany({ data: priced.map((l, i) => {
          const prev = held.get(`${l.itemId}|${l.uomId}`);
          const carried = Math.min(Number(prev?.reservedQty ?? 0), l.orderedQty);
          return {
            orderId: id, itemId: l.itemId, description: l.description, uomId: l.uomId, orderedQty: new Prisma.Decimal(l.orderedQty),
            unitPrice: new Prisma.Decimal(l.unitPrice), discountPct: new Prisma.Decimal(l.discountPct), taxCodeId: l.taxCodeId,
            netAmount: new Prisma.Decimal(totals.lines[i].netAmount), requestedDate: toDate(l.requestedDate),
            reservedQty: new Prisma.Decimal(carried),
            reserveWarehouseId: carried > 0 ? prev?.reserveWarehouseId ?? null : null,
            reserveUntil: carried > 0 ? prev?.reserveUntil ?? null : null,
            lineNo: i + 1,
          };
        }) });
        // Release any reservation that no longer has a line to sit on.
        for (const prev of existing.lines) {
          const stillThere = priced.find((l) => l.itemId === prev.itemId && l.uomId === prev.uomId);
          const keptQty = stillThere ? Math.min(Number(prev.reservedQty), stillThere.orderedQty) : 0;
          const drop = Number(prev.reservedQty) - keptQty;
          if (drop > 0 && prev.reserveWarehouseId) {
            await this.adjustReserved(tx, prev.itemId, prev.reserveWarehouseId, -drop);
          }
        }
      }
      await tx.salesOrder.update({ where: { id }, data: header });
    });
    await this.audit('UPDATE', id, userId, {});
    return this.getById(id, companyId);
  }

  // ── Credit status (from AR + open orders) ──────────────────────────────────
  async creditStatus(companyId: string, customerId: string, excludeOrderId?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { creditLimit: true, companyTerms: { where: { companyId }, select: { creditLimit: true } } },
    });
    // The limit is maintained per company on the customer's Companies grid.
    const creditLimit = Number(customer?.companyTerms[0]?.creditLimit ?? customer?.creditLimit ?? 0);
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
    if (!order.lines.length) throw Object.assign(new Error('Add at least one item line before confirming'), { statusCode: 422 });

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

  /**
   * Cancelling is reserved for a draft that never went anywhere. Once an order
   * has been confirmed or part-delivered it is short-closed instead, so the
   * delivered quantity and its history are preserved.
   */
  async cancel(id: string, companyId: string, userId: string, reason?: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (['CLOSED', 'CANCELLED'].includes(order.status)) throw Object.assign(new Error('Order already closed/cancelled'), { statusCode: 409 });
    if (order.status !== 'DRAFT') {
      throw Object.assign(new Error('Only a DRAFT order can be cancelled — short-close it instead'), { statusCode: 409 });
    }
    if (order.lines.some((l) => Number(l.deliveredQty) > 0)) {
      throw Object.assign(new Error('This order has deliveries against it — short-close it instead'), { statusCode: 409 });
    }
    await this.prisma.$transaction(async (tx) => {
      if (RESERVED_STATUSES.includes(order.status)) await this.releaseReservation(tx, order);
      await this.releaseLineReservations(tx, order.lines);
      await tx.salesOrder.update({ where: { id }, data: { status: 'CANCELLED', notes: reason ? `${order.notes ?? ''}\nCancelled: ${reason}` : order.notes } });
    });
    await this.audit('UPDATE', id, userId, { action: 'cancel', reason });
    return this.getById(id, companyId);
  }

  // Short-close: release outstanding reservation and close the order.
  async shortClose(id: string, companyId: string, userId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (!SHORT_CLOSEABLE.includes(order.status)) {
      throw Object.assign(new Error('Only a confirmed or active order can be short-closed'), { statusCode: 409 });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.releaseReservation(tx, order);
      await this.releaseLineReservations(tx, order.lines);
      await tx.salesOrder.update({ where: { id }, data: { status: 'CLOSED' } });
    });
    await this.audit('UPDATE', id, userId, { action: 'short-close' });
    return this.getById(id, companyId);
  }

  // ── Explicit line reservations ─────────────────────────────────────────────
  /**
   * Blocks (or re-sizes) warehouse stock for one order line. The reservation is
   * independent of approval — it exists so a line can be held against an advance
   * payment — and may sit in a warehouse other than the order's when the order's
   * own warehouse is short.
   */
  async reserveLine(
    id: string,
    lineId: string,
    companyId: string,
    input: { qty: number; warehouseId?: string | null; reserveUntil?: string | null },
    userId: string
  ) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    if (['CLOSED', 'CANCELLED'].includes(order.status)) {
      throw Object.assign(new Error('Stock cannot be reserved on a closed or cancelled order'), { statusCode: 409 });
    }
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw notFound('Order line not found');

    const item = await this.prisma.item.findFirst({
      where: { id: line.itemId, companyId },
      select: { code: true, description: true, reservationAllowed: true },
    });
    if (!item?.reservationAllowed) {
      throw Object.assign(
        new Error(`Item ${item?.code ?? ''} is not flagged "reservation allowed" in the item master`),
        { statusCode: 422 }
      );
    }

    const targetWarehouseId = input.warehouseId ?? line.reserveWarehouseId ?? order.warehouseId;
    if (!targetWarehouseId) throw Object.assign(new Error('Select a warehouse to reserve from'), { statusCode: 422 });
    const wh = await this.prisma.warehouse.findFirst({ where: { id: targetWarehouseId, companyId }, select: { id: true } });
    if (!wh) throw Object.assign(new Error('Warehouse not found'), { statusCode: 422 });

    const cfg = await this.config(companyId);
    const movingWarehouse = !!line.reserveWarehouseId && line.reserveWarehouseId !== targetWarehouseId;
    const currentlyReserved = movingWarehouse ? 0 : Number(line.reservedQty);

    const bal = await this.prisma.stockBalance.findFirst({
      where: { itemId: line.itemId, warehouseId: targetWarehouseId, binId: null },
      select: { qtyOnHand: true, qtyReserved: true },
    });
    const onHand = Number(bal?.qtyOnHand ?? 0);
    const reservedByOthers = Number(bal?.qtyReserved ?? 0) - currentlyReserved;

    const verdict = evaluateReservation({
      requestedQty: input.qty,
      orderedQty: Number(line.orderedQty),
      currentlyReserved,
      onHand,
      reservedByOthers,
      allowNegativeStock: cfg.ALLOW_NEGATIVE_STOCK,
    });
    if (!verdict.ok) throw Object.assign(new Error(verdict.reason!), { statusCode: 422 });

    await this.prisma.$transaction(async (tx) => {
      // Moving warehouses releases the old hold in full before taking the new one.
      if (movingWarehouse && Number(line.reservedQty) > 0) {
        await this.adjustReserved(tx, line.itemId, line.reserveWarehouseId!, -Number(line.reservedQty));
      }
      if (verdict.delta !== 0) await this.adjustReserved(tx, line.itemId, targetWarehouseId, verdict.delta);
      await tx.salesOrderLine.update({
        where: { id: lineId },
        data: {
          reservedQty: new Prisma.Decimal(input.qty),
          reserveWarehouseId: input.qty > 0 ? targetWarehouseId : null,
          reserveUntil: input.qty > 0 ? toDate(input.reserveUntil ?? null) : null,
        },
      });
    });

    await this.audit('UPDATE', id, userId, { action: 'reserve-line', lineId, qty: input.qty, warehouseId: targetWarehouseId });
    return this.getById(id, companyId);
  }

  /** Releases the whole reservation held by one line. */
  async releaseLine(id: string, lineId: string, companyId: string, userId: string) {
    return this.reserveLine(id, lineId, companyId, { qty: 0 }, userId);
  }

  /**
   * Releases reservations whose reserve-until date has passed, freeing the stock
   * for other orders. Called before any availability read so the numbers shown
   * are never inflated by stale holds.
   */
  async releaseExpiredReservations(companyId: string, asOf = new Date()): Promise<number> {
    const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const expired = await this.prisma.salesOrderLine.findMany({
      where: {
        reservedQty: { gt: 0 },
        reserveUntil: { lt: today },
        order: { companyId, status: { notIn: ['CLOSED', 'CANCELLED'] } },
      },
      select: { id: true, itemId: true, reservedQty: true, reserveWarehouseId: true },
    });
    if (!expired.length) return 0;
    await this.prisma.$transaction(async (tx) => {
      for (const l of expired) {
        if (l.reserveWarehouseId) await this.adjustReserved(tx, l.itemId, l.reserveWarehouseId, -Number(l.reservedQty));
        await tx.salesOrderLine.update({
          where: { id: l.id },
          data: { reservedQty: new Prisma.Decimal(0), reserveWarehouseId: null, reserveUntil: null },
        });
      }
    });
    return expired.length;
  }

  // ── Available-to-Promise per line ──────────────────────────────────────────
  async availability(id: string, companyId: string) {
    await this.releaseExpiredReservations(companyId);
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!order) throw notFound();
    const wh = order.warehouseId;
    const out = [];
    for (const l of order.lines) {
      // Stock in the line's own warehouse (its reservation warehouse when it has
      // one, otherwise the order's), plus the group total across the company.
      const lineWh = l.reserveWarehouseId ?? wh;
      const stock = await this.itemStock(companyId, l.itemId, lineWh);
      out.push({
        lineId: l.id,
        itemId: l.itemId,
        orderedQty: Number(l.orderedQty),
        warehouseId: lineWh,
        onHand: stock.warehouseOnHand,
        reserved: stock.warehouseReserved,
        availableToPromise: stock.warehouseAvailable,
        groupOnHand: stock.groupOnHand,
        groupAvailable: stock.groupAvailable,
        reservedQty: Number(l.reservedQty),
        reserveWarehouseId: l.reserveWarehouseId,
        reserveUntil: l.reserveUntil,
      });
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

  /** Releases every explicit line reservation on an order (cancel / short-close). */
  private async releaseLineReservations(tx: Prisma.TransactionClient, lines: any[]) {
    for (const l of lines) {
      const qty = Number(l.reservedQty ?? 0);
      if (qty > 0 && l.reserveWarehouseId) {
        await this.adjustReserved(tx, l.itemId, l.reserveWarehouseId, -qty);
        await tx.salesOrderLine.update({
          where: { id: l.id },
          data: { reservedQty: new Prisma.Decimal(0), reserveWarehouseId: null, reserveUntil: null },
        });
      }
    }
  }

  /** Moves qtyReserved on a warehouse stock balance, creating the row if needed. */
  private async adjustReserved(tx: Prisma.TransactionClient, itemId: string, warehouseId: string, delta: number) {
    if (delta === 0) return;
    const bal = await tx.stockBalance.findFirst({ where: { itemId, warehouseId, binId: null } });
    if (bal) {
      const next = Math.max(0, Number(bal.qtyReserved) + delta);
      await tx.stockBalance.update({ where: { id: bal.id }, data: { qtyReserved: new Prisma.Decimal(next) } });
    } else if (delta > 0) {
      await tx.stockBalance.create({ data: { itemId, warehouseId, binId: null, qtyOnHand: 0, qtyReserved: new Prisma.Decimal(delta), avgCost: 0 } });
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
