import { computeTotals } from '../services/sales/SalesPricingService';

describe('computeTotals', () => {
  it('computes a single line with no discount or tax', () => {
    const t = computeTotals([{ qty: 10, unitPrice: 5 }]);
    expect(t.subTotal).toBe(50);
    expect(t.discountAmount).toBe(0);
    expect(t.netAmount).toBe(50);
    expect(t.taxAmount).toBe(0);
    expect(t.totalAmount).toBe(50);
    expect(t.lines[0]).toEqual({ netAmount: 50, taxAmount: 0, lineTotal: 50 });
  });

  it('applies a line discount', () => {
    const t = computeTotals([{ qty: 10, unitPrice: 10, discountPct: 10 }]);
    expect(t.subTotal).toBe(100);
    expect(t.discountAmount).toBe(10);
    expect(t.netAmount).toBe(90);
    expect(t.lines[0].netAmount).toBe(90);
  });

  it('applies VAT on the discounted net', () => {
    const t = computeTotals([{ qty: 10, unitPrice: 10, discountPct: 10, taxRate: 5 }]);
    // net 90, tax 4.5, total 94.5
    expect(t.netAmount).toBe(90);
    expect(t.taxAmount).toBe(4.5);
    expect(t.totalAmount).toBe(94.5);
    expect(t.lines[0]).toEqual({ netAmount: 90, taxAmount: 4.5, lineTotal: 94.5 });
  });

  it('sums multiple lines with mixed tax rates', () => {
    const t = computeTotals([
      { qty: 2, unitPrice: 100, taxRate: 5 },   // net 200, tax 10
      { qty: 1, unitPrice: 50, taxRate: 0 },    // net 50,  tax 0
      { qty: 4, unitPrice: 25, discountPct: 20, taxRate: 5 }, // gross 100, disc 20, net 80, tax 4
    ]);
    expect(t.subTotal).toBe(350);       // 200 + 50 + 100
    expect(t.discountAmount).toBe(20);
    expect(t.netAmount).toBe(330);      // 350 - 20
    expect(t.taxAmount).toBe(14);       // 10 + 0 + 4
    expect(t.totalAmount).toBe(344);    // 330 + 14
  });

  it('rounds to 3 decimals', () => {
    const t = computeTotals([{ qty: 3, unitPrice: 1.729, taxRate: 5 }]);
    // net 5.187, tax 0.25935 -> 0.259, total 5.446
    expect(t.netAmount).toBe(5.187);
    expect(t.taxAmount).toBe(0.259);
    expect(t.totalAmount).toBe(5.446);
  });

  it('handles an empty document', () => {
    const t = computeTotals([]);
    expect(t.subTotal).toBe(0);
    expect(t.totalAmount).toBe(0);
    expect(t.lines).toEqual([]);
  });
});
