import { certifyLine, computeBillAmounts, progressSummary, OverBillingError } from '../services/sales/ProgressBillService';
import { buildInvoiceJournalLines, journalIsBalanced } from '../services/sales/SalesInvoiceService';

describe('certifyLine (cumulative certification)', () => {
  it('this value = cumulative value − previously certified value', () => {
    // contract qty 100, rate 10. First bill: 40% done -> cum 40, prev 0
    const b1 = certifyLine(40, 0, 10, 100);
    expect(b1).toEqual({ cumValue: 400, thisValue: 400 });
    // Second bill: now 70% done -> cum 70, prev value 400
    const b2 = certifyLine(70, b1.cumValue, 10, 100);
    expect(b2).toEqual({ cumValue: 700, thisValue: 300 });
    // Third bill: complete -> cum 100, prev 700
    const b3 = certifyLine(100, b2.cumValue, 10, 100);
    expect(b3).toEqual({ cumValue: 1000, thisValue: 300 });
    // total this-values across bills == contract value
    expect(b1.thisValue + b2.thisValue + b3.thisValue).toBe(1000);
  });

  it('blocks over-billing beyond the contract quantity', () => {
    expect(() => certifyLine(110, 0, 10, 100)).toThrow(OverBillingError);
  });

  it('allows certifying exactly the contract quantity', () => {
    expect(() => certifyLine(100, 0, 10, 100)).not.toThrow();
  });
});

describe('computeBillAmounts', () => {
  it('applies VAT to the current-period certified value', () => {
    expect(computeBillAmounts(1000, 5)).toEqual({ amount: 1000, taxAmount: 50, totalAmount: 1050 });
  });
  it('handles zero-rated bills', () => {
    expect(computeBillAmounts(1000, 0)).toEqual({ amount: 1000, taxAmount: 0, totalAmount: 1000 });
  });
});

describe('progressSummary', () => {
  it('computes balance-to-complete and % complete', () => {
    const s = progressSummary(1000, 700, 300);
    expect(s.balanceToComplete).toBe(300);
    expect(s.percentComplete).toBe(70);
    expect(s.thisBill).toBe(300);
  });
  it('is 0% for a zero-value contract', () => {
    expect(progressSummary(0, 0, 0).percentComplete).toBe(0);
  });
});

describe('progress-bill journal', () => {
  it('balances and posts Dr AR, Cr Contract Revenue, Cr VAT (no COGS)', () => {
    const lines = buildInvoiceJournalLines({
      arAccount: 'AR', revenueAccount: 'CONTRACT_REV', vatAccount: 'VAT', cogsAccount: null, inventoryAccount: null,
      netAmount: 1000, taxAmount: 50, totalAmount: 1050, cogsTotal: 0,
    });
    expect(journalIsBalanced(lines)).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines.find((l) => l.accountId === 'AR')!.debit).toBe(1050);
    expect(lines.find((l) => l.accountId === 'CONTRACT_REV')!.credit).toBe(1000);
    expect(lines.find((l) => l.accountId === 'VAT')!.credit).toBe(50);
    expect(lines.some((l) => l.description?.includes('COGS'))).toBe(false);
  });
});
