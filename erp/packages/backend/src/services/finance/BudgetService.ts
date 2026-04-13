import { PrismaClient } from '@prisma/client';

export class BudgetService {
  constructor(private prisma: PrismaClient) {}

  // ── Create annual budget ───────────────────────────────────────────────────
  async create(companyId: string, data: {
    fiscalYear: number; accountId: string; costCenterId?: string; annualAmount: number;
  }) {
    const account = await this.prisma.glAccount.findFirst({ where: { id: data.accountId, companyId } });
    if (!account) throw Object.assign(new Error('GL Account not found'), { statusCode: 404 });

    return this.prisma.budget.upsert({
      where: {
        companyId_fiscalYear_accountId_costCenterId: {
          companyId,
          fiscalYear:   data.fiscalYear,
          accountId:    data.accountId,
          costCenterId: data.costCenterId ?? null,
        },
      },
      create: {
        companyId,
        fiscalYear:   data.fiscalYear,
        accountId:    data.accountId,
        costCenterId: data.costCenterId ?? null,
        annualAmount: data.annualAmount,
      },
      update: { annualAmount: data.annualAmount },
      include: { periods: { orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }] } },
    });
  }

  // ── Distribute to months ───────────────────────────────────────────────────
  async phaseDistribution(budgetId: string, companyId: string, data: {
    method: 'EQUAL' | 'MANUAL';
    amounts?: Record<string, number>; // key: "YYYY-M" -> amount
  }) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, companyId },
      include: { periods: true },
    });
    if (!budget) throw Object.assign(new Error('Budget not found'), { statusCode: 404 });

    const annual = Number(budget.annualAmount);

    // Delete existing periods
    await this.prisma.budgetPeriod.deleteMany({ where: { budgetId } });

    const periods: { periodYear: number; periodMonth: number; budgetedAmount: number }[] = [];

    if (data.method === 'EQUAL') {
      const monthlyAmt = annual / 12;
      for (let m = 1; m <= 12; m++) {
        periods.push({ periodYear: budget.fiscalYear, periodMonth: m, budgetedAmount: Number(monthlyAmt.toFixed(3)) });
      }
    } else {
      // Manual — validate all 12 months provided
      if (!data.amounts) throw Object.assign(new Error('amounts required for MANUAL method'), { statusCode: 400 });
      let totalManual = 0;
      for (let m = 1; m <= 12; m++) {
        const key = `${budget.fiscalYear}-${m}`;
        const amt = data.amounts[key] ?? 0;
        totalManual += amt;
        periods.push({ periodYear: budget.fiscalYear, periodMonth: m, budgetedAmount: amt });
      }
      if (Math.abs(totalManual - annual) > 1) {
        throw Object.assign(
          new Error(`Manual amounts (${totalManual.toFixed(3)}) don't match annual budget (${annual.toFixed(3)})`),
          { statusCode: 422 }
        );
      }
    }

    await this.prisma.budgetPeriod.createMany({
      data: periods.map((p) => ({ budgetId, ...p, actualAmount: 0 })),
    });

    return this.prisma.budget.findUnique({
      where: { id: budgetId },
      include: { periods: { orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }] } },
    });
  }

  // ── Budget vs Actual ───────────────────────────────────────────────────────
  async vsActual(companyId: string, params: {
    fiscalYear: number; periodFrom?: number; periodTo?: number; costCenterId?: string;
  }) {
    const { fiscalYear, periodFrom = 1, periodTo = 12, costCenterId } = params;

    const budgetWhere: any = { companyId, fiscalYear };
    if (costCenterId) budgetWhere.costCenterId = costCenterId;

    const budgets = await this.prisma.budget.findMany({
      where: budgetWhere,
      include: {
        account: { select: { code: true, name: true, accountType: true } },
        costCenter: { select: { code: true, name: true } },
        periods: {
          where: {
            periodYear: fiscalYear,
            periodMonth: { gte: periodFrom, lte: periodTo },
          },
        },
      },
    });

    return budgets.map((b) => {
      const ytdBudget = b.periods.reduce((s, p) => s + Number(p.budgetedAmount), 0);
      const ytdActual = b.periods.reduce((s, p) => s + Number(p.actualAmount),  0);
      const variance  = ytdBudget - ytdActual;
      return {
        budgetId:       b.id,
        accountId:      b.accountId,
        accountCode:    (b as any).account.code,
        accountName:    (b as any).account.name,
        accountType:    (b as any).account.accountType,
        costCenterId:   b.costCenterId,
        costCenterCode: (b as any).costCenter?.code ?? null,
        costCenterName: (b as any).costCenter?.name ?? null,
        annualBudget:   Number(b.annualAmount),
        ytdBudget,
        ytdActual,
        variance,
        variancePct: ytdBudget !== 0 ? (variance / ytdBudget) * 100 : 0,
      };
    });
  }

  // ── Check budget (used by procurement before raising PO) ──────────────────
  async check(companyId: string, data: {
    accountId: string; costCenterId?: string; amount: number;
    periodYear?: number; periodMonth?: number;
  }) {
    const now = new Date();
    const year  = data.periodYear  ?? now.getFullYear();
    const month = data.periodMonth ?? (now.getMonth() + 1);

    const budgetPeriod = await this.prisma.budgetPeriod.findFirst({
      where: {
        periodYear: year,
        periodMonth: month,
        budget: {
          companyId,
          accountId: data.accountId,
          costCenterId: data.costCenterId ?? null,
        },
      },
    });

    if (!budgetPeriod) {
      return { hasBudget: false, budgeted: 0, actual: 0, available: 0, willExceed: false };
    }

    const budgeted  = Number(budgetPeriod.budgetedAmount);
    const actual    = Number(budgetPeriod.actualAmount);
    const available = budgeted - actual;
    return {
      hasBudget:   true,
      budgeted,
      actual,
      available,
      requested:   data.amount,
      willExceed:  data.amount > available,
      overAmount:  Math.max(0, data.amount - available),
    };
  }

  // ── List budgets ──────────────────────────────────────────────────────────
  async list(companyId: string, params: { fiscalYear?: number; accountId?: string; costCenterId?: string }) {
    const where: any = { companyId };
    if (params.fiscalYear)   where.fiscalYear   = params.fiscalYear;
    if (params.accountId)    where.accountId    = params.accountId;
    if (params.costCenterId) where.costCenterId = params.costCenterId;

    return this.prisma.budget.findMany({
      where,
      orderBy: [{ fiscalYear: 'desc' }, { accountId: 'asc' }],
      include: {
        account: { select: { code: true, name: true } },
        costCenter: { select: { code: true, name: true } },
        periods: { orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }] },
      },
    });
  }
}
