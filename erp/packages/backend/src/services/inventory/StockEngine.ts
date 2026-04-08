/**
 * StockEngine — the heart of the Inventory module.
 *
 * Responsibilities:
 *  1. Maintain StockBalance with Weighted-Average-Cost (WAC) recalculation
 *  2. Prevent negative stock (throws StockInsufficientError)
 *  3. Write an immutable StockMovement audit record on every change
 *  4. Manage qtyReserved for reservation/release
 *  5. All operations wrapped in Prisma transactions with row-level SELECT FOR UPDATE
 *
 * WAC precision: arithmetic is performed in integer micro-units (qty * 1e6,
 * cost * 1e6) to avoid IEEE-754 floating-point drift, then converted back.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type { StockUpdateParams } from '@clouderp/shared';

// ── Custom errors ──────────────────────────────────────────────────────────────
export class StockInsufficientError extends Error {
  public readonly statusCode = 422;
  constructor(
    public readonly itemId: string,
    public readonly warehouseId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `Insufficient stock: requested ${requested}, available ${available} ` +
      `(item=${itemId}, warehouse=${warehouseId})`,
    );
    this.name = 'StockInsufficientError';
  }
}

export class StockBalanceNotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(itemId: string, warehouseId: string) {
    super(`No stock balance found for item=${itemId}, warehouse=${warehouseId}`);
    this.name = 'StockBalanceNotFoundError';
  }
}

// ── WAC helpers (integer micro-unit arithmetic) ────────────────────────────────
const PRECISION = 1_000_000; // 6 decimal places

function toMicro(n: number): bigint {
  // Round to avoid floating-point noise before converting
  return BigInt(Math.round(n * PRECISION));
}

function fromMicro(n: bigint): number {
  return Number(n) / PRECISION;
}

/**
 * Calculates new Weighted Average Cost.
 *   new_avg = (currentQty * currentAvg + inQty * purchasePrice) / (currentQty + inQty)
 * All arithmetic in integer micro-units to preserve precision.
 */
function calcNewWac(
  currentQty: number,
  currentAvg: number,
  inQty: number,
  purchasePrice: number,
): number {
  const qCurrent = toMicro(currentQty);
  const cCurrent = toMicro(currentAvg);
  const qIn      = toMicro(inQty);
  const cIn      = toMicro(purchasePrice);

  const totalQty = qCurrent + qIn;
  if (totalQty === 0n) return purchasePrice;

  // Value in micro² — divide out one PRECISION factor
  const totalValue = qCurrent * cCurrent + qIn * cIn;
  const newAvgMicro = totalValue / totalQty; // integer division is fine — sub-micro noise is negligible

  return fromMicro(newAvgMicro);
}

// ── StockEngine ────────────────────────────────────────────────────────────────
export class StockEngine {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Main entry point ────────────────────────────────────────────────────────
  async updateStock(params: StockUpdateParams): Promise<{
    qtyOnHand: number;
    qtyReserved: number;
    avgCost: number;
  }> {
    const { itemId, warehouseId, binId, qty, avgCost, transactionType,
            sourceDocId, sourceDocNo, userId, companyId } = params;

    // Validate direction
    const isInbound = qty > 0;
    const isOutbound = qty < 0;

    return this.prisma.$transaction(async (tx) => {
      // ── 1. Lock + fetch the StockBalance row (SELECT FOR UPDATE) ─────────
      const lockRows = await tx.$queryRaw<Array<{
        id: string;
        qty_on_hand: string;
        qty_reserved: string;
        avg_cost: string;
      }>>`
        SELECT id, qty_on_hand, qty_reserved, avg_cost
        FROM stock_balances
        WHERE item_id    = ${itemId}
          AND warehouse_id = ${warehouseId}
          AND (bin_id = ${binId} OR (bin_id IS NULL AND ${binId}::text IS NULL))
        FOR UPDATE
      `;

      const existing = lockRows[0];

      // ── 2. Outbound: check available qty ─────────────────────────────────
      if (isOutbound && existing) {
        const onHand    = parseFloat(existing.qty_on_hand);
        const reserved  = parseFloat(existing.qty_reserved);
        const available = onHand - reserved;
        const requested = Math.abs(qty);

        if (requested > available) {
          throw new StockInsufficientError(itemId, warehouseId, requested, available);
        }
      }

      if (isOutbound && !existing) {
        throw new StockInsufficientError(itemId, warehouseId, Math.abs(qty), 0);
      }

      // ── 3. Calculate new WAC + qty ────────────────────────────────────────
      let newQty: number;
      let newAvgCost: number;

      if (!existing) {
        // First receipt
        newQty     = qty;
        newAvgCost = avgCost;
      } else {
        const currentQty = parseFloat(existing.qty_on_hand);
        const currentAvg = parseFloat(existing.avg_cost);

        if (isInbound) {
          newAvgCost = calcNewWac(currentQty, currentAvg, qty, avgCost);
          newQty     = currentQty + qty;
        } else {
          // For outbound, WAC stays the same; qty decreases
          newAvgCost = currentAvg;
          newQty     = currentQty + qty; // qty is negative
        }
      }

      // ── 4. Upsert StockBalance ────────────────────────────────────────────
      let balanceId: string;

      if (!existing) {
        // Create new balance row
        const created = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO stock_balances (id, item_id, warehouse_id, bin_id,
                                     qty_on_hand, qty_reserved, avg_cost, updated_at)
          VALUES (gen_random_uuid()::text, ${itemId}, ${warehouseId}, ${binId},
                  ${newQty}, 0, ${newAvgCost}, now())
          RETURNING id
        `;
        balanceId = created[0].id;
      } else {
        // Update existing
        await tx.$queryRaw`
          UPDATE stock_balances
          SET qty_on_hand = ${newQty},
              avg_cost    = ${newAvgCost},
              updated_at  = now()
          WHERE id = ${existing.id}
        `;
        balanceId = existing.id;
      }

      // ── 5. Write immutable StockMovement record ───────────────────────────
      await tx.$queryRaw`
        INSERT INTO stock_movements
          (id, item_id, warehouse_id, bin_id, qty, avg_cost, balance_after,
           transaction_type, source_doc_id, source_doc_no,
           company_id, user_id, created_at)
        VALUES
          (gen_random_uuid()::text,
           ${itemId}, ${warehouseId}, ${binId},
           ${qty}, ${newAvgCost}, ${newQty},
           ${transactionType}, ${sourceDocId}, ${sourceDocNo},
           ${companyId}, ${userId}, now())
      `;

      return {
        qtyOnHand:   newQty,
        qtyReserved: existing ? parseFloat(existing.qty_reserved) : 0,
        avgCost:     newAvgCost,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10_000,
    });
  }

  // ── Reserve stock (when PO is placed) ───────────────────────────────────────
  async reserveStock(params: {
    itemId: string;
    warehouseId: string;
    binId: string | null;
    qty: number;
    companyId: string;
  }): Promise<void> {
    const { itemId, warehouseId, binId, qty } = params;

    await this.prisma.$transaction(async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{
        id: string;
        qty_on_hand: string;
        qty_reserved: string;
      }>>`
        SELECT id, qty_on_hand, qty_reserved
        FROM stock_balances
        WHERE item_id    = ${itemId}
          AND warehouse_id = ${warehouseId}
          AND (bin_id = ${binId} OR (bin_id IS NULL AND ${binId}::text IS NULL))
        FOR UPDATE
      `;

      if (!lockRows[0]) {
        // No stock exists to reserve — silently skip (item may not be stocked yet)
        return;
      }

      const row = lockRows[0];
      const onHand    = parseFloat(row.qty_on_hand);
      const reserved  = parseFloat(row.qty_reserved);
      const available = onHand - reserved;

      if (qty > available) {
        throw new StockInsufficientError(itemId, warehouseId, qty, available);
      }

      await tx.$queryRaw`
        UPDATE stock_balances
        SET qty_reserved = qty_reserved + ${qty},
            updated_at   = now()
        WHERE id = ${row.id}
      `;
    });
  }

  // ── Release reservation (when GRN is posted or PO cancelled) ────────────────
  async releaseReservation(params: {
    itemId: string;
    warehouseId: string;
    binId: string | null;
    qty: number;
  }): Promise<void> {
    const { itemId, warehouseId, binId, qty } = params;

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        UPDATE stock_balances
        SET qty_reserved = GREATEST(0, qty_reserved - ${qty}),
            updated_at   = now()
        WHERE item_id    = ${itemId}
          AND warehouse_id = ${warehouseId}
          AND (bin_id = ${binId} OR (bin_id IS NULL AND ${binId}::text IS NULL))
      `;
    });
  }

  // ── Get current balance (read-only, no lock) ─────────────────────────────────
  async getBalance(itemId: string, warehouseId: string, binId: string | null) {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      qty_on_hand: string;
      qty_reserved: string;
      avg_cost: string;
    }>>`
      SELECT id, qty_on_hand, qty_reserved, avg_cost
      FROM stock_balances
      WHERE item_id    = ${itemId}
        AND warehouse_id = ${warehouseId}
        AND (bin_id = ${binId} OR (bin_id IS NULL AND ${binId}::text IS NULL))
    `;

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id:           r.id,
      qtyOnHand:    parseFloat(r.qty_on_hand),
      qtyReserved:  parseFloat(r.qty_reserved),
      avgCost:      parseFloat(r.avg_cost),
      qtyAvailable: parseFloat(r.qty_on_hand) - parseFloat(r.qty_reserved),
    };
  }

  // ── Snapshot system qty (for physical count init) ────────────────────────────
  async snapshotWarehouseBalances(warehouseId: string, companyId: string) {
    return this.prisma.stockBalance.findMany({
      where: { warehouseId, item: { companyId } },
      include: { item: { select: { id: true, code: true, description: true, uomId: true } }, bin: true },
    });
  }
}
