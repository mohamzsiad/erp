import React, { useState, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { Download, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { usePnl } from '../../../api/finance';
import { downloadExcel } from '../../../utils/excelExport';

interface PnlLine {
  accountId:   string;
  accountCode: string;
  accountName: string;
  accountType: string;
  periodAmt:   number;
  ytdAmt:      number;
  priorYtdAmt: number;
  variance:    number;
}

const fmt3 = (n: number) => n.toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3});
const fmtSigned = (n: number) => {
  if (n === 0) return '—';
  const s = fmt3(Math.abs(n));
  return n < 0 ? `(${s})` : s;
};

function AmtCell({ n, highlight = false }: { n: number; highlight?: boolean }) {
  const pos = n >= 0;
  return (
    <td className={clsx('px-3 py-1.5 text-right tabular-nums font-mono text-xs whitespace-nowrap',
      highlight && !pos && 'text-red-600',
      highlight && pos && 'text-emerald-700',
      !highlight && 'text-gray-700'
    )}>
      {n === 0 ? <span className="text-gray-300">—</span> : (
        n < 0 ? <span className="text-red-600">({fmt3(-n)})</span> : fmt3(n)
      )}
    </td>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={5} className="px-3 py-2 text-xs font-bold tracking-widest uppercase bg-gray-100 text-gray-500 border-b border-gray-200">
        {label}
      </td>
    </tr>
  );
}

function SubtotalRow({ label, period, ytd, prior, variance }: {
  label: string; period: number; ytd: number; prior: number; variance: number;
}) {
  return (
    <tr className="bg-gray-50 border-t border-b border-gray-300 font-semibold">
      <td className="px-3 py-2 text-sm text-gray-800">{label}</td>
      <AmtCell n={period} />
      <AmtCell n={ytd} />
      <AmtCell n={prior} />
      <AmtCell n={variance} highlight />
    </tr>
  );
}

export default function PnlPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const fom   = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const [dateFrom,  setDateFrom]  = useState(fom);
  const [dateTo,    setDateTo]    = useState(today);
  const [runParams, setRunParams] = useState<any>(null);

  const { data, isFetching } = usePnl(
    { dateFrom: runParams?.dateFrom, dateTo: runParams?.dateTo },
    !!runParams
  );

  const totals = useMemo(() => {
    if (!data) return null;
    const varianceRevenue = data.totalRevenueYtd - data.totalRevenuePriorYtd;
    const varianceExpense = data.totalExpenseYtd - data.totalExpensePriorYtd;
    const varianceNet     = data.netProfitYtd    - data.netProfitPriorYtd;
    return { varianceRevenue, varianceExpense, varianceNet };
  }, [data]);

  const handleExport = () => {
    if (!data) return;
    type DataRow = [string, string, number|null, number|null, number|null, number|null];
    const exRows: DataRow[] = [];
    const boldRows = new Set<number>();

    exRows.push(['REVENUE','',null,null,null,null]); boldRows.add(exRows.length-1);
    data.revenueLines.forEach((l: PnlLine) => exRows.push([l.accountCode, l.accountName, l.periodAmt||null, l.ytdAmt||null, l.priorYtdAmt||null, l.variance||null]));
    exRows.push(['Total Revenue','',data.totalRevenuePeriod,data.totalRevenueYtd,data.totalRevenuePriorYtd,totals?.varianceRevenue??0]); boldRows.add(exRows.length-1);
    exRows.push(['','',null,null,null,null]);
    exRows.push(['EXPENSES','',null,null,null,null]); boldRows.add(exRows.length-1);
    data.expenseLines.forEach((l: PnlLine) => exRows.push([l.accountCode, l.accountName, l.periodAmt||null, l.ytdAmt||null, l.priorYtdAmt||null, l.variance||null]));
    exRows.push(['Total Expenses','',data.totalExpensePeriod,data.totalExpenseYtd,data.totalExpensePriorYtd,totals?.varianceExpense??0]); boldRows.add(exRows.length-1);
    exRows.push(['','',null,null,null,null]);
    exRows.push(['NET PROFIT / (LOSS)','',data.netProfitPeriod,data.netProfitYtd,data.netProfitPriorYtd,totals?.varianceNet??0]); boldRows.add(exRows.length-1);

    downloadExcel([{
      sheetName: `P&L ${runParams?.dateFrom??''}`,
      headers:['Code','Account','Current Period','YTD','Prior Year YTD','Variance'],
      rows: exRows.map((cells,i) => ({ cells, bold:boldRows.has(i), isCurrency:[false,false,true,true,true,true] })),
      currencyColIndices:[2,3,4,5],
      colWidths:[10,40,18,18,18,18],
    }], `PnL_${runParams?.dateFrom??today}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79]">Profit &amp; Loss</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue minus Expenses = Net Profit/(Loss)</p>
        </div>
        <button onClick={handleExport} disabled={!data}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40">
          <Download size={14}/> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-end gap-4">
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Period From</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"/></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Period To</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"/></div>
        <button onClick={() => setRunParams({ dateFrom, dateTo })} disabled={isFetching}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1F4E79] text-white rounded text-sm hover:bg-[#163a5c] disabled:opacity-60">
          {isFetching ? <><Loader2 size={14} className="animate-spin"/> Running…</> : <><RefreshCw size={14}/> Run Report</>}
        </button>
      </div>

      {!runParams ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Select a period and click "Run Report"</div>
      ) : !data ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-[#1F4E79]"/></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#1F4E79] text-white">
                <th className="px-3 py-2.5 text-left font-semibold w-[55%]">Account</th>
                <th className="px-3 py-2.5 text-right font-semibold">Current Period</th>
                <th className="px-3 py-2.5 text-right font-semibold">YTD</th>
                <th className="px-3 py-2.5 text-right font-semibold">Prior Year YTD</th>
                <th className="px-3 py-2.5 text-right font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody>
              {/* ── REVENUE ───────────────────────────────────────────────── */}
              <SectionHeader label="Revenue" />
              {data.revenueLines.map((l: PnlLine) => (
                <tr key={l.accountId} className="hover:bg-green-50 border-b border-gray-100">
                  <td className="px-3 py-1.5 text-xs text-gray-700 pl-6">
                    <span className="text-gray-400 font-mono mr-2 text-[11px]">{l.accountCode}</span>{l.accountName}
                  </td>
                  <AmtCell n={l.periodAmt} />
                  <AmtCell n={l.ytdAmt} />
                  <AmtCell n={l.priorYtdAmt} />
                  <AmtCell n={l.variance} highlight />
                </tr>
              ))}
              {data.revenueLines.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-3 text-gray-400 text-xs italic">No revenue accounts with activity</td></tr>
              )}
              <SubtotalRow label="Total Revenue"
                period={data.totalRevenuePeriod} ytd={data.totalRevenueYtd}
                prior={data.totalRevenuePriorYtd} variance={totals?.varianceRevenue??0} />

              {/* spacing */}
              <tr><td colSpan={5} className="py-1" /></tr>

              {/* ── EXPENSES ─────────────────────────────────────────────── */}
              <SectionHeader label="Expenses" />
              {data.expenseLines.map((l: PnlLine) => (
                <tr key={l.accountId} className="hover:bg-orange-50 border-b border-gray-100">
                  <td className="px-3 py-1.5 text-xs text-gray-700 pl-6">
                    <span className="text-gray-400 font-mono mr-2 text-[11px]">{l.accountCode}</span>{l.accountName}
                  </td>
                  <AmtCell n={l.periodAmt} />
                  <AmtCell n={l.ytdAmt} />
                  <AmtCell n={l.priorYtdAmt} />
                  <AmtCell n={l.variance} highlight />
                </tr>
              ))}
              {data.expenseLines.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-3 text-gray-400 text-xs italic">No expense accounts with activity</td></tr>
              )}
              <SubtotalRow label="Total Expenses"
                period={data.totalExpensePeriod} ytd={data.totalExpenseYtd}
                prior={data.totalExpensePriorYtd} variance={totals?.varianceExpense??0} />

              {/* spacing */}
              <tr><td colSpan={5} className="py-1" /></tr>

              {/* ── NET PROFIT ────────────────────────────────────────────── */}
              <tr className={clsx('border-t-2 border-b-2 border-gray-400',
                data.netProfitYtd >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                <td className="px-3 py-3 font-bold text-base text-gray-900 flex items-center gap-2">
                  {data.netProfitYtd > 0
                    ? <TrendingUp size={16} className="text-emerald-600"/>
                    : data.netProfitYtd < 0
                    ? <TrendingDown size={16} className="text-red-600"/>
                    : <Minus size={16} className="text-gray-400"/>}
                  NET PROFIT / (LOSS)
                </td>
                <td className={clsx('px-3 py-3 text-right font-bold tabular-nums font-mono',
                  data.netProfitPeriod >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                  {fmtSigned(data.netProfitPeriod)}
                </td>
                <td className={clsx('px-3 py-3 text-right font-bold tabular-nums font-mono text-base',
                  data.netProfitYtd >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                  {fmtSigned(data.netProfitYtd)}
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums font-mono text-gray-700">
                  {fmtSigned(data.netProfitPriorYtd)}
                </td>
                <td className={clsx('px-3 py-3 text-right font-bold tabular-nums font-mono',
                  (totals?.varianceNet??0) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                  {fmtSigned(totals?.varianceNet ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
