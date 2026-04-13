import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { RefreshCw, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { useBudgetVsActual } from '../../../api/finance';

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

interface BvaRow {
  accountCode: string;
  accountName: string;
  costCenterCode?: string;
  costCenterName?: string;
  annualBudget: number;
  ytdBudget: number;
  ytdActual: number;
  variance: number;       // ytdBudget - ytdActual (positive = under budget)
  variancePct: number;
  remaining: number;      // annualBudget - ytdActual
}

export default function BudgetVsActualPage() {
  const now = new Date();
  const [year, setYear]             = useState(now.getFullYear());
  const [month, setMonth]           = useState(now.getMonth() + 1);
  const [runReport, setRunReport]   = useState(false);
  const [filterText, setFilterText] = useState('');

  const { data, isLoading, refetch } = useBudgetVsActual(
    { year, month },
    runReport,
  );

  const rows: BvaRow[] = useMemo(() => data?.rows ?? [], [data]);

  const filtered = useMemo(() => {
    if (!filterText) return rows;
    const q = filterText.toLowerCase();
    return rows.filter(
      (r) =>
        r.accountCode.toLowerCase().includes(q) ||
        r.accountName.toLowerCase().includes(q) ||
        (r.costCenterCode ?? '').toLowerCase().includes(q) ||
        (r.costCenterName ?? '').toLowerCase().includes(q),
    );
  }, [rows, filterText]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          annualBudget: acc.annualBudget + r.annualBudget,
          ytdBudget:    acc.ytdBudget    + r.ytdBudget,
          ytdActual:    acc.ytdActual    + r.ytdActual,
          variance:     acc.variance     + r.variance,
          remaining:    acc.remaining    + r.remaining,
        }),
        { annualBudget: 0, ytdBudget: 0, ytdActual: 0, variance: 0, remaining: 0 },
      ),
    [filtered],
  );

  const handleExport = () => {
    if (!filtered.length) return;
    const header = ['Code', 'Account', 'Cost Center', 'Annual Budget', 'YTD Budget', 'YTD Actual', 'Variance', 'Variance %', 'Remaining'];
    const csvRows = filtered.map((r) => [
      r.accountCode,
      r.accountName,
      r.costCenterCode ?? '',
      r.annualBudget,
      r.ytdBudget,
      r.ytdActual,
      r.variance,
      r.variancePct.toFixed(2) + '%',
      r.remaining,
    ]);
    const csv = [header, ...csvRows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `budget-vs-actual-${year}-${String(month).padStart(2, '0')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  const varianceClass = (v: number) =>
    v >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold';

  const varianceBg = (pctVal: number) => {
    if (pctVal >= 0) return 'bg-green-50';
    if (pctVal < -10) return 'bg-red-100';
    return 'bg-red-50';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Budget vs Actual</h2>
        <div className="flex-1" />
        <label className="text-xs text-gray-500">Year</label>
        <input
          type="number"
          className="erp-input w-24"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          min={2020}
          max={2099}
        />
        <label className="text-xs text-gray-500">Through</label>
        <select
          className="erp-input w-36"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <button
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
          onClick={() => { setRunReport(true); refetch(); }}
        >
          Run Report
        </button>
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        {data && (
          <button onClick={handleExport} className="toolbar-btn">
            <Download size={13} /><span>Export</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!runReport && !data && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Select year / month and click <strong className="mx-1">Run Report</strong>
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
        )}
        {data && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Report header */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center">
              <div className="flex-1 text-center">
                <h3 className="text-sm font-bold text-gray-800">Budget vs Actual</h3>
                <p className="text-xs text-gray-500">
                  {year} — Through {MONTHS[month - 1]}
                </p>
              </div>
              <input
                type="text"
                className="erp-input w-48 text-xs"
                placeholder="Filter accounts…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>

            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 w-24">Code</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Account</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600 w-32">Cost Center</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">Annual Budget</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">YTD Budget</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">YTD Actual</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">Variance</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 w-24">Var %</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                        No budget data found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => (
                      <tr
                        key={`${row.accountCode}-${row.costCenterCode ?? ''}-${idx}`}
                        className={clsx('transition-colors hover:bg-gray-50', varianceBg(row.variancePct))}
                      >
                        <td className="px-4 py-1.5 font-mono text-gray-500">{row.accountCode}</td>
                        <td className="px-4 py-1.5 text-gray-700">{row.accountName}</td>
                        <td className="px-4 py-1.5 text-gray-500">
                          {row.costCenterCode
                            ? <span className="font-mono">{row.costCenterCode}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">{fmt(row.annualBudget)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">{fmt(row.ytdBudget)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-gray-800 font-medium">{fmt(row.ytdActual)}</td>
                        <td className={clsx('px-4 py-1.5 text-right tabular-nums', varianceClass(row.variance))}>
                          {fmt(row.variance)}
                        </td>
                        <td className={clsx('px-4 py-1.5 text-right tabular-nums', varianceClass(row.variancePct))}>
                          {pct(row.variancePct)}
                        </td>
                        <td className={clsx(
                          'px-4 py-1.5 text-right tabular-nums',
                          row.remaining >= 0 ? 'text-gray-700' : 'text-red-600 font-semibold',
                        )}>
                          {fmt(row.remaining)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Grand total */}
                <tfoot>
                  <tr className="bg-[#1F4E79] text-white font-bold">
                    <td colSpan={3} className="px-4 py-2 text-sm text-right uppercase tracking-wide">
                      Grand Total
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.annualBudget)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.ytdBudget)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.ytdActual)}</td>
                    <td className={clsx('px-4 py-2 text-right tabular-nums', totals.variance >= 0 ? 'text-green-300' : 'text-red-300')}>
                      {fmt(totals.variance)}
                    </td>
                    <td className={clsx('px-4 py-2 text-right tabular-nums', totals.variance >= 0 ? 'text-green-300' : 'text-red-300')}>
                      {totals.ytdBudget !== 0
                        ? pct((totals.variance / totals.ytdBudget) * 100)
                        : '—'}
                    </td>
                    <td className={clsx('px-4 py-2 text-right tabular-nums', totals.remaining >= 0 ? 'text-white' : 'text-red-300')}>
                      {fmt(totals.remaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center gap-4 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-200" />
                Under budget
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
                Over budget (&lt;10%)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
                Over budget (&gt;10%)
              </span>
              <span className="ml-auto text-gray-400">
                Variance = YTD Budget − YTD Actual&nbsp;&nbsp;|&nbsp;&nbsp;Remaining = Annual Budget − YTD Actual
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
