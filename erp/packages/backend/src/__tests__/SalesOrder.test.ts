import { evaluateCredit, needsApproval, outstandingReservations } from '../services/sales/SalesOrderService';

describe('evaluateCredit', () => {
  const base = { creditLimit: 1000, outstanding: 200, overdue: 0, openOrders: 100, orderValue: 300 };
  // availableCredit = 1000 - (200 + 100) = 700

  it('OFF mode always passes', () => {
    const r = evaluateCredit({ ...base, mode: 'OFF', orderValue: 5000, overdue: 999 });
    expect(r.decision).toBe('PASS');
  });

  it('passes when within available credit and no overdue', () => {
    const r = evaluateCredit({ ...base, mode: 'WARN', orderValue: 300 });
    expect(r.decision).toBe('PASS');
    expect(r.availableCredit).toBe(700);
  });

  it('WARN → HOLD when order exceeds available credit', () => {
    const r = evaluateCredit({ ...base, mode: 'WARN', orderValue: 800 });
    expect(r.decision).toBe('HOLD');
    expect(r.exceeded).toBe(true);
    expect(r.reason).toMatch(/exceeds available credit/);
  });

  it('WARN → HOLD when the customer has overdue balance', () => {
    const r = evaluateCredit({ ...base, mode: 'WARN', orderValue: 100, overdue: 50 });
    expect(r.decision).toBe('HOLD');
    expect(r.hasOverdue).toBe(true);
  });

  it('BLOCK → BLOCK when order exceeds available credit', () => {
    const r = evaluateCredit({ ...base, mode: 'BLOCK', orderValue: 800 });
    expect(r.decision).toBe('BLOCK');
  });

  it('BLOCK → PASS when within credit and no overdue', () => {
    const r = evaluateCredit({ ...base, mode: 'BLOCK', orderValue: 300 });
    expect(r.decision).toBe('PASS');
  });
});

describe('needsApproval', () => {
  it('is false when approval is not required', () => {
    expect(needsApproval(10000, false, 5000)).toBe(false);
  });
  it('is true when order value exceeds the threshold', () => {
    expect(needsApproval(6000, true, 5000)).toBe(true);
  });
  it('is false when order value is at or below the threshold', () => {
    expect(needsApproval(5000, true, 5000)).toBe(false);
    expect(needsApproval(4000, true, 5000)).toBe(false);
  });
});

describe('outstandingReservations', () => {
  const lines = [
    { itemId: 'A', orderedQty: 10, deliveredQty: 0 },
    { itemId: 'B', orderedQty: 5, deliveredQty: 2 },   // outstanding 3
    { itemId: 'C', orderedQty: 4, deliveredQty: 4 },   // fully delivered -> skip
  ];

  it('returns outstanding qty per stock line', () => {
    const r = outstandingReservations({ orderType: 'STOCK', warehouseId: 'WH1', lines });
    expect(r).toEqual([{ itemId: 'A', qty: 10 }, { itemId: 'B', qty: 3 }]);
  });

  it('returns nothing for non-stock orders', () => {
    expect(outstandingReservations({ orderType: 'SERVICE', warehouseId: 'WH1', lines })).toEqual([]);
    expect(outstandingReservations({ orderType: 'PROJECT', warehouseId: 'WH1', lines })).toEqual([]);
  });

  it('returns nothing when there is no warehouse', () => {
    expect(outstandingReservations({ orderType: 'STOCK', warehouseId: null, lines })).toEqual([]);
  });

  it('reserves for DIRECT orders too', () => {
    const r = outstandingReservations({ orderType: 'DIRECT', warehouseId: 'WH1', lines: [{ itemId: 'A', orderedQty: 2 }] });
    expect(r).toEqual([{ itemId: 'A', qty: 2 }]);
  });
});
