import { buildInvoiceJournalLines, reverseJournalLines, journalIsBalanced } from '../services/sales/SalesInvoiceService';

const ACC = { ar: 'AR', rev: 'REV', vat: 'VAT', cogs: 'COGS', inv: 'INV' };

describe('buildInvoiceJournalLines', () => {
  it('balances a simple VAT invoice with no COGS', () => {
    // net 100, tax 5, total 105
    const lines = buildInvoiceJournalLines({
      arAccount: ACC.ar, revenueAccount: ACC.rev, vatAccount: ACC.vat, cogsAccount: null, inventoryAccount: null,
      netAmount: 100, taxAmount: 5, totalAmount: 105, cogsTotal: 0,
    });
    expect(journalIsBalanced(lines)).toBe(true);
    expect(lines.find((l) => l.accountId === ACC.ar)!.debit).toBe(105);
    expect(lines.find((l) => l.accountId === ACC.rev)!.credit).toBe(100);
    expect(lines.find((l) => l.accountId === ACC.vat)!.credit).toBe(5);
    expect(lines).toHaveLength(3);
  });

  it('adds COGS and inventory lines for stock invoices and stays balanced', () => {
    const lines = buildInvoiceJournalLines({
      arAccount: ACC.ar, revenueAccount: ACC.rev, vatAccount: ACC.vat, cogsAccount: ACC.cogs, inventoryAccount: ACC.inv,
      netAmount: 200, taxAmount: 10, totalAmount: 210, cogsTotal: 120,
    });
    expect(journalIsBalanced(lines)).toBe(true);
    // Dr: AR 210 + COGS 120 = 330 ; Cr: REV 200 + VAT 10 + INV 120 = 330
    expect(lines.reduce((s, l) => s + l.debit, 0)).toBe(330);
    expect(lines.reduce((s, l) => s + l.credit, 0)).toBe(330);
    expect(lines.find((l) => l.accountId === ACC.cogs)!.debit).toBe(120);
    expect(lines.find((l) => l.accountId === ACC.inv)!.credit).toBe(120);
    expect(lines).toHaveLength(5);
  });

  it('omits the VAT line when there is no tax', () => {
    const lines = buildInvoiceJournalLines({
      arAccount: ACC.ar, revenueAccount: ACC.rev, vatAccount: ACC.vat, cogsAccount: null, inventoryAccount: null,
      netAmount: 100, taxAmount: 0, totalAmount: 100, cogsTotal: 0,
    });
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.accountId === ACC.vat)).toBe(false);
    expect(journalIsBalanced(lines)).toBe(true);
  });

  it('omits COGS lines when cogsTotal is zero', () => {
    const lines = buildInvoiceJournalLines({
      arAccount: ACC.ar, revenueAccount: ACC.rev, vatAccount: ACC.vat, cogsAccount: ACC.cogs, inventoryAccount: ACC.inv,
      netAmount: 100, taxAmount: 5, totalAmount: 105, cogsTotal: 0,
    });
    expect(lines.some((l) => l.accountId === ACC.cogs)).toBe(false);
    expect(lines).toHaveLength(3);
  });
});

describe('reverseJournalLines', () => {
  it('swaps debits and credits and remains balanced', () => {
    const lines = buildInvoiceJournalLines({
      arAccount: ACC.ar, revenueAccount: ACC.rev, vatAccount: ACC.vat, cogsAccount: ACC.cogs, inventoryAccount: ACC.inv,
      netAmount: 200, taxAmount: 10, totalAmount: 210, cogsTotal: 120,
    });
    const rev = reverseJournalLines(lines);
    expect(journalIsBalanced(rev)).toBe(true);
    // AR was debit 210 -> now credit 210
    expect(rev.find((l) => l.accountId === ACC.ar)!.credit).toBe(210);
    expect(rev.find((l) => l.accountId === ACC.rev)!.debit).toBe(200);
    // sum of original + reversal nets to zero per account
    const net: Record<string, number> = {};
    [...lines, ...rev].forEach((l) => { net[l.accountId] = (net[l.accountId] ?? 0) + l.debit - l.credit; });
    Object.values(net).forEach((v) => expect(v).toBe(0));
  });
});
