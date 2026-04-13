import { PrismaClient, Prisma } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';

// ── Custom errors ─────────────────────────────────────────────────────────────
export class UnbalancedJournalError extends Error {
  statusCode = 422;
  constructor(totalDebit: number, totalCredit: number) {
    super(
      `Journal is unbalanced: debits=${totalDebit.toFixed(3)}, credits=${totalCredit.toFixed(3)}, ` +
      `difference=${Math.abs(totalDebit - totalCredit).toFixed(3)}`
    );
    this.name = 'UnbalancedJournalError';
  }
}

export class ClosedPeriodError extends Error {
  statusCode = 422;
  constructor(year: number, month: number) {
    super(`Period ${year}-${String(month).padStart(2, '0')} is closed. Cannot post journal entries.`);
    this.name = 'ClosedPeriodError';
  }
}

export class InactiveAccountError extends Error {
  statusCode = 422;
  constructor(code: string) {
    super(`Account ${code} is inactive or is a group account. Cannot post to it.`);
    this.name = 'InactiveAccountError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PostJournalParams {
  companyId: string;
  entryDate: Date;
  description: string;
  lines: Array<{
    accountId: string;
    costCenterId?: string;
    debit: number;
    credit: number;
    currencyId?: string;
    fxRate?: number;
    description?: string;
  }>;
  sourceModule?: string;
  sourceDocId?: string;
  userId: string;
}

const BALANCE_TOLERANCE = 0.001;

export class JournalService {
  constructor(private prisma: PrismaClient) {}

  // ── Post Journal ───────────────────────────────────────────────────────────
  async postJournal(params: PostJournalParams, tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) {
    const db = (tx ?? this.prisma) as PrismaClient;

    // 1. Validate debit = credit
    const totalDebit  = params.lines.reduce((s, l) => s + (l.debit  ?? 0), 0);
    const totalCredit = params.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
      throw new UnbalancedJournalError(totalDebit, totalCredit);
    }

    // 2. Check period is open
    const entryDate = new Date(params.entryDate);
    const periodYear  = entryDate.getFullYear();
    const periodMonth = entryDate.getMonth() + 1;

    const closed = await db.periodClose.findFirst({
      where: {
        companyId:   params.companyId,
        periodYear,
        periodMonth,
        reopenedAt:  null,
      },
    });
    if (closed) throw new ClosedPeriodError(periodYear, periodMonth);

    // 3. Validate accounts — must be active and leaf (no children)
    const accountIds = [...new Set(params.lines.map((l) => l.accountId))];
    const accounts = await db.glAccount.findMany({
      where: { id: { in: accountIds }, companyId: params.companyId },
      include: { _count: { select: { children: true } } },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    for (const line of params.lines) {
      const acc = accountMap.get(line.accountId);
      if (!acc) throw Object.assign(new Error(`Account not found: ${line.accountId}`), { statusCode: 404 });
      if (!acc.isActive) throw new InactiveAccountError(acc.code);
      if ((acc as any)._count.children > 0) throw new InactiveAccountError(`${acc.code} (group account)`);
    }

    // 4. Auto-generate docNo
    const docNo = await getNextDocNo(db as any, params.companyId, 'FINANCE', 'JE');

    // 5. Create journal entry
    const journal = await db.journalEntry.create({
      data: {
        companyId:    params.companyId,
        docNo,
        entryDate:    params.entryDate,
        description:  params.description,
        status:       'POSTED',
        sourceModule: params.sourceModule ?? null,
        sourceDocId:  params.sourceDocId  ?? null,
        postedAt:     new Date(),
        createdById:  params.userId,
        lines: {
          create: params.lines.map((l, i) => ({
            accountId:   l.accountId,
            costCenterId: l.costCenterId ?? null,
            debit:       l.debit,
            credit:      l.credit,
            currencyId:  l.currencyId  ?? null,
            fxRate:      l.fxRate      ?? 1,
            description: l.description ?? null,
            lineNo:      i + 1,
          })),
        },
      },
      include: { lines: true },
    });

    // 6. Update budget actuals for each line
    await this.updateBudgetActuals(db as any, params.companyId, entryDate, params.lines);

    return journal;
  }

  // ── Reverse Journal ────────────────────────────────────────────────────────
  async reverseJournal(journalId: string, companyId: string, userId: string, entryDate?: Date) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, companyId },
      include: { lines: true },
    });
    if (!original) throw Object.assign(new Error('Journal not found'), { statusCode: 404 });
    if (original.status !== 'POSTED') throw Object.assign(new Error('Only POSTED journals can be reversed'), { statusCode: 422 });

    const reversal = await this.postJournal({
      companyId,
      entryDate: entryDate ?? new Date(),
      description: `REVERSAL: ${original.description}`,
      lines: original.lines.map((l) => ({
        accountId:    l.accountId,
        costCenterId: l.costCenterId ?? undefined,
        debit:        Number(l.credit),
        credit:       Number(l.debit),
        description:  `Reversal of ${original.docNo}`,
      })),
      sourceModule: original.sourceModule ?? undefined,
      sourceDocId:  original.sourceDocId  ?? undefined,
      userId,
    });

    // Mark original as reversed
    await this.prisma.journalEntry.update({
      where: { id: journalId },
      data: { status: 'REVERSED', reversedById: reversal.id },
    });

    return reversal;
  }

  // ── List Journals ──────────────────────────────────────────────────────────
  async list(companyId: string, params: {
    status?: string; dateFrom?: string; dateTo?: string;
    sourceModule?: string; search?: string; page?: number; limit?: number;
  }) {
    const { status, dateFrom, dateTo, sourceModule, search, page = 1, limit = 50 } = params;
    const where: any = { companyId };
    if (status) where.status = status;
    if (sourceModule) where.sourceModule = sourceModule;
    if (search) where.docNo = { contains: search, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.entryDate = {};
      if (dateFrom) where.entryDate.gte = new Date(dateFrom);
      if (dateTo)   where.entryDate.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true } },
              costCenter: { select: { code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    // Compute totals per journal
    const enriched = items.map((j) => ({
      ...j,
      totalDebit:  j.lines.reduce((s, l) => s + Number(l.debit),  0),
      totalCredit: j.lines.reduce((s, l) => s + Number(l.credit), 0),
    }));

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, companyId: string) {
    const j = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true, accountType: true } },
            costCenter: { select: { code: true, name: true } },
          },
          orderBy: { lineNo: 'asc' },
        },
      },
    });
    if (!j) throw Object.assign(new Error('Journal not found'), { statusCode: 404 });
    return {
      ...j,
      totalDebit:  j.lines.reduce((s, l) => s + Number(l.debit),  0),
      totalCredit: j.lines.reduce((s, l) => s + Number(l.credit), 0),
    };
  }

  // ── Internal: update budget actuals ───────────────────────────────────────
  private async updateBudgetActuals(
    db: PrismaClient,
    companyId: string,
    entryDate: Date,
    lines: PostJournalParams['lines']
  ) {
    const periodYear  = entryDate.getFullYear();
    const periodMonth = entryDate.getMonth() + 1;

    for (const line of lines) {
      const netAmount = (line.debit ?? 0) - (line.credit ?? 0);
      if (netAmount === 0) continue;

      // Find all budgets for this account (+/- cost center)
      const budgets = await db.budget.findMany({
        where: { companyId, accountId: line.accountId },
      });

      for (const budget of budgets) {
        await db.budgetPeriod.updateMany({
          where: { budgetId: budget.id, periodYear, periodMonth },
          data: { actualAmount: { increment: Math.abs(netAmount) } },
        });
      }
    }
  }
}
