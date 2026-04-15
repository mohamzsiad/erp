import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Download, RefreshCw, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useBalanceSheet } from '../../../api/finance';
import { downloadExcel } from '../../../utils/excelExport';

interface BsLine {
  accountId:   string;
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY';
  balance:     number;
}

const fmt3 = (n: number) => n.toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3});

function AccountRow({ line }: { line: BsLine }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-2 py-1.5 font-mono text-xs text-gray-400 w-20">{line.accountCode}</td>
      <td className="px-2 py-1.5 text-xs text-gray-700">{line.accountName}</td>
      <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-800 whitespace-nowrap">{fmt3(line.balance)}</td>
    </tr>
  );
}

function SectionTotal({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <tr className={`${color} border-t border-b border-gray-300`}>
      <td colSpan={2} className="px-2 py-2 text-sm font-bold text-gray-800">{label}</td>
      <td className="px-3 py-2 text-right font-bold font-mono text-sm text-gray-900 whitespace-nowrap">{fmt3(amount)}</td>
    </tr>
  );
}

export default function BalanceSheetPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [asAt,      setAsAt]      = useState(today);
  const [runParams, setRunParams] = useState<any>(null);

  const { data, isFetching } = useBalanceSheet({ asAt: runParams?.asAt ?? today }, !!runParams);

  // Split assets into current vs non-current (heuristic: code starting with 1 = current)
  const { currentAssets, nonCurrentAssets } = useMemo(() => {
    if (!data?.assetLines) return { currentAssets: [], nonCurrentAssets: [] };
    const current    = data.assetLines.filter((l: BsLine) => l.accountCode.startsWith('1'));
    const nonCurrent = data.assetLines.filter((l: BsLine) => !l.accountCode.startsWith('1'));
    return { currentAssets: current, nonCurrentAssets: nonCurrent };
  }, [data]);

  const totalCurrentAssets    = useMemo(() => currentAssets.reduce((s: number, l: BsLine) => s + l.balance, 0), [currentAssets]);
  const totalNonCurrentAssets = useMemo(() => nonCurrentAssets.reduce((s: number, l: BsLine) => s + l.balance, 0), [nonCurrentAssets]);

  const handleExport = () => {
    if (!data) return;
    type XRow = [string, string, number|null];
    const leftRows: XRow[]  = [];
    const rightRows: XRow[] = [];
    const boldL = new Set<number>();
    const boldR = new Set<number>();

    // Left: Assets
    leftRows.push(['CURRENT ASSETS','',null]); boldL.add(leftRows.length-1);
    currentAssets.forEach((l: BsLine) => leftRows.push([l.accountCode, l.accountName, l.balance]));
    leftRows.push(['Total Current Assets','',totalCurrentAssets]); boldL.add(leftRows.length-1);
    leftRows.push(['','',null]);
    leftRows.push(['NON-CURRENT ASSETS','',null]); boldL.add(leftRows.length-1);
    nonCurrentAssets.forEach((l: BsLine) => leftRows.push([l.accountCode, l.accountName, l.balance]));
    leftRows.push(['Total Non-Current Assets','',totalNonCurrentAssets]); boldL.add(leftRows.length-1);
    leftRows.push(['','',null]);
    leftRows.push(['TOTAL ASSETS','',data.totalAssets]); boldL.add(leftRows.length-1);

    // Right: Liabilities + Equity
    rightRows.push(['LIABILITIES','',null]); boldR.add(rightRows.length-1);
    data.liabilityLines.forEach((l: BsLine) => rightRows.push([l.accountCode, l.accountName, l.balance]));
    rightRows.push(['Total Liabilities','',data.totalLiabilities]); boldR.add(rightRows.length-1);
    rightRows.push(['','',null]);
    rightRows.push(['EQUITY','',null]); boldR.add(rightRows.length-1);
    data.equityLines.forEach((l: BsLine) => rightRows.push([l.accountCode, l.accountName, l.balance]));
    rightRows.push(['Total Equity','',data.totalEquity]); boldR.add(rightRows.length-1);
    rightRows.push(['','',null]);
    rightRows.push(['TOTAL LIABILITIES + EQUITY','',(data.totalLiabilities+data.totalEquity)]); boldR.add(rightRows.length-1);

    const maxLen = Math.max(leftRows.length, rightRows.length);
    const combined = Array.from({length: maxLen}, (_,i) => {
      const l = leftRows[i] ?? ['','',null];
      const r = rightRows[i] ?? ['','',null];
      return { cells:[l[0],l[1],l[2],r[0],r[1],r[2]], bold:boldL.has(i)||boldR.has(i), isCurrency:[false,false,true,false,false,true] };
    });

    downloadExcel([{
      sheetName: `BS ${runParams?.asAt??''}`,
      headers:['Code (Assets)','Account (Assets)','Amount','Code (L+E)','Account (L+E)','Amount'],
      rows: combined,
      currencyColIndices:[2,5],
      colWidths:[10,35,16,10,35,16],
    }], `Balance_Sheet_${runParams?.asAt??today}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79]">Balance Sheet</h1>
          <p className="text-sm text-gray-500 mt-0.5">Statement of Financial Position</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className={clsx('flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full border',
              data.isBalanced ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
              {data.isBalanced
                ? <><CheckCircle size={14}/> Assets = Liabilities + Equity</>
                : <><XCircle size={14}/> Out of Balance — {fmt3(Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)))}</>}
            </span>
          )}
          <button onClick={handleExport} disabled={!data}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40">
            <Download size={14}/> Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-end gap-4">
        <div><label className="block text-xs font-medium text-gray-500 mb-1">As At Date</label>
          <input type="date" value={asAt} onChange={e=>setAsAt(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"/></div>
        <button onClick={() => setRunParams({ asAt })} disabled={isFetching}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1F4E79] text-white rounded text-sm hover:bg-[#163a5c] disabled:opacity-60">
          {isFetching ? <><Loader2 size={14} className="animate-spin"/> Running…</> : <><RefreshCw size={14}/> Run Report</>}
        </button>
      </div>

      {!runParams ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Select a date and click "Run Report"</div>
      ) : !data ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-[#1F4E79]"/></div>
      ) : (
        <>
          {/* Two-column layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* LEFT: ASSETS */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-sky-700 text-white px-4 py-2.5 font-bold text-sm tracking-wide">ASSETS</div>
              <table className="w-full border-collapse">
                <colgroup><col className="w-20"/><col/><col className="w-28"/></colgroup>
                <tbody>
                  {/* Current Assets */}
                  <tr><td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 uppercase tracking-wider border-b border-sky-100">Current Assets</td></tr>
                  {currentAssets.map((l: BsLine) => <AccountRow key={l.accountId} line={l} />)}
                  {currentAssets.length === 0 && <tr><td colSpan={3} className="px-4 py-2 text-gray-400 text-xs italic">None</td></tr>}
                  <SectionTotal label="Total Current Assets" amount={totalCurrentAssets} color="bg-sky-50" />

                  <tr><td colSpan={3} className="py-2"/></tr>

                  {/* Non-Current Assets */}
                  <tr><td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 uppercase tracking-wider border-b border-sky-100">Non-Current Assets</td></tr>
                  {nonCurrentAssets.map((l: BsLine) => <AccountRow key={l.accountId} line={l} />)}
                  {nonCurrentAssets.length === 0 && <tr><td colSpan={3} className="px-4 py-2 text-gray-400 text-xs italic">None</td></tr>}
                  <SectionTotal label="Total Non-Current Assets" amount={totalNonCurrentAssets} color="bg-sky-50" />

                  <tr><td colSpan={3} className="py-1"/></tr>

                  {/* Grand total assets */}
                  <tr className="bg-[#1F4E79] text-white">
                    <td colSpan={2} className="px-2 py-2.5 font-bold text-sm">TOTAL ASSETS</td>
                    <td className="px-3 py-2.5 text-right font-bold font-mono text-sm whitespace-nowrap">{fmt3(data.totalAssets)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* RIGHT: LIABILITIES + EQUITY */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-purple-700 text-white px-4 py-2.5 font-bold text-sm tracking-wide">LIABILITIES &amp; EQUITY</div>
              <table className="w-full border-collapse">
                <colgroup><col className="w-20"/><col/><col className="w-28"/></colgroup>
                <tbody>
                  {/* Liabilities */}
                  <tr><td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 uppercase tracking-wider border-b border-purple-100">Liabilities</td></tr>
                  {data.liabilityLines.map((l: BsLine) => <AccountRow key={l.accountId} line={l} />)}
                  {data.liabilityLines.length === 0 && <tr><td colSpan={3} className="px-4 py-2 text-gray-400 text-xs italic">None</td></tr>}
                  <SectionTotal label="Total Liabilities" amount={data.totalLiabilities} color="bg-purple-50" />

                  <tr><td colSpan={3} className="py-2"/></tr>

                  {/* Equity */}
                  <tr><td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 uppercase tracking-wider border-b border-teal-100">Equity</td></tr>
                  {data.equityLines.map((l: BsLine) => <AccountRow key={l.accountId} line={l} />)}
                  {data.equityLines.length === 0 && <tr><td colSpan={3} className="px-4 py-2 text-gray-400 text-xs italic">None</td></tr>}
                  <SectionTotal label="Total Equity" amount={data.totalEquity} color="bg-teal-50" />

                  <tr><td colSpan={3} className="py-1"/></tr>

                  {/* Grand total liabilities + equity */}
                  <tr className={clsx('text-white', data.isBalanced ? 'bg-[#1F4E79]' : 'bg-red-700')}>
                    <td colSpan={2} className="px-2 py-2.5 font-bold text-sm">TOTAL LIABILITIES + EQUITY</td>
                    <td className="px-3 py-2.5 text-right font-bold font-mono text-sm whitespace-nowrap">
                      {fmt3(data.totalLiabilities + data.totalEquity)}
                    </td>
                  </tr>
                  {!data.isBalanced && (
                    <tr className="bg-red-50">
                      <td colSpan={3} className="px-3 py-1.5 text-red-700 text-xs font-medium">
                        ⚠ Difference: {fmt3(Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)))} — check journal entries
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom summary bar */}
          <div className={clsx('rounded-lg px-4 py-2.5 flex items-center justify-between text-sm font-semibold',
            data.isBalanced ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800')}>
            <span className="flex items-center gap-2">
              {data.isBalanced ? <CheckCircle size={16}/> : <XCircle size={16}/>}
              Balance Sheet as at {runParams?.asAt}
            </span>
            <span>Total Assets: {fmt3(data.totalAssets)}</span>
            <span>Total Liabilities + Equity: {fmt3(data.totalLiabilities + data.totalEquity)}</span>
          </div>
        </>
      )}
    </div>
  );
}
