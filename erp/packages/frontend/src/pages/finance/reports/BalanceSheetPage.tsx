import React, { useState } from 'react';
import { format } from 'date-fns';
import { Download, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useBalanceSheet } from '../../../api/finance';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

interface SectionProps {
  title: string;
  lines: any[];
  total: number;
  color: 'blue' | 'red' | 'purple';
}

const COLORS = {
  blue:   { header: 'bg-blue-50 text-blue-700',   total: 'bg-blue-100 text-blue-800',   row: 'hover:bg-blue-50',   amount: 'text-blue-700' },
  red:    { header: 'bg-red-50 text-red-700',     total: 'bg-red-100 text-red-800',     row: 'hover:bg-red-50',    amount: 'text-red-600' },
  purple: { header: 'bg-purple-50 text-purple-700',total: 'bg-purple-100 text-purple-800',row: 'hover:bg-purple-50',amount: 'text-purple-600' },
};

const Section: React.FC<SectionProps> = ({ title, lines, total, color }) => {
  const c = COLORS[color];
  return (
    <div className="flex-1 border rounded-lg overflow-hidden">
      <div className={clsx('px-4 py-2 text-xs font-bold uppercase tracking-wide', c.header)}>{title}</div>
      <table className="w-full text-xs">
        <tbody>
          {lines.map((l) => (
            <tr key={l.accountId} className={clsx('border-b border-gray-50 transition-colors', c.row)}>
              <td className="px-4 py-1.5 font-mono text-gray-500">{l.accountCode}</td>
              <td className="px-2 py-1.5 text-gray-700">{l.accountName}</td>
              <td className={clsx('px-4 py-1.5 text-right tabular-nums font-medium', c.amount)}>{fmt(l.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={clsx('border-t-2', c.total)}>
            <td colSpan={2} className="px-4 py-2 font-bold text-right text-xs uppercase">Total {title}</td>
            <td className="px-4 py-2 text-right font-bold tabular-nums">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default function BalanceSheetPage() {
  const [asAt, setAsAt]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [runReport, setRunReport] = useState(false);

  const { data, isLoading, refetch } = useBalanceSheet({ asAt }, runReport);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ['Section', 'Code', 'Name', 'Balance'],
      ...data.assetLines.map((l: any) => ['Asset', l.accountCode, l.accountName, l.balance]),
      ['', '', 'Total Assets', data.totalAssets],
      ...data.liabilityLines.map((l: any) => ['Liability', l.accountCode, l.accountName, l.balance]),
      ['', '', 'Total Liabilities', data.totalLiabilities],
      ...data.equityLines.map((l: any) => ['Equity', l.accountCode, l.accountName, l.balance]),
      ['', '', 'Total Equity', data.totalEquity],
    ].map((r) => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'balance-sheet.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Balance Sheet</h2>
        <div className="flex-1" />
        <label className="text-xs text-gray-500">As at</label>
        <input type="date" className="erp-input w-36" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
        <button className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
          onClick={() => { setRunReport(true); refetch(); }}>Run Report</button>
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        {data && <button onClick={handleExport} className="toolbar-btn"><Download size={13} /><span>Export</span></button>}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!runReport && !data && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Select a date and click <strong className="mx-1">Run Report</strong>
          </div>
        )}
        {isLoading && <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>}
        {data && (
          <>
            {/* Report header */}
            <div className="text-center mb-4">
              <h3 className="text-base font-bold text-gray-800">Balance Sheet</h3>
              <p className="text-xs text-gray-500">As at {format(new Date(asAt), 'dd MMMM yyyy')}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {data.isBalanced
                  ? <><CheckCircle size={14} className="text-green-500" /><span className="text-xs text-green-600">Balanced</span></>
                  : <><XCircle size={14} className="text-red-500" /><span className="text-xs text-red-600">Out of balance by {fmt(Math.abs(data.totalAssets - data.totalLiabilities - data.totalEquity))}</span></>}
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-2 gap-4 max-w-5xl mx-auto">
              {/* Left: Assets */}
              <Section title="Assets" lines={data.assetLines} total={data.totalAssets} color="blue" />

              {/* Right: Liabilities + Equity */}
              <div className="flex flex-col gap-4">
                <Section title="Liabilities" lines={data.liabilityLines} total={data.totalLiabilities} color="red" />
                <Section title="Equity"      lines={data.equityLines}    total={data.totalEquity}      color="purple" />

                {/* L+E Total */}
                <div className={clsx(
                  'rounded-lg border-2 px-4 py-3 flex justify-between items-center',
                  data.isBalanced ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                )}>
                  <span className="text-xs font-bold text-gray-700 uppercase">Total Liabilities + Equity</span>
                  <span className="text-sm font-bold tabular-nums">{fmt(data.totalLiabilities + data.totalEquity)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
