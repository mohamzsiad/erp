import { ageingBucket, buildAgeing, conversionRate } from '../services/sales/SalesReportService';

describe('ageingBucket', () => {
  it('classifies days-overdue into buckets', () => {
    expect(ageingBucket(-5)).toBe('current');
    expect(ageingBucket(0)).toBe('current');
    expect(ageingBucket(15)).toBe('d30');
    expect(ageingBucket(45)).toBe('d60');
    expect(ageingBucket(75)).toBe('d90');
    expect(ageingBucket(120)).toBe('over90');
  });
});

describe('buildAgeing', () => {
  const asOf = new Date('2026-03-31');
  it('buckets outstanding balances per customer', () => {
    const rows = buildAgeing([
      { customerId: 'C1', customerName: 'Acme', totalAmount: 100, paidAmount: 0, dueDate: new Date('2026-03-25') },  // 6 days -> d30
      { customerId: 'C1', customerName: 'Acme', totalAmount: 200, paidAmount: 50, dueDate: new Date('2026-01-01') }, // ~89 days -> d90, bal 150
      { customerId: 'C2', customerName: 'Beta', totalAmount: 300, paidAmount: 300, dueDate: new Date('2026-01-01') }, // settled -> skip
    ], asOf);
    const acme = rows.find((r) => r.entityId === 'C1')!;
    expect(acme.d30).toBe(100);
    expect(acme.d90).toBe(150);
    expect(acme.total).toBe(250);
    expect(rows.find((r) => r.entityId === 'C2')).toBeUndefined();
  });

  it('treats not-yet-due invoices as current', () => {
    const rows = buildAgeing([{ customerId: 'C1', customerName: 'Acme', totalAmount: 100, paidAmount: 0, dueDate: new Date('2026-04-30') }], asOf);
    expect(rows[0].current).toBe(100);
    expect(rows[0].total).toBe(100);
  });
});

describe('conversionRate', () => {
  it('computes won / total as a percentage', () => {
    expect(conversionRate(3, 12)).toBe(25);
  });
  it('is 0 when there are no quotations', () => {
    expect(conversionRate(0, 0)).toBe(0);
  });
});
