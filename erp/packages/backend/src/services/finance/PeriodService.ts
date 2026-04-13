import { PrismaClient } from '@prisma/client';

export class PeriodService {
  constructor(private prisma: PrismaClient) {}

  // ── List periods with status ───────────────────────────────────────────────
  // Returns the rolling 24 months centred on today
  async listPeriods(companyId: string) {
    const now = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const closes = await this.prisma.periodClose.findMany({ where: { companyId } });
    const closedMap = new Map(
      closes.map((c) => [`${c.periodYear}-${c.periodMonth}`, c])
    );

    const periods = [];
    // 12 months back, current, 12 months forward
    for (let offset = -12; offset <= 12; offset++) {
      let year  = currentYear;
      let month = currentMonth + offset;
      while (month < 1)  { month += 12; year--; }
      while (month > 12) { month -= 12; year++; }

      const key  = `${year}-${month}`;
      const close = closedMap.get(key);
      const isClosed = close && !close.reopenedAt;

      periods.push({
        year,
        month,
        label: `${year}-${String(month).padStart(2, '0')}`,
        status: isClosed ? 'CLOSED' : 'OPEN',
        closedAt:    close?.closedAt    ?? null,
        closedById:  close?.closedById  ?? null,
        reopenedAt:  close?.reopenedAt  ?? null,
      });
    }

    return periods.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }

  // ── Close period ──────────────────────────────────────────────────────────
  async closePeriod(companyId: string, periodYear: number, periodMonth: number, userId: string) {
    const existing = await this.prisma.periodClose.findFirst({
      where: { companyId, periodYear, periodMonth },
    });
    if (existing && !existing.reopenedAt) {
      throw Object.assign(
        new Error(`Period ${periodYear}-${String(periodMonth).padStart(2, '0')} is already closed`),
        { statusCode: 409 }
      );
    }

    if (existing) {
      // Was reopened, close it again
      return this.prisma.periodClose.update({
        where: { id: existing.id },
        data: { closedAt: new Date(), closedById: userId, reopenedAt: null, reopenedById: null },
      });
    }

    return this.prisma.periodClose.create({
      data: { companyId, periodYear, periodMonth, closedById: userId },
    });
  }

  // ── Reopen period (admin only) ─────────────────────────────────────────────
  async reopenPeriod(companyId: string, periodYear: number, periodMonth: number, userId: string) {
    const close = await this.prisma.periodClose.findFirst({
      where: { companyId, periodYear, periodMonth },
    });
    if (!close) {
      throw Object.assign(
        new Error(`Period ${periodYear}-${String(periodMonth).padStart(2, '0')} is not closed`),
        { statusCode: 404 }
      );
    }
    if (close.reopenedAt) {
      throw Object.assign(new Error('Period is already open'), { statusCode: 409 });
    }

    return this.prisma.periodClose.update({
      where: { id: close.id },
      data: { reopenedAt: new Date(), reopenedById: userId },
    });
  }

  // ── Check if period is closed ──────────────────────────────────────────────
  async isClosed(companyId: string, date: Date): Promise<boolean> {
    const year  = date.getFullYear();
    const month = date.getMonth() + 1;
    const close = await this.prisma.periodClose.findFirst({
      where: { companyId, periodYear: year, periodMonth: month, reopenedAt: null },
    });
    return !!close;
  }
}
