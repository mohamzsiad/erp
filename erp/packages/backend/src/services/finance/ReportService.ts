import { PrismaClient } from '@prisma/client';

/**
 * Financial reporting — Trial Balance, P&L, Balance Sheet, Aging
 * All amounts are summed from JournalLine (posted journals only).
 */
export class ReportService {
  constructor(private prisma: PrismaClient) {}

  // ── Trial Balance ─────────────────────────────────────────────────────────
  async trialBalance(companyId: string, params: {
    dateFrom?: string; dateTo?: string; accountType?: string;
  }) {
    const { dateFrom, dateTo, accountType } = params;

    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo)   dateFilter.lte = new Date(dateTo);

    // Get all leaf GL accounts with their summed debits/credits
    const accounts = await this.prisma.glAccount.findMany({
      where: {
        companyId,
        isActive: true,
        ...(accountType && { accountType }),
        // Leaf accounts only (no children)
        children: { none: {} },
      },
      orderBy: { code: 'asc' },
    });

    const lines = await Promise.all(
      accounts.map(async (acc) => {
        const agg = await this.prisma.journalLine.aggregate({
          where: {
            accountId: acc.id,
            journal: {
              companyId,
              status: 'POSTED',
              ...(Object.keys(dateFilter).length && { entryDate: dateFilter }),
            },
          },
          _sum: { debit: true, credit: true },
        });
        const totalDebit  = Number(agg._sum.debit  ?? 0);
        const totalCredit = Number(agg._sum.credit ?? 0);
        const netDebit    = totalDebit  - totalCredit;
        const netCredit   = totalCredit - totalDebit;

        return {
          accountId:    acc.id,
          accountCode:  acc.code,
          accountName:  acc.name,
          accountType:  acc.accountType,
          totalDebit,
          totalCredit,
          netDebit:  netDebit  > 0 ? netDebit  : 0,
          netCredit: netCredit > 0 ? netCredit : 0,
        };
      })
    );

    // Filter out zero-balance accounts (optional: caller can request all)
    const nonZero = lines.filter((l) => l.totalDebit !== 0 || l.totalCredit !== 0);

    const grandDebit  = nonZero.reduce((s, l) => s + l.netDebit,  0);
    const grandCredit = nonZero.reduce((s, l) => s + l.netCredit, 0);

    return { lines: nonZero, grandDebit, grandCredit };
  }

  // ── Profit & Loss ─────────────────────────────────────────────────────────
  async profitAndLoss(companyId: string, params: {
    dateFrom: string; dateTo: string; costCenterId?: string;
  }) {
    const { dateFrom, dateTo, costCenterId } = params;

    const lineWhere: any = {
      journal: {
        companyId,
        status:    'POSTED',
        entryDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      },
      ...(costCenterId && { costCenterId }),
    };

    // Fetch REVENUE and EXPENSE accounts
    const accounts = await this.prisma.glAccount.findMany({
      where: {
        companyId,
        isActive: true,
        accountType: { in: ['REVENUE', 'EXPENSE'] },
        children: { none: {} },
      },
      orderBy: { code: 'asc' },
    });

    const rows = await Promise.all(
      accounts.map(async (acc) => {
        const agg = await this.prisma.journalLine.aggregate({
          where: { ...lineWhere, accountId: acc.id },
          _sum: { debit: true, credit: true },
        });
        const debit  = Number(agg._sum.debit  ?? 0);
        const credit = Number(agg._sum.credit ?? 0);
        // Revenue: credit-normal (credit > debit => positive revenue)
        // Expense: debit-normal
        const amount = acc.accountType === 'REVENUE' ? credit - debit : debit - credit;
        return { accountId: acc.id, accountCode: acc.code, accountName: acc.name, accountType: acc.accountType, amount };
      })
    );

    const revenueLines = rows.filter((r) => r.accountType === 'REVENUE' && (r.amount !== 0));
    const expenseLines = rows.filter((r) => r.accountType === 'EXPENSE' && (r.amount !== 0));

    const totalRevenue = revenueLines.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenseLines.reduce((s, r) => s + r.amount, 0);
    const netProfit    = totalRevenue - totalExpense;

    return {
      dateFrom,
      dateTo,
      revenueLines,
      expenseLines,
      totalRevenue,
      totalExpense,
      netProfit,
    };
  }

  // ── Balance Sheet ─────────────────────────────────────────────────────────
  async balanceSheet(companyId: string, params: { asAt: string }) {
    const asAt = new Date(params.asAt);

    const accounts = await this.prisma.glAccount.findMany({
      where: {
        companyId,
        isActive: true,
        accountType: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
        children: { none: {} },
      },
      orderBy: { code: 'asc' },
    });

    const rows = await Promise.all(
      accounts.map(async (acc) => {
        const agg = await this.prisma.journalLine.aggregate({
          where: {
            accountId: acc.id,
            journal: { companyId, status: 'POSTED', entryDate: { lte: asAt } },
          },
          _sum: { debit: true, credit: true },
        });
        const debit  = Number(agg._sum.debit  ?? 0);
        const credit = Number(agg._sum.credit ?? 0);
        // Asset: debit-normal; Liability/Equity: credit-normal
        const balance = acc.accountType === 'ASSET' ? debit - credit : credit - debit;
        return { accountId: acc.id, accountCode: acc.code, accountName: acc.name, accountType: acc.accountType, balance };
      })
    );

    const nonZero     = rows.filter((r) => r.balance !== 0);
    const assetLines     = nonZero.filter((r) => r.accountType === 'ASSET');
    const liabilityLines = nonZero.filter((r) => r.accountType === 'LIABILITY');
    const equityLines    = nonZero.filter((r) => r.accountType === 'EQUITY');

    const totalAssets      = assetLines.reduce((s, r)     => s + r.balance, 0);
    const totalLiabilities = liabilityLines.reduce((s, r) => s + r.balance, 0);
    const totalEquity      = equityLines.reduce((s, r)    => s + r.balance, 0);

    return {
      asAt: params.asAt,
      assetLines,
      liabilityLines,
      equityLines,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  // ── Supplier Aging (AP) ───────────────────────────────────────────────────
  async supplierAging(companyId: string, params: {
    supplierId?: string; asAt?: string;
  }) {
    const today = params.asAt ? new Date(params.asAt) : new Date();

    const where: any = {
      companyId,
      status: { in: ['APPROVED', 'PARTIAL'] },
    };
    if (params.supplierId) where.supplierId = params.supplierId;

    const invoices = await this.prisma.apInvoice.findMany({
      where,
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });

    // Group by supplier
    const supplierMap = new Map<string, any>();

    for (const inv of invoices) {
      const s = (inv as any).supplier;
      if (!supplierMap.has(s.id)) {
        supplierMap.set(s.id, {
          supplierId: s.id, supplierCode: s.code, supplierName: s.name,
          current: 0, days0_30: 0, days31_60: 0, days61_90: 0, over90: 0, total: 0,
        });
      }
      const row = supplierMap.get(s.id);
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      const daysOverdue  = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000);

      row.total += outstanding;
      if (daysOverdue <= 0)       row.current   += outstanding;
      else if (daysOverdue <= 30) row.days0_30  += outstanding;
      else if (daysOverdue <= 60) row.days31_60 += outstanding;
      else if (daysOverdue <= 90) row.days61_90 += outstanding;
      else                        row.over90    += outstanding;
    }

    const lines = Array.from(supplierMap.values())
      .sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));

    return {
      asAt: today.toISOString().split('T')[0],
      lines,
      grandTotal: lines.reduce((s, l) => s + l.total, 0),
    };
  }

  // ── Customer Aging (AR) ───────────────────────────────────────────────────
  async customerAging(companyId: string, params: {
    customerId?: string; asAt?: string;
  }) {
    const today = params.asAt ? new Date(params.asAt) : new Date();

    const where: any = {
      companyId,
      status: { in: ['POSTED', 'PARTIAL'] },
    };
    if (params.customerId) where.customerId = params.customerId;

    const invoices = await this.prisma.arInvoice.findMany({
      where,
      include: { customer: { select: { id: true, code: true, name: true } } },
    });

    const customerMap = new Map<string, any>();

    for (const inv of invoices) {
      const c = (inv as any).customer;
      if (!customerMap.has(c.id)) {
        customerMap.set(c.id, {
          customerId: c.id, customerCode: c.code, customerName: c.name,
          current: 0, days0_30: 0, days31_60: 0, days61_90: 0, over90: 0, total: 0,
        });
      }
      const row = customerMap.get(c.id);
      const outstanding  = Number(inv.totalAmount) - Number(inv.paidAmount);
      const daysOverdue  = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000);

      row.total += outstanding;
      if (daysOverdue <= 0)       row.current   += outstanding;
      else if (daysOverdue <= 30) row.days0_30  += outstanding;
      else if (daysOverdue <= 60) row.days31_60 += outstanding;
      else if (daysOverdue <= 90) row.days61_90 += outstanding;
      else                        row.over90    += outstanding;
    }

    const lines = Array.from(customerMap.values())
      .sort((a, b) => a.customerCode.localeCompare(b.customerCode));

    return {
      asAt: today.toISOString().split('T')[0],
      lines,
      grandTotal: lines.reduce((s, l) => s + l.total, 0),
    };
  }
}
