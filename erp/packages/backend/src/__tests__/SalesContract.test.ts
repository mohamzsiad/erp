import { boqAmount, summarizeBoq, contractVariance, applyVariationDelta } from '../services/sales/SalesContractService';

describe('boqAmount', () => {
  it('multiplies qty by rate, rounded to 3dp', () => {
    expect(boqAmount(10, 2.5)).toBe(25);
    expect(boqAmount(3, 1.729)).toBe(5.187);
  });
});

describe('summarizeBoq', () => {
  it('totals lines and subtotals by section', () => {
    const s = summarizeBoq([
      { section: 'Civil', contractQty: 100, rate: 5 },   // 500
      { section: 'Civil', contractQty: 50, rate: 2 },    // 100
      { section: 'MEP', contractQty: 10, rate: 30 },     // 300
    ]);
    expect(s.total).toBe(900);
    expect(s.sections).toEqual([{ section: 'Civil', subtotal: 600 }, { section: 'MEP', subtotal: 300 }]);
  });

  it('groups unlabelled lines under "Ungrouped"', () => {
    const s = summarizeBoq([{ section: null, contractQty: 4, rate: 25 }]);
    expect(s.sections).toEqual([{ section: 'Ungrouped', subtotal: 100 }]);
  });
});

describe('contractVariance', () => {
  it('is a match when the BOQ total equals the contract value', () => {
    expect(contractVariance(1000, 1000)).toEqual({ variance: 0, matches: true });
  });
  it('flags a mismatch beyond tolerance', () => {
    expect(contractVariance(1000, 1200)).toEqual({ variance: 200, matches: false });
  });
  it('tolerates tiny rounding differences', () => {
    expect(contractVariance(1000, 1000.4).matches).toBe(true);
  });
});

describe('applyVariationDelta', () => {
  it('records the original qty on the first variation and recomputes the amount', () => {
    const r = applyVariationDelta({ originalQty: null, contractQty: 100, rate: 5 }, 20);
    expect(r).toEqual({ originalQty: 100, newContractQty: 120, newAmount: 600 });
  });

  it('preserves the original qty across subsequent variations', () => {
    // second variation on a line already varied (original 100, current 120)
    const r = applyVariationDelta({ originalQty: 100, contractQty: 120, rate: 5 }, -30);
    expect(r.originalQty).toBe(100);
    expect(r.newContractQty).toBe(90);
    expect(r.newAmount).toBe(450);
  });

  it('handles omission (negative delta)', () => {
    const r = applyVariationDelta({ originalQty: null, contractQty: 10, rate: 100 }, -4);
    expect(r.newContractQty).toBe(6);
    expect(r.newAmount).toBe(600);
  });
});
