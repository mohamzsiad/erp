import { buildInvoiceJournalLines, reverseJournalLines, journalIsBalanced } from '../services/sales/SalesInvoiceService';
import { allocateCredit } from '../services/sales/CreditNoteService';
import { computeReceive } from '../services/sales/SalesReturnService';

const ACC = { ar: 'AR', rev: 'REV', vat: 'VAT', cogs: 'COGS', inv: 'INV' };

describe('credit-note journal (reversal of the sales-invoice journal)', () => {
  const invoiceLines = buildInvoiceJournalLines({
    arAccount: ACC.ar, revenueAccount: ACC.rev, vatAccount: ACC.vat, cogsAccount: ACC.cogs, inventoryAccount: ACC.inv,
    netAmount: 200, taxAmount: 10, totalAmount: 210, cogsTotal: 120,
  });
  const creditLines = reverseJournalLines(invoiceLines);

  it('balances', () => {
    expect(journalIsBalanced(creditLines)).toBe(true);
  });

  it('reduces the receivable (Cr AR) and reverses revenue/VAT', () => {
    expect(creditLines.find((l) => l.accountId === ACC.ar)!.credit).toBe(210); // AR credited (receivable down)
    expect(creditLines.find((l) => l.accountId === ACC.rev)!.debit).toBe(200); // revenue reversed
    expect(creditLines.find((l) => l.accountId === ACC.vat)!.debit).toBe(10);  // VAT output reversed
  });

  it('restores inventory (Dr Inventory) and reverses COGS (Cr COGS)', () => {
    expect(creditLines.find((l) => l.accountId === ACC.inv)!.debit).toBe(120);
    expect(creditLines.find((l) => l.accountId === ACC.cogs)!.credit).toBe(120);
  });

  it('invoice + credit note net every account to zero', () => {
    const net: Record<string, number> = {};
    [...invoiceLines, ...creditLines].forEach((l) => { net[l.accountId] = (net[l.accountId] ?? 0) + l.debit - l.credit; });
    Object.values(net).forEach((v) => expect(v).toBe(0));
  });
});

describe('allocateCredit', () => {
  it('applies the full credit when it is within the outstanding balance', () => {
    expect(allocateCredit(500, 200)).toEqual({ applied: 200, fullyPaid: false });
  });
  it('caps the applied amount at the outstanding balance and marks fully paid', () => {
    expect(allocateCredit(150, 200)).toEqual({ applied: 150, fullyPaid: true });
  });
  it('applies nothing to a settled invoice', () => {
    expect(allocateCredit(0, 200)).toEqual({ applied: 0, fullyPaid: false });
  });
});

describe('computeReceive (stock restore on return)', () => {
  it('adds returned qty back to on-hand', () => {
    expect(computeReceive(70, 30)).toBe(100);
  });
  it('works from zero on-hand', () => {
    expect(computeReceive(0, 5)).toBe(5);
  });
});
