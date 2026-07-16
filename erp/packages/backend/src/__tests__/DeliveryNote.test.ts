import { outstandingDeliverable, computeIssue, recomputeOrderStatus, StockInsufficientError } from '../services/sales/DeliveryNoteService';

describe('outstandingDeliverable', () => {
  it('returns remaining qty', () => {
    expect(outstandingDeliverable(10, 3)).toBe(7);
  });
  it('never goes negative', () => {
    expect(outstandingDeliverable(5, 8)).toBe(0);
  });
});

describe('computeIssue', () => {
  it('reduces on-hand and releases the reserved portion', () => {
    // onHand 100, reserved 40, deliver 30 -> release 30, onHand 70, reserved 10
    const r = computeIssue(100, 40, 30, false);
    expect(r).toEqual({ newOnHand: 70, newReserved: 10, releaseQty: 30 });
  });

  it('releases at most the reserved amount', () => {
    // reserved only 10, deliver 30 -> release 10, reserved 0
    const r = computeIssue(100, 10, 30, false);
    expect(r.releaseQty).toBe(10);
    expect(r.newReserved).toBe(0);
    expect(r.newOnHand).toBe(70);
  });

  it('blocks delivery beyond available when negative stock is not allowed', () => {
    // available = onHand - reserved = 50 - 40 = 10; deliver 20 -> throw
    expect(() => computeIssue(50, 40, 20, false)).toThrow(StockInsufficientError);
  });

  it('permits delivery beyond available when negative stock is allowed', () => {
    const r = computeIssue(50, 40, 20, true);
    expect(r.newOnHand).toBe(30);
    expect(r.newReserved).toBe(20); // released min(20,40)
  });

  it('allows delivery exactly at available', () => {
    const r = computeIssue(50, 40, 10, false);
    expect(r.newOnHand).toBe(40);
    expect(r.newReserved).toBe(30);
  });
});

describe('recomputeOrderStatus', () => {
  it('is DELIVERED when every line is fully delivered', () => {
    expect(recomputeOrderStatus([{ orderedQty: 5, deliveredQty: 5 }, { orderedQty: 3, deliveredQty: 3 }])).toBe('DELIVERED');
  });
  it('is IN_PROGRESS on partial delivery', () => {
    expect(recomputeOrderStatus([{ orderedQty: 5, deliveredQty: 2 }, { orderedQty: 3, deliveredQty: 0 }])).toBe('IN_PROGRESS');
  });
  it('is null when nothing has been delivered', () => {
    expect(recomputeOrderStatus([{ orderedQty: 5, deliveredQty: 0 }])).toBeNull();
  });
  it('accumulates partial deliveries to DELIVERED once complete', () => {
    // simulate two deliveries: 2 then 3 of ordered 5
    let delivered = 0;
    delivered += 2;
    expect(recomputeOrderStatus([{ orderedQty: 5, deliveredQty: delivered }])).toBe('IN_PROGRESS');
    delivered += 3;
    expect(recomputeOrderStatus([{ orderedQty: 5, deliveredQty: delivered }])).toBe('DELIVERED');
  });
});
