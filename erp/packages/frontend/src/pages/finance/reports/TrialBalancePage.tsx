import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Download, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { useTrialBalance } from '../../../api/finance';

const TYPE_COLORS: Record<string, string> = {
  ASSET:     'text-blue-700',
  LIABILITY: 'text-red-700',
  EQUITY:    'text-purple-700',
  REVENUE:   'text-green-700',
  EXPENSE:   'text-amber-700',
};

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function TrialBalancePage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [dateTo,   setDateTo]   = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [runReport, setRunReport] = useState(false);

  const { data, isLoading, refetch } = useTrialBalance({ dateFrom, dateTo }, runReport);

  const lines: any[] = data?.lines ?? [];
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = lines.filter((l) => l.accountType === type);
    return acc;
  }, {} as Record<string, any[]>);

  const handleExport = () => {
    const rows = lines.map((l) => [l.accountCode, l.accountName, l.accountType, l.totalDebit, l.totalCredit, l.netDebit, l.netCredit]);
    const csv = [['Code', 'Name', 'Type', 'Total Debit', 'Total Credit', 'Net Debit', 'Net Credit'], ...rows]
      .map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'trial-balance.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Trial Balance</h2>
        <div className="flex-1" />
        <label className="text-xs text-gray-500">From</label>
        <input type="date" className="erp-input w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label className="text-xs text-gray-500">To</label>
        <input type="date" className="erp-input w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
          onClick={() => { setRunReport(true); refetch(); }}
        >
          Run Report
        </button>
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        {lines.length > 0 && <button onClick={handleExport} className="toolbar-btn"><Download size={13} /><span>Export</span></button>}
      </div>

      {/* Report content */}
      <div className="flex-1 overflow-auto p-4">
        {!runReport && !data && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Set date range and click <strong className="mx-1">Run Report</strong>
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
        )}
        {data && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 text-center">Trial Balance</h3>
              <p className="text-xs text-gray-500 text-center">{format(new Date(dateFrom), 'dd MMM yyyy')} – {format(new Date(dateTo), 'dd MMM yyyy')}</p>
            </div>

            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 w-24">Code</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Account Name</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 w-24">Type</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">Total Debit</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">Total Credit</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">Net Debit</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600 w-36">Net Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {TYPE_ORDER.map((type) => {
                  const typeLines = grouped[type];
                  if (!typeLines?.length) return null;
                  const sumDebit  = typeLines.reduce((s, l) => s + l.netDebit, 0);
                  const sumCredit = typeLines.reduce((s, l) => s + l.netCredit, 0);
                  return (
                    <React.Fragment key={type}>
                      {/* Section header */}
                      <tr className="bg-gray-50">
                        <td colSpan={7} className={clsx('px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide', TYPE_COLORS[type])}>
                          {type}
                        </td>
                      </tr>
                      {typeLines.map((line) => (
                        <tr key={line.accountId} className="hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-1.5 font-mono text-gray-600">{line.accountCode}</td>
                          <td className="px-4 py-1.5 text-gray-700">{line.accountName}</td>
                          <td className="px-4 py-1.5 text-gray-400 text-[10px]">{line.accountType}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">{fmt(line.totalDebit)}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">{fmt(line.totalCredit)}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums font-medium text-blue-700">{line.netDebit > 0 ? fmt(line.netDebit) : ''}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums font-medium text-green-700">{line.netCredit > 0 ? fmt(line.netCredit) : ''}</td>
                        </tr>
                      ))}
                      {/* Section subtotal */}
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold text-gray-600 text-right">
                          {type} Total
                        </td>
                        <td className="px-4 py-1.5 text-right font-bold text-blue-700 tabular-nums">{sumDebit > 0 ? fmt(sumDebit) : ''}</td>
                        <td className="px-4 py-1.5 text-right font-bold text-green-700 tabular-nums">{sumCredit > 0 ? fmt(sumCredit) : ''}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              {/* Grand totals */}
              <tfoot>
                <tr className="bg-[#1F4E79] text-white">
                  <td colSpan={5} className="px-4 py-2 text-sm font-bold text-right">Grand Total</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-sm">{fmt(data.grandDebit)}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-sm">{fmt(data.grandCredit)}</td>
                </tr>
                <tr className={clsx(
                  'text-xs',
                  Math.abs(data.grandDebit - data.grandCredit) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}>
                  <td colSpan={7} className="px-4 py-1.5 text-center font-semibold">
                    {Math.abs(data.grandDebit - data.grandCredit) < 0.01
                      ? '✓ Trial Balance is balanced'
                      : `✗ Out of balance by ${fmt(Math.abs(data.grandDebit - data.grandCredit))}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
