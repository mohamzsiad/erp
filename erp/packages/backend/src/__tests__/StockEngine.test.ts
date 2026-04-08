/**
 * StockEngine unit tests
 *
 * Tests cover:
 *  1. WAC recalculation (various price/qty combos, precision)
 *  2. Negative stock prevention (outbound > available)
 *  3. First-receipt creates new balance row
 *  4. Outbound leaves WAC unchanged
 *  5. Reservation: happy path + insufficient stock
 *  6. Release reservation clamps at 0
 *  7. getBalance returns null when no row exists
 */

import { StockEngine, StockInsufficientError } from '../services/inventory/StockEngine';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBalanceRow(qtyOnHand: number, qtyReserved: number, avgCost: number) {
  return {
    id:           'balance-001',
    qty_on_hand:  String(qtyOnHand),
    qty_reserved: String(qtyReserved),
    avg_cost:     String(avgCost),
  };
}

// ── Mock Prisma ────────────────────────────────────────────────────────────────

function makeMockPrisma(overrides: Partial<{
  balanceRow: ReturnType<typeof makeBalanceRow> | null;
}> = {}) {
  const { balanceRow = null } = overrides;

  const upsertedBalances: any[] = [];
  const insertedMovements: any[] = [];
  const updatedReservations: any[] = [];

  // $queryRaw is called multiple times per operation; we route based on call order
  let queryRawCallCount = 0;

  const queryRaw = jest.fn().mockImplementation(async (...args: any[]) => {
    // Detect query template string to route to correct mock result
    const tpl = String(args[0]?.[0] ?? '');

    if (tpl.includes('FOR UPDATE')) {
      return balanceRow ? [balanceRow] : [];
    }
    if (tpl.includes('INSERT INTO stock_balances')) {
      const id = 'balance-new-001';
      upsertedBalances.push({ id, ...args });
      return [{ id }];
    }
    if (tpl.includes('UPDATE stock_balances') && tpl.includes('qty_on_hand')) {
      upsertedBalances.push(args);
      return [];
    }
    if (tpl.includes('UPDATE stock_balances') && tpl.includes('qty_reserved')) {
      updatedReservations.push(args);
      return [];
    }
    if (tpl.includes('INSERT INTO stock_movements')) {
      insertedMovements.push(args);
      return [];
    }
    // getBalance (non-locking SELECT)
    if (tpl.includes('FROM stock_balances') && !tpl.includes('FOR UPDATE')) {
      return balanceRow ? [balanceRow] : [];
    }
    return [];
  });

  const txFn = jest.fn().mockImplementation(async (cb: any, _opts?: any) => {
    return cb({ $queryRaw: queryRaw });
  });

  const prisma: any = {
    $transaction: txFn,
    $queryRaw:    queryRaw,
    _upsertedBalances:    upsertedBalances,
    _insertedMovements:   insertedMovements,
    _updatedReservations: updatedReservations,
  };

  return prisma;
}

// ── Base params ────────────────────────────────────────────────────────────────

const BASE_PARAMS = {
  itemId:          'item-001',
  warehouseId:     'wh-001',
  binId:           null,
  transactionType: 'GRN' as any,
  sourceDocId:     'doc-001',
  sourceDocNo:     'GRN-0001',
  userId:          'user-001',
  companyId:       'company-001',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. WAC Recalculation
// ─────────────────────────────────────────────────────────────────────────────

describe('StockEngine – WAC recalculation', () => {
  it('calculates correct WAC on first receipt (no prior balance)', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    const result = await engine.updateStock({
      ...BASE_PARAMS,
      qty:     100,
      avgCost: 10.00,
    });

    expect(result.qtyOnHand).toBe(100);
    expect(result.avgCost).toBe(10.00);
    expect(result.qtyReserved).toBe(0);
  });

  it('blends WAC correctly: existing 100 @ $10, receive 50 @ $16 → $12', async () => {
    // (100 * 10 + 50 * 16) / 150 = (1000 + 800) / 150 = 1800 / 150 = 12.00
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(100, 0, 10.00),
    });
    const engine = new StockEngine(prisma);

    const result = await engine.updateStock({
      ...BASE_PARAMS,
      qty:     50,
      avgCost: 16.00,
    });

    expect(result.qtyOnHand).toBe(150);
    expect(result.avgCost).toBeCloseTo(12.00, 4);
  });

  it('WAC is unchanged for outbound movements', async () => {
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(100, 0, 10.00),
    });
    const engine = new StockEngine(prisma);

    const result = await engine.updateStock({
      ...BASE_PARAMS,
      transactionType: 'ISSUE',
      qty:     -30,
      avgCost: 0, // avgCost param irrelevant for outbound
    });

    expect(result.qtyOnHand).toBe(70);
    expect(result.avgCost).toBe(10.00); // unchanged
  });

  it('WAC precision: repeated small purchases do not drift', async () => {
    // Simulate 5 sequential purchases with sub-cent prices
    // Start: 0 units, then receive:
    //   100 @ 1.01, 200 @ 1.02, 150 @ 1.03, 300 @ 1.04, 50 @ 1.05
    // Expected: (100*1.01 + 200*1.02 + 150*1.03 + 300*1.04 + 50*1.05) / 800
    //           = (101 + 204 + 154.5 + 312 + 52.5) / 800 = 824 / 800 = 1.03

    let currentQty = 0;
    let currentAvg = 0;

    const batches: Array<[number, number]> = [
      [100, 1.01],
      [200, 1.02],
      [150, 1.03],
      [300, 1.04],
      [50,  1.05],
    ];

    for (const [qty, price] of batches) {
      const prisma = makeMockPrisma({
        balanceRow: currentQty > 0 ? makeBalanceRow(currentQty, 0, currentAvg) : null,
      });
      const engine = new StockEngine(prisma);

      const result = await engine.updateStock({
        ...BASE_PARAMS,
        qty,
        avgCost: price,
      });

      currentQty = result.qtyOnHand;
      currentAvg = result.avgCost;
    }

    expect(currentQty).toBe(800);
    // Allow max 0.001 deviation for precision
    expect(Math.abs(currentAvg - 1.03)).toBeLessThan(0.001);
  });

  it('WAC handles large quantities without BigInt overflow', async () => {
    // 1,000,000 units @ $999.999 — should not throw or lose precision
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    const result = await engine.updateStock({
      ...BASE_PARAMS,
      qty:     1_000_000,
      avgCost: 999.999,
    });

    expect(result.qtyOnHand).toBe(1_000_000);
    expect(result.avgCost).toBeCloseTo(999.999, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Negative stock prevention
// ─────────────────────────────────────────────────────────────────────────────

describe('StockEngine – negative stock prevention', () => {
  it('throws StockInsufficientError when outbound > available (no reservation)', async () => {
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(50, 0, 10.00),
    });
    const engine = new StockEngine(prisma);

    await expect(
      engine.updateStock({
        ...BASE_PARAMS,
        transactionType: 'ISSUE',
        qty:     -60,
        avgCost: 0,
      }),
    ).rejects.toThrow(StockInsufficientError);
  });

  it('throws StockInsufficientError when outbound > available (with reservations)', async () => {
    // 50 on hand, 30 reserved → 20 available. Try to issue 25.
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(50, 30, 10.00),
    });
    const engine = new StockEngine(prisma);

    await expect(
      engine.updateStock({
        ...BASE_PARAMS,
        transactionType: 'ISSUE',
        qty:     -25,
        avgCost: 0,
      }),
    ).rejects.toThrow(StockInsufficientError);
  });

  it('throws StockInsufficientError when no balance row exists at all', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    await expect(
      engine.updateStock({
        ...BASE_PARAMS,
        transactionType: 'ISSUE',
        qty:     -10,
        avgCost: 0,
      }),
    ).rejects.toThrow(StockInsufficientError);
  });

  it('StockInsufficientError carries correct statusCode 422', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    try {
      await engine.updateStock({
        ...BASE_PARAMS,
        transactionType: 'ISSUE',
        qty: -1,
        avgCost: 0,
      });
      fail('Expected StockInsufficientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(StockInsufficientError);
      expect(err.statusCode).toBe(422);
      expect(err.requested).toBe(1);
      expect(err.available).toBe(0);
    }
  });

  it('allows exact full outbound (no over-issue)', async () => {
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(50, 0, 10.00),
    });
    const engine = new StockEngine(prisma);

    const result = await engine.updateStock({
      ...BASE_PARAMS,
      transactionType: 'ISSUE',
      qty:     -50,
      avgCost: 0,
    });

    expect(result.qtyOnHand).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Reservations
// ─────────────────────────────────────────────────────────────────────────────

describe('StockEngine – reserveStock', () => {
  it('reserves stock successfully when enough available', async () => {
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(100, 10, 10.00),
    });
    const engine = new StockEngine(prisma);

    // 100 on hand, 10 reserved → 90 available; reserving 50 should succeed
    await expect(
      engine.reserveStock({ itemId: 'item-001', warehouseId: 'wh-001', binId: null, qty: 50, companyId: 'company-001' }),
    ).resolves.toBeUndefined();
  });

  it('throws StockInsufficientError when reservation exceeds available', async () => {
    // 50 on hand, 40 reserved → 10 available; try to reserve 20
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(50, 40, 5.00),
    });
    const engine = new StockEngine(prisma);

    await expect(
      engine.reserveStock({ itemId: 'item-001', warehouseId: 'wh-001', binId: null, qty: 20, companyId: 'company-001' }),
    ).rejects.toThrow(StockInsufficientError);
  });

  it('silently succeeds when no balance row exists (item not yet stocked)', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    // Should not throw
    await expect(
      engine.reserveStock({ itemId: 'item-001', warehouseId: 'wh-001', binId: null, qty: 10, companyId: 'company-001' }),
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Release reservation
// ─────────────────────────────────────────────────────────────────────────────

describe('StockEngine – releaseReservation', () => {
  it('calls UPDATE with correct qty reduction', async () => {
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(100, 20, 10.00),
    });
    const engine = new StockEngine(prisma);

    await expect(
      engine.releaseReservation({ itemId: 'item-001', warehouseId: 'wh-001', binId: null, qty: 10 }),
    ).resolves.toBeUndefined();

    // Verify that $queryRaw was called and included GREATEST(0, ...)
    const calls: string[] = prisma.$queryRaw.mock.calls.map((c: any) =>
      String(c[0]?.[0] ?? ''),
    );
    const releaseCall = calls.find((q) => q.includes('GREATEST'));
    expect(releaseCall).toBeDefined();
  });

  it('does not throw when no balance row exists (idempotent)', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    await expect(
      engine.releaseReservation({ itemId: 'item-001', warehouseId: 'wh-001', binId: null, qty: 5 }),
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. getBalance
// ─────────────────────────────────────────────────────────────────────────────

describe('StockEngine – getBalance', () => {
  it('returns null when no row exists', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    const result = await engine.getBalance('item-001', 'wh-001', null);
    expect(result).toBeNull();
  });

  it('returns correct parsed values when row exists', async () => {
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(75.5, 10, 8.25),
    });
    const engine = new StockEngine(prisma);

    const result = await engine.getBalance('item-001', 'wh-001', null);

    expect(result).not.toBeNull();
    expect(result!.qtyOnHand).toBe(75.5);
    expect(result!.qtyReserved).toBe(10);
    expect(result!.avgCost).toBe(8.25);
    expect(result!.qtyAvailable).toBe(65.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. StockMovement audit record
// ─────────────────────────────────────────────────────────────────────────────

describe('StockEngine – audit trail', () => {
  it('inserts a StockMovement record on every updateStock call', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    await engine.updateStock({ ...BASE_PARAMS, qty: 100, avgCost: 5.00 });

    const calls: string[] = prisma.$queryRaw.mock.calls.map((c: any) =>
      String(c[0]?.[0] ?? ''),
    );
    const movementInsert = calls.find((q) => q.includes('INSERT INTO stock_movements'));
    expect(movementInsert).toBeDefined();
  });

  it('records correct transaction_type in the movement', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    await engine.updateStock({
      ...BASE_PARAMS,
      transactionType: 'GRN',
      qty:     200,
      avgCost: 15.00,
    });

    // Check that 'GRN' was passed to $queryRaw for the movement insert
    const movementCall = prisma.$queryRaw.mock.calls.find((c: any) =>
      String(c[0]?.[0] ?? '').includes('INSERT INTO stock_movements'),
    );
    expect(movementCall).toBeDefined();

    // The transaction_type value 'GRN' should appear as one of the template params
    const params = movementCall!.slice(1);
    expect(params).toContain('GRN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Transaction isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('StockEngine – transaction handling', () => {
  it('wraps updateStock in a Prisma transaction', async () => {
    const prisma = makeMockPrisma({ balanceRow: null });
    const engine = new StockEngine(prisma);

    await engine.updateStock({ ...BASE_PARAMS, qty: 10, avgCost: 1.00 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('wraps reserveStock in a Prisma transaction', async () => {
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(100, 0, 10.00),
    });
    const engine = new StockEngine(prisma);

    await engine.reserveStock({ itemId: 'item-001', warehouseId: 'wh-001', binId: null, qty: 10, companyId: 'company-001' });

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rolls back when StockInsufficientError is thrown inside transaction', async () => {
    // Simulate transaction that executes the callback but lets errors propagate
    const prisma = makeMockPrisma({
      balanceRow: makeBalanceRow(5, 0, 10.00),
    });
    const engine = new StockEngine(prisma);

    await expect(
      engine.updateStock({
        ...BASE_PARAMS,
        transactionType: 'ISSUE',
        qty:     -100,
        avgCost: 0,
      }),
    ).rejects.toThrow(StockInsufficientError);

    // Ensure no UPDATE stock_balances was called after the error
    const updateCalls = prisma.$queryRaw.mock.calls.filter((c: any) =>
      String(c[0]?.[0] ?? '').includes('UPDATE stock_balances') &&
      String(c[0]?.[0] ?? '').includes('qty_on_hand'),
    );
    expect(updateCalls.length).toBe(0);
  });
});
