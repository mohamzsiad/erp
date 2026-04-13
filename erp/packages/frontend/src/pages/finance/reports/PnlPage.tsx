import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Download, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { usePnl } from '../../../api/finance';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function PnlPage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [dateTo,   setDateTo]   = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [runReport, setRunReport] = useState(false);

  const { data, isLoading, refetch } = usePnl({ dateFrom, dateTo }, runReport);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ['Section', 'Account Code', 'Account Name', 'Amount'],
      ...data.revenueLines.map((l: any) => ['Revenue', l.accountCode, l.accountName, l.amount]),
      ['Revenue Total', '', '', data.totalRevenue],
      ...data.expenseLines.map((l: any) => ['Expense', l.accountCode, l.accountName, l.amount]),
      ['Expense Total', '', '', data.totalExpense],
      ['Net Profit', '', '', data.netProfit],
    ].map((r) => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pnl.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const NetIcon = !data ? Minus : data.netProfit > 0 ? TrendingUp : data.netProfit < 0 ? TrendingDown : Minus;
  const netColor = !data ? '' : data.netProfit > 0 ? 'text-green-600' : data.netProfit < 0 ? 'text-red-600' : 'text-gray-600';

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Profit & Loss Statement</h2>
        <div className="flex-1" />
        <label className="text-xs text-gray-500">From</label>
        <input type="date" className="erp-input w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label className="text-xs text-gray-500">To</label>
        <input type="date" className="erp-input w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
          onClick={() => { setRunReport(true); refetch(); }}>Run Report</button>
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        {data && <button onClick={handleExport} className="toolbar-btn"><Download size={13} /><span>Export</span></button>}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!runReport && !data && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Set date range and click <strong className="mx-1">Run Report</strong>
          </div>
        )}
        {isLoading && <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>}
        {data && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Report header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 text-center">
                <h3 className="text-sm font-bold text-gray-800">Profit & Loss Statement</h3>
                <p className="text-xs text-gray-500">{format(new Date(dateFrom), 'dd MMM yyyy')} – {format(new Date(dateTo), 'dd MMM yyyy')}</p>
              </div>

              {/* Revenue section */}
              <div>
                <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Income / Revenue</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {data.revenueLines.map((line: any) => (
                      <tr key={line.accountId} className="border-b border-gray-50 hover:bg-green-50 transition-colors">
                        <td className="px-6 py-1.5 font-mono text-gray-500 w-24">{line.accountCode}</td>
                        <td className="px-2 py-1.5 text-gray-700 flex-1">{line.accountName}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium text-green-700 w-40">{fmt(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-100 border-t border-green-200">
                      <td colSpan={2} className="px-4 py-2 font-bold text-green-800 text-right text-xs uppercase">Total Revenue</td>
                      <td className="px-4 py-2 text-right font-bold text-green-800 tabular-nums">{fmt(data.totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Expense section */}
              <div className="mt-2">
                <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                  <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Expenses</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {data.expenseLines.map((line: any) => (
                      <tr key={line.accountId} className="border-b border-gray-50 hover:bg-red-50 transition-colors">
                        <td className="px-6 py-1.5 font-mono text-gray-500 w-24">{line.accountCode}</td>
                        <td className="px-2 py-1.5 text-gray-700 flex-1">{line.accountName}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium text-red-600 w-40">{fmt(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-100 border-t border-red-200">
                      <td colSpan={2} className="px-4 py-2 font-bold text-red-800 text-right text-xs uppercase">Total Expenses</td>
                      <td className="px-4 py-2 text-right font-bold text-red-800 tabular-nums">{fmt(data.totalExpense)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Net Profit */}
              <div className={clsx(
                'flex items-center justify-between px-6 py-4 border-t-2',
                data.netProfit >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
              )}>
                <div className="flex items-center gap-2">
                  <NetIcon size={18} className={netColor} />
                  <span className={clsx('text-sm font-bold', netColor)}>
                    {data.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                  </span>
                </div>
                <span className={clsx('text-xl font-bold tabular-nums', netColor)}>
                  {fmt(Math.abs(data.netProfit))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
