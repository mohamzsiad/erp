import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Financial reporting — Trial Balance, P&L, Balance Sheet, Aging
 *
 * All queries use a single SQL CTE per report (no N+1 patterns).
 * Amounts are summed from JournalLine (posted journals only).
 */
export class ReportService {
  constructor(private prisma: PrismaClient) {}

  // ── Trial Balance ─────────────────────────────────────────────────────────
  /**
   * Single-query CTE that returns opening + movement + closing for every leaf
   * GL account.
   *
   * opening = all posted journal lines BEFORE dateFrom
   * movement = posted journal lines between dateFrom and dateTo (inclusive)
   * closing  = computed in JS: net opening ± net movement
   */
  async trialBalance(companyId: string, params: {
    dateFrom?: string;
    dateTo?: string;
    includeZero?: boolean;
  }) {
    const { dateFrom, dateTo, includeZero = false } = params;

    // Build conditional date filters as Prisma.sql fragments
    const openingDateFilter = dateFrom
      ? Prisma.sql`AND je."entryDate" < ${new Date(dateFrom)}::date`
      : Prisma.sql``;

    const movFromFilter = dateFrom
      ? Prisma.sql`AND je."entryDate" >= ${new Date(dateFrom)}::date`
      : Prisma.sql``;

    const movToFilter = dateTo
      ? Prisma.sql`AND je."entryDate" <= ${new Date(dateTo)}::date`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<any[]>`
      WITH opening AS (
        SELECT  jl."accountId",
                SUM(jl.debit)  AS open_dr,
                SUM(jl.credit) AS open_cr
        FROM    journal_lines    jl
        JOIN    journal_entries  je ON je.id = jl."journalId"
        WHERE   je."companyId" = ${companyId}
          AND   je.status     = 'POSTED'
          ${openingDateFilter}
        GROUP BY jl."accountId"
      ),
      movement AS (
        SELECT  jl."accountId",
                SUM(jl.debit)  AS mov_dr,
                SUM(jl.credit) AS mov_cr
        FROM    journal_lines    jl
        JOIN    journal_entries  je ON je.id = jl."journalId"
        WHERE   je."companyId" = ${companyId}
          AND   je.status     = 'POSTED'
          ${movFromFilter}
          ${movToFilter}
        GROUP BY jl."accountId"
      )
      SELECT
        ga.id           AS account_id,
        ga.code         AS account_code,
        ga.name         AS account_name,
        ga."accountType",
        COALESCE(o.open_dr, 0)::float AS open_dr,
        COALESCE(o.open_cr, 0)::float AS open_cr,
        COALESCE(m.mov_dr,  0)::float AS mov_dr,
        COALESCE(m.mov_cr,  0)::float AS mov_cr
      FROM gl_accounts ga
      LEFT JOIN opening  o ON o."accountId" = ga.id
      LEFT JOIN movement m ON m."accountId" = ga.id
      WHERE ga."companyId" = ${companyId}
        AND ga."isActive"  = true
        AND NOT EXISTS (
          SELECT 1 FROM gl_accounts c
          WHERE c."parentId" = ga.id AND c."isActive" = true
        )
      ORDER BY ga.code
    `;

    // Compute closing balance in JS
    const lines = rows.map((r) => {
      const openDr = Number(r.open_dr);
      const openCr = Number(r.open_cr);
      const movDr  = Number(r.mov_dr);
      const movCr  = Number(r.mov_cr);
      const net    = (openDr - openCr) + (movDr - movCr);
      return {
        accountId:   r.account_id,
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: r.accountType,
        openDr,
        openCr,
        movDr,
        movCr,
        closDr: net > 0 ?  net : 0,
        closCr: net < 0 ? -net : 0,
      };
    });

    const active = includeZero
      ? lines
      : lines.filter((l) => l.openDr || l.openCr || l.movDr || l.movCr);

    const totals = (rows: typeof active) => ({
      openDr: rows.reduce((s, l) => s + l.openDr, 0),
      openCr: rows.reduce((s, l) => s + l.openCr, 0),
      movDr:  rows.reduce((s, l) => s + l.movDr,  0),
      movCr:  rows.reduce((s, l) => s + l.movCr,  0),
      closDr: rows.reduce((s, l) => s + l.closDr, 0),
      closCr: rows.reduce((s, l) => s + l.closCr, 0),
    });

    return {
      dateFrom: dateFrom ?? null,
      dateTo:   dateTo   ?? null,
      lines:    active,
      totals:   totals(active),
    };
  }

  // ── Profit & Loss ─────────────────────────────────────────────────────────
  /**
   * Single-query CTE returning period + YTD + prior-year-YTD movements for
   * all REVENUE and EXPENSE leaf accounts.
   *
   * ytdFrom       = Jan 1 of dateFrom's year   (auto-computed)
   * priorYtdFrom  = Jan 1 of prior year         (auto-computed)
   * priorYtdTo    = dateTo - 1 year              (auto-computed)
   */
  async profitAndLoss(companyId: string, params: {
    dateFrom: string;
    dateTo:   string;
    costCenterId?: string;
  }) {
    const { dateFrom, dateTo, costCenterId } = params;

    const dtFrom  = new Date(dateFrom);
    const dtTo    = new Date(dateTo);
    const ytdFrom = new Date(dtFrom.getFullYear(), 0, 1);          // Jan 1 same year
    const pyFrom  = new Date(dtFrom.getFullYear() - 1, 0, 1);     // Jan 1 prior year
    const pyTo    = new Date(dtTo.getFullYear() - 1, dtTo.getMonth(), dtTo.getDate());

    const ccFilter   = costCenterId ? Prisma.sql`AND jl."costCenterId" = ${costCenterId}` : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<any[]>`
      WITH period_mv AS (
        SELECT  jl."accountId",
                SUM(jl.debit)  AS dr,
                SUM(jl.credit) AS cr
        FROM    journal_lines   jl
        JOIN    journal_entries je ON je.id = jl."journalId"
        WHERE   je."companyId" = ${companyId}
          AND   je.status     = 'POSTED'
          AND   je."entryDate" >= ${dtFrom}::date
          AND   je."entryDate" <= ${dtTo}::date
          ${ccFilter}
        GROUP BY jl."accountId"
      ),
      ytd_mv AS (
        SELECT  jl."accountId",
                SUM(jl.debit)  AS dr,
                SUM(jl.credit) AS cr
        FROM    journal_lines   jl
        JOIN    journal_entries je ON je.id = jl."journalId"
        WHERE   je."companyId" = ${companyId}
          AND   je.status     = 'POSTED'
          AND   je."entryDate" >= ${ytdFrom}::date
          AND   je."entryDate" <= ${dtTo}::date
          ${ccFilter}
        GROUP BY jl."accountId"
      ),
      prior_ytd_mv AS (
        SELECT  jl."accountId",
                SUM(jl.debit)  AS dr,
                SUM(jl.credit) AS cr
        FROM    journal_lines   jl
        JOIN    journal_entries je ON je.id = jl."journalId"
        WHERE   je."companyId" = ${companyId}
          AND   je.status     = 'POSTED'
          AND   je."entryDate" >= ${pyFrom}::date
          AND   je."entryDate" <= ${pyTo}::date
          ${ccFilter}
        GROUP BY jl."accountId"
      )
      SELECT
        ga.id           AS account_id,
        ga.code         AS account_code,
        ga.name         AS account_name,
        ga."accountType",
        COALESCE(p.dr,  0)::float AS period_dr,
        COALESCE(p.cr,  0)::float AS period_cr,
        COALESCE(y.dr,  0)::float AS ytd_dr,
        COALESCE(y.cr,  0)::float AS ytd_cr,
        COALESCE(py.dr, 0)::float AS prior_ytd_dr,
        COALESCE(py.cr, 0)::float AS prior_ytd_cr
      FROM gl_accounts ga
      LEFT JOIN period_mv    p  ON p."accountId"  = ga.id
      LEFT JOIN ytd_mv       y  ON y."accountId"  = ga.id
      LEFT JOIN prior_ytd_mv py ON py."accountId" = ga.id
      WHERE ga."companyId"  = ${companyId}
        AND ga."isActive"   = true
        AND ga."accountType" IN ('REVENUE', 'EXPENSE')
        AND NOT EXISTS (
          SELECT 1 FROM gl_accounts c
          WHERE c."parentId" = ga.id AND c."isActive" = true
        )
      ORDER BY ga.code
    `;

    const mapped = rows.map((r) => {
      const type = r.accountType as 'REVENUE' | 'EXPENSE';
      // Revenue: credit-normal; Expense: debit-normal
      const sign = (dr: number, cr: number) =>
        type === 'REVENUE' ? cr - dr : dr - cr;

      const periodAmt   = sign(Number(r.period_dr),    Number(r.period_cr));
      const ytdAmt      = sign(Number(r.ytd_dr),       Number(r.ytd_cr));
      const priorYtdAmt = sign(Number(r.prior_ytd_dr), Number(r.prior_ytd_cr));

      return {
        accountId:   r.account_id,
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: type,
        periodAmt,
        ytdAmt,
        priorYtdAmt,
        variance: ytdAmt - priorYtdAmt,
      };
    });

    const revenue = mapped.filter((r) => r.accountType === 'REVENUE' && (r.periodAmt || r.ytdAmt));
    const expense = mapped.filter((r) => r.accountType === 'EXPENSE' && (r.periodAmt || r.ytdAmt));

    const sum = (arr: typeof mapped, key: keyof (typeof mapped)[0]) =>
      arr.reduce((s, r) => s + (r[key] as number), 0);

    return {
      dateFrom,
      dateTo,
      revenueLines:   revenue,
      expenseLines:   expense,
      totalRevenuePeriod:   sum(revenue, 'periodAmt'),
      totalRevenueYtd:      sum(revenue, 'ytdAmt'),
      totalRevenuePriorYtd: sum(revenue, 'priorYtdAmt'),
      totalExpensePeriod:   sum(expense, 'periodAmt'),
      totalExpenseYtd:      sum(expense, 'ytdAmt'),
      totalExpensePriorYtd: sum(expense, 'priorYtdAmt'),
      netProfitPeriod:      sum(revenue, 'periodAmt') - sum(expense, 'periodAmt'),
      netProfitYtd:         sum(revenue, 'ytdAmt')    - sum(expense, 'ytdAmt'),
      netProfitPriorYtd:    sum(revenue, 'priorYtdAmt') - sum(expense, 'priorYtdAmt'),
    };
  }

  // ── Balance Sheet ─────────────────────────────────────────────────────────
  /**
   * Single CTE: cumulative debit/credit per leaf ASSET, LIABILITY, EQUITY
   * account up to and including asAt.
   */
  async balanceSheet(companyId: string, params: { asAt: string }) {
    const asAt = new Date(params.asAt);

    const rows = await this.prisma.$queryRaw<any[]>`
      WITH balances AS (
        SELECT  jl."accountId",
                SUM(jl.debit)  AS total_dr,
                SUM(jl.credit) AS total_cr
        FROM    journal_lines   jl
        JOIN    journal_entries je ON je.id = jl."journalId"
        WHERE   je."companyId" = ${companyId}
          AND   je.status     = 'POSTED'
          AND   je."entryDate" <= ${asAt}::date
        GROUP BY jl."accountId"
      )
      SELECT
        ga.id           AS account_id,
        ga.code         AS account_code,
        ga.name         AS account_name,
        ga."accountType",
        COALESCE(b.total_dr, 0)::float AS total_dr,
        COALESCE(b.total_cr, 0)::float AS total_cr
      FROM gl_accounts ga
      LEFT JOIN balances b ON b."accountId" = ga.id
      WHERE ga."companyId"  = ${companyId}
        AND ga."isActive"   = true
        AND ga."accountType" IN ('ASSET', 'LIABILITY', 'EQUITY')
        AND NOT EXISTS (
          SELECT 1 FROM gl_accounts c
          WHERE c."parentId" = ga.id AND c."isActive" = true
        )
      ORDER BY ga."accountType", ga.code
    `;

    const mapped = rows.map((r) => {
      const dr  = Number(r.total_dr);
      const cr  = Number(r.total_cr);
      // Asset: debit-normal; Liability/Equity: credit-normal
      const bal = r.accountType === 'ASSET' ? dr - cr : cr - dr;
      return {
        accountId:   r.account_id,
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: r.accountType as 'ASSET' | 'LIABILITY' | 'EQUITY',
        balance: bal,
      };
    });

    const nonZero        = mapped.filter((r) => r.balance !== 0);
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
    supplierId?: string;
    asAt?: string;
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
          supplierId:   s.id,
          supplierCode: s.code,
          supplierName: s.name,
          current:   0, days0_30:  0, days31_60: 0,
          days61_90: 0, over90:    0, total: 0,
          invoices: [],
        });
      }
      const row = supplierMap.get(s.id);
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000
      );

      row.total += outstanding;
      if (daysOverdue <= 0)       row.current   += outstanding;
      else if (daysOverdue <= 30) row.days0_30  += outstanding;
      else if (daysOverdue <= 60) row.days31_60 += outstanding;
      else if (daysOverdue <= 90) row.days61_90 += outstanding;
      else                        row.over90    += outstanding;

      row.invoices.push({
        id:              inv.id,
        docNo:           inv.docNo,
        invoiceDate:     inv.invoiceDate,
        dueDate:         inv.dueDate,
        totalAmount:     Number(inv.totalAmount),
        paidAmount:      Number(inv.paidAmount),
        outstanding,
        daysOverdue,
      });
    }

    const lines = Array.from(supplierMap.values())
      .filter((r) => r.total > 0)
      .sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));

    return {
      asAt:       today.toISOString().split('T')[0],
      lines,
      grandTotal: lines.reduce((s, l) => s + l.total, 0),
    };
  }

  // ── Customer Aging (AR) ───────────────────────────────────────────────────
  async customerAging(companyId: string, params: {
    customerId?: string;
    asAt?: string;
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
          customerId:   c.id,
          customerCode: c.code,
          customerName: c.name,
          current:   0, days0_30:  0, days31_60: 0,
          days61_90: 0, over90:    0, total: 0,
          invoices: [],
        });
      }
      const row = customerMap.get(c.id);
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000
      );

      row.total += outstanding;
      if (daysOverdue <= 0)       row.current   += outstanding;
      else if (daysOverdue <= 30) row.days0_30  += outstanding;
      else if (daysOverdue <= 60) row.days31_60 += outstanding;
      else if (daysOverdue <= 90) row.days61_90 += outstanding;
      else                        row.over90    += outstanding;

      row.invoices.push({
        id:          inv.id,
        docNo:       inv.docNo,
        invoiceDate: inv.invoiceDate,
        dueDate:     inv.dueDate,
        totalAmount: Number(inv.totalAmount),
        paidAmount:  Number(inv.paidAmount),
        outstanding,
        daysOverdue,
      });
    }

    const lines = Array.from(customerMap.values())
      .filter((r) => r.total > 0)
      .sort((a, b) => a.customerCode.localeCompare(b.customerCode));

    return {
      asAt:       today.toISOString().split('T')[0],
      lines,
      grandTotal: lines.reduce((s, l) => s + l.total, 0),
    };
  }
}
