import { freeStock, evaluateReservation, outstandingReservations } from '../services/sales/SalesOrderService';
import { computeDueDate, headlineCreditDays } from '../services/sales/PaymentTermService';

describe('freeStock', () => {
  it('is on-hand less reserved', () => {
    expect(freeStock(100, 30)).toBe(70);
  });

  it('never goes negative', () => {
    expect(freeStock(10, 25)).toBe(0);
  });
});

describe('evaluateReservation', () => {
  const base = {
    requestedQty: 5,
    orderedQty: 10,
    currentlyReserved: 0,
    onHand: 20,
    reservedByOthers: 0,
    allowNegativeStock: false,
  };

  it('allows a reservation within free stock', () => {
    const r = evaluateReservation(base);
    expect(r.ok).toBe(true);
    expect(r.delta).toBe(5);
    expect(r.available).toBe(20);
  });

  it('rejects reserving more than the ordered quantity', () => {
    const r = evaluateReservation({ ...base, requestedQty: 12 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/ordered quantity/);
  });

  it('rejects a reservation beyond what other orders leave free', () => {
    const r = evaluateReservation({ ...base, requestedQty: 8, onHand: 20, reservedByOthers: 15 });
    expect(r.ok).toBe(false);
    expect(r.available).toBe(5);
    expect(r.reason).toMatch(/Only 5 available/);
  });

  it('only needs the delta when an existing reservation grows', () => {
    // 6 already held by this line, 14 held by others, 20 on hand -> 6 free
    const r = evaluateReservation({ ...base, requestedQty: 10, currentlyReserved: 6, onHand: 20, reservedByOthers: 14 });
    expect(r.ok).toBe(true);
    expect(r.delta).toBe(4);
  });

  it('allows shrinking a reservation even with no free stock', () => {
    const r = evaluateReservation({ ...base, requestedQty: 2, currentlyReserved: 8, onHand: 8, reservedByOthers: 0 });
    expect(r.ok).toBe(true);
    expect(r.delta).toBe(-6);
  });

  it('lets negative stock through when the company allows it', () => {
    const r = evaluateReservation({ ...base, requestedQty: 10, onHand: 0, allowNegativeStock: true });
    expect(r.ok).toBe(true);
  });

  it('rejects a negative quantity', () => {
    expect(evaluateReservation({ ...base, requestedQty: -1 }).ok).toBe(false);
  });
});

describe('outstandingReservations with explicit line holds', () => {
  it('does not reserve again what the line already holds', () => {
    const lines = [
      { itemId: 'A', orderedQty: 10, deliveredQty: 0, reservedQty: 4 },
      { itemId: 'B', orderedQty: 5, deliveredQty: 0, reservedQty: 5 }, // fully held already
    ];
    const r = outstandingReservations({ orderType: 'STOCK', warehouseId: 'WH1', lines });
    expect(r).toEqual([{ itemId: 'A', qty: 6 }]);
  });
});

describe('payment term due dates', () => {
  it('adds the credit days of the final instalment', () => {
    const due = computeDueDate(new Date('2026-01-10'), {
      dueDateBasis: 'DOCUMENT_DATE',
      creditDays: 0,
      lines: [{ addMonths: 0, creditDays: 15 }],
    });
    expect(due.toISOString().slice(0, 10)).toBe('2026-01-25');
  });

  it('falls back to the headline credit days with no schedule', () => {
    const due = computeDueDate(new Date('2026-01-10'), { dueDateBasis: 'DOCUMENT_DATE', creditDays: 30 });
    expect(due.toISOString().slice(0, 10)).toBe('2026-02-09');
  });

  it('runs from month end when the basis says so', () => {
    const due = computeDueDate(new Date('2026-01-10'), {
      dueDateBasis: 'MONTH_END',
      creditDays: 0,
      lines: [{ addMonths: 0, creditDays: 10 }],
    });
    expect(due.toISOString().slice(0, 10)).toBe('2026-02-10');
  });

  it('counts staged instalments to the last one', () => {
    expect(headlineCreditDays([{ addMonths: 0, creditDays: 30 }, { addMonths: 2, creditDays: 15 }])).toBe(75);
    expect(headlineCreditDays([])).toBe(0);
  });
});
