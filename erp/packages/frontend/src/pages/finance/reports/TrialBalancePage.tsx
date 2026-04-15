import React, { useState, useMemo, useCallback, useRef } from 'react';
import { format, startOfMonth } from 'date-fns';
import { Download, RefreshCw, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowClassParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useTrialBalance } from '../../../api/finance';
import { downloadExcel } from '../../../utils/excelExport';

interface TbLine {
  accountId: string; accountCode: string; accountName: string; accountType: string;
  openDr: number; openCr: number; movDr: number; movCr: number; closDr: number; closCr: number;
}
interface TbRow extends TbLine { _rowType: 'data' | 'subtotal' | 'grandtotal'; }

const TYPES = ['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'];
const LABELS: Record<string,string> = { ASSET:'Assets', LIABILITY:'Liabilities', EQUITY:'Equity', REVENUE:'Revenue', EXPENSE:'Expenses' };
const ROW_CLS: Record<string,string> = { ASSET:'ag-row-asset', LIABILITY:'ag-row-liability', EQUITY:'ag-row-equity', REVENUE:'ag-row-revenue', EXPENSE:'ag-row-expense' };

const fmt = (n: number | null | undefined) => (!n || n === 0) ? '' : n.toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3});
const fmtA = (n: number) => n.toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3});

function buildRows(lines: TbLine[], includeZero: boolean): TbRow[] {
  const f = includeZero ? lines : lines.filter(l => l.openDr||l.openCr||l.movDr||l.movCr||l.closDr||l.closCr);
  const result: TbRow[] = [];
  for (const type of TYPES) {
    const g = f.filter(l => l.accountType === type);
    if (!g.length) continue;
    result.push(...g.map(l => ({ ...l, _rowType: 'data' as const })));
    const sub = g.reduce((a,l) => ({ openDr:a.openDr+l.openDr, openCr:a.openCr+l.openCr, movDr:a.movDr+l.movDr, movCr:a.movCr+l.movCr, closDr:a.closDr+l.closDr, closCr:a.closCr+l.closCr }), { openDr:0,openCr:0,movDr:0,movCr:0,closDr:0,closCr:0 });
    result.push({ _rowType:'subtotal', accountId:`sub-${type}`, accountCode:'', accountName:`Total ${LABELS[type]??type}`, accountType:type, ...sub });
  }
  return result;
}

export default function TrialBalancePage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const fom   = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const [dateFrom,    setDateFrom]    = useState(fom);
  const [dateTo,      setDateTo]      = useState(today);
  const [includeZero, setIncludeZero] = useState(false);
  const [runParams,   setRunParams]   = useState<any>(null);
  const gridRef = useRef<AgGridReact<TbRow>>(null);

  const { data, isFetching } = useTrialBalance(
    { dateFrom: runParams?.dateFrom, dateTo: runParams?.dateTo, includeZero },
    !!runParams
  );

  const rows = useMemo<TbRow[]>(() => {
    if (!data?.lines) return [];
    const built = buildRows(data.lines, includeZero);
    if (data.totals) built.push({ _rowType:'grandtotal', accountId:'gt', accountCode:'', accountName:'GRAND TOTAL', accountType:'', openDr:data.totals.openDr, openCr:data.totals.openCr, movDr:data.totals.movDr, movCr:data.totals.movCr, closDr:data.totals.closDr, closCr:data.totals.closCr });
    return built;
  }, [data, includeZero]);

  const isBalanced = useMemo(() => !data?.totals ? true : Math.abs(data.totals.openDr - data.totals.openCr) < 0.01 && Math.abs(data.totals.closDr - data.totals.closCr) < 0.01, [data]);

  const colDefs = useMemo<ColDef<TbRow>[]>(() => [
    { headerName:'Code',         field:'accountCode', width:90,  pinned:'left', cellStyle:{fontFamily:'monospace',fontSize:'12px'} },
    { headerName:'Account Name', field:'accountName', flex:3, minWidth:220, pinned:'left',
      cellRenderer:(p:any) => {
        const r: TbRow = p.data;
        if (r._rowType==='subtotal')   return <span className="font-semibold text-gray-700 pl-2">{r.accountName}</span>;
        if (r._rowType==='grandtotal') return <span className="font-bold uppercase tracking-wide">{r.accountName}</span>;
        return <span className="text-gray-800 text-xs pl-4">{r.accountName}</span>;
      }
    },
    { headerName:'Opening Dr',   field:'openDr',  width:135, type:'numericColumn', valueFormatter:(p)=>fmt(p.value), headerClass:'tb-h-open',  cellStyle:{fontFamily:'monospace',fontSize:'12px',color:'#1e40af'} },
    { headerName:'Opening Cr',   field:'openCr',  width:135, type:'numericColumn', valueFormatter:(p)=>fmt(p.value), headerClass:'tb-h-open',  cellStyle:{fontFamily:'monospace',fontSize:'12px',color:'#1e40af'} },
    { headerName:'Movement Dr',  field:'movDr',   width:135, type:'numericColumn', valueFormatter:(p)=>fmt(p.value), headerClass:'tb-h-move',  cellStyle:{fontFamily:'monospace',fontSize:'12px',color:'#92400e'} },
    { headerName:'Movement Cr',  field:'movCr',   width:135, type:'numericColumn', valueFormatter:(p)=>fmt(p.value), headerClass:'tb-h-move',  cellStyle:{fontFamily:'monospace',fontSize:'12px',color:'#92400e'} },
    { headerName:'Closing Dr',   field:'closDr',  width:135, type:'numericColumn', valueFormatter:(p)=>fmt(p.value), headerClass:'tb-h-close', cellStyle:{fontFamily:'monospace',fontSize:'12px',color:'#166534'} },
    { headerName:'Closing Cr',   field:'closCr',  width:135, type:'numericColumn', valueFormatter:(p)=>fmt(p.value), headerClass:'tb-h-close', cellStyle:{fontFamily:'monospace',fontSize:'12px',color:'#166534'} },
  ], []);

  const getRowClass = useCallback((p: RowClassParams<TbRow>) => {
    if (!p.data) return '';
    if (p.data._rowType === 'grandtotal') return 'ag-row-grandtotal';
    if (p.data._rowType === 'subtotal')   return 'ag-row-subtotal';
    return ROW_CLS[p.data.accountType] ?? '';
  }, []);

  const getRowHeight = useCallback((p:any) => { const r: TbRow = p.data; if (r?._rowType==='grandtotal') return 40; if (r?._rowType==='subtotal') return 34; return 28; }, []);

  const handleExport = () => {
    if (!rows.length) return;
    const boldSet = new Set(rows.map((r,i) => r._rowType!=='data' ? i : -1).filter(i=>i>=0));
    downloadExcel([{
      sheetName: `TB ${runParams?.dateFrom??''}`,
      headers:['Code','Account Name','Opening Dr','Opening Cr','Movement Dr','Movement Cr','Closing Dr','Closing Cr'],
      rows: rows.map((r,i) => ({ cells:[r.accountCode,r.accountName,r.openDr||null,r.openCr||null,r.movDr||null,r.movCr||null,r.closDr||null,r.closCr||null], bold:boldSet.has(i), isCurrency:[false,false,true,true,true,true,true,true] })),
      currencyColIndices:[2,3,4,5,6,7], colWidths:[10,42,16,16,16,16,16,16],
    }], `Trial_Balance_${runParams?.dateFrom??today}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      <style>{`
        .ag-row-asset{background-color:#eff6ff!important} .ag-row-liability{background-color:#faf5ff!important}
        .ag-row-equity{background-color:#f0fdfa!important} .ag-row-revenue{background-color:#f0fdf4!important}
        .ag-row-expense{background-color:#fff7ed!important} .ag-row-subtotal{background-color:#f1f5f9!important;font-weight:600}
        .ag-row-grandtotal{background-color:#1F4E79!important;color:white!important;font-weight:700;font-size:13px}
        .ag-row-grandtotal .ag-cell{color:white!important}
        .tb-h-open .ag-header-cell-label{background-color:#dbeafe;color:#1e3a8a;padding:4px 8px}
        .tb-h-move .ag-header-cell-label{background-color:#fef3c7;color:#78350f;padding:4px 8px}
        .tb-h-close .ag-header-cell-label{background-color:#dcfce7;color:#14532d;padding:4px 8px}
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79]">Trial Balance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Opening / Period Movement / Closing</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className={clsx('flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full border', isBalanced ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
              {isBalanced ? <><CheckCircle size={14}/> Balanced</> : <><XCircle size={14}/> Out of Balance</>}
            </span>
          )}
          <button onClick={handleExport} disabled={!rows.length} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40">
            <Download size={14}/> Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-end gap-4">
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Period From</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"/></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Period To</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"/></div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-0.5 cursor-pointer">
          <input type="checkbox" checked={includeZero} onChange={e=>setIncludeZero(e.target.checked)} className="rounded"/> Include Zero Balances</label>
        <button onClick={() => setRunParams({ dateFrom, dateTo })} disabled={isFetching}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1F4E79] text-white rounded text-sm hover:bg-[#163a5c] disabled:opacity-60">
          {isFetching ? <><Loader2 size={14} className="animate-spin"/> Running…</> : <><RefreshCw size={14}/> Run Report</>}
        </button>
      </div>

      <div className="flex items-center gap-5 text-xs text-gray-500 pl-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-200"/> Opening (before period)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-200"/> Period Movement</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-300"/> Closing Balance</span>
      </div>

      <div className="flex-1 min-h-0 ag-theme-alpine rounded-lg overflow-hidden border border-gray-200">
        {!runParams ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a period and click "Run Report"</div>
        ) : (
          <AgGridReact<TbRow> ref={gridRef} rowData={rows} columnDefs={colDefs}
            getRowClass={getRowClass} getRowHeight={getRowHeight}
            suppressCellFocus suppressRowClickSelection animateRows={false} rowBuffer={20}
            defaultColDef={{ sortable:false, resizable:true, suppressMenu:true }}/>
        )}
      </div>

      {data?.totals && (
        <div className="bg-[#1F4E79] text-white rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-semibold">
          <span className="w-[230px] shrink-0">GRAND TOTAL</span>
          <span className="flex-1 text-right text-blue-200">{fmtA(data.totals.openDr)}</span>
          <span className="flex-1 text-right text-blue-200">{fmtA(data.totals.openCr)}</span>
          <span className="flex-1 text-right text-amber-200">{fmtA(data.totals.movDr)}</span>
          <span className="flex-1 text-right text-amber-200">{fmtA(data.totals.movCr)}</span>
          <span className={clsx('flex-1 text-right', isBalanced?'text-green-200':'text-red-300')}>{fmtA(data.totals.closDr)}</span>
          <span className={clsx('flex-1 text-right', isBalanced?'text-green-200':'text-red-300')}>{fmtA(data.totals.closCr)}</span>
        </div>
      )}
    </div>
  );
}
