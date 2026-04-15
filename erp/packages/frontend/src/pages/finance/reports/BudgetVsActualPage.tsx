import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowClassParams, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useBudgetVsActual } from '../../../api/finance';
import { downloadExcel } from '../../../utils/excelExport';

interface BvaRow {
  budgetId:       string;
  accountId:      string;
  accountCode:    string;
  accountName:    string;
  accountType:    string;
  costCenterId:   string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  annualBudget:   number;
  ytdBudget:      number;
  ytdActual:      number;
  variance:       number;
  variancePct:    number;
}

interface GridRow extends BvaRow {
  _rowType: 'data' | 'subtotal' | 'grandtotal';
  _label?:  string;
}

const TYPES = ['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'];
const TYPE_LABELS: Record<string,string> = { ASSET:'Assets', LIABILITY:'Liabilities', EQUITY:'Equity', REVENUE:'Revenue', EXPENSE:'Expenses' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt3 = (n: number) => n.toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3});
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

function buildGridRows(lines: BvaRow[]): GridRow[] {
  const result: GridRow[] = [];
  for (const type of TYPES) {
    const g = lines.filter(l => l.accountType === type);
    if (!g.length) continue;
    result.push(...g.map(l => ({ ...l, _rowType: 'data' as const })));
    const sub = g.reduce((a,l) => ({ annualBudget:a.annualBudget+l.annualBudget, ytdBudget:a.ytdBudget+l.ytdBudget, ytdActual:a.ytdActual+l.ytdActual, variance:a.variance+l.variance }), { annualBudget:0, ytdBudget:0, ytdActual:0, variance:0 });
    const variancePct = sub.ytdBudget ? (sub.variance / sub.ytdBudget) * 100 : 0;
    result.push({ ...sub, variancePct, _rowType:'subtotal', _label:`Total ${TYPE_LABELS[type]??type}`, budgetId:`sub-${type}`, accountId:`sub-${type}`, accountCode:'', accountName:`Total ${TYPE_LABELS[type]??type}`, accountType:type, costCenterId:null, costCenterCode:null, costCenterName:null });
  }
  return result;
}

// Variance bar component
function VarianceBar({ pct, variance }: { pct: number; variance: number }) {
  const capped = Math.min(Math.abs(pct), 100);
  const isOver  = variance < 0;  // over budget = bad for expenses, good for revenue
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', isOver ? 'bg-red-500' : 'bg-emerald-500')}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className={clsx('text-xs font-mono w-14 text-right', isOver ? 'text-red-600' : 'text-emerald-600')}>
        {fmtPct(pct)}
      </span>
    </div>
  );
}

export default function BudgetVsActualPage() {
  const currentYear = new Date().getFullYear();
  const [fiscalYear,  setFiscalYear]  = useState(currentYear);
  const [periodFrom,  setPeriodFrom]  = useState(1);
  const [periodTo,    setPeriodTo]    = useState(new Date().getMonth() + 1);
  const [runParams,   setRunParams]   = useState<any>(null);

  const gridRef = useRef<AgGridReact<GridRow>>(null);

  const { data, isFetching } = useBudgetVsActual(
    { fiscalYear: runParams?.fiscalYear, periodFrom: runParams?.periodFrom, periodTo: runParams?.periodTo },
    !!runParams
  );

  const rows = useMemo<GridRow[]>(() => {
    if (!data?.length) return [];
    const built = buildGridRows(data);
    // Grand total
    const gt = data.reduce((a: any, l: BvaRow) => ({ annualBudget:a.annualBudget+l.annualBudget, ytdBudget:a.ytdBudget+l.ytdBudget, ytdActual:a.ytdActual+l.ytdActual, variance:a.variance+l.variance }), { annualBudget:0, ytdBudget:0, ytdActual:0, variance:0 });
    const variancePct = gt.ytdBudget ? (gt.variance / gt.ytdBudget) * 100 : 0;
    built.push({ ...gt, variancePct, _rowType:'grandtotal', _label:'GRAND TOTAL', budgetId:'gt', accountId:'gt', accountCode:'', accountName:'GRAND TOTAL', accountType:'', costCenterId:null, costCenterCode:null, costCenterName:null });
    return built;
  }, [data]);

  const colDefs = useMemo<ColDef<GridRow>[]>(() => [
    { headerName:'Code',    field:'accountCode', width:90, pinned:'left', cellStyle:{fontFamily:'monospace',fontSize:'12px'} },
    { headerName:'Account', field:'accountName', flex:2, minWidth:200, pinned:'left',
      cellRenderer:(p:ICellRendererParams<GridRow>) => {
        const r=p.data!;
        if (r._rowType==='subtotal')   return <span className="font-semibold text-gray-700 pl-2">{r.accountName}</span>;
        if (r._rowType==='grandtotal') return <span className="font-bold uppercase tracking-wide">{r.accountName}</span>;
        return <span className="text-xs text-gray-700 pl-3">{r.accountName}</span>;
      }
    },
    { headerName:'Cost Center', field:'costCenterName', width:140, cellStyle:{fontSize:'11px',color:'#6b7280'},
      valueFormatter:(p)=>p.value??''
    },
    { headerName:'Annual Budget', field:'annualBudget', width:150, type:'numericColumn',
      cellStyle:{fontFamily:'monospace',fontSize:'12px',textAlign:'right',color:'#1e3a8a'},
      valueFormatter:(p)=>fmt3(p.value)
    },
    { headerName:'YTD Budget', field:'ytdBudget', width:140, type:'numericColumn',
      cellStyle:{fontFamily:'monospace',fontSize:'12px',textAlign:'right',color:'#1e3a8a'},
      valueFormatter:(p)=>fmt3(p.value)
    },
    { headerName:'YTD Actual', field:'ytdActual', width:140, type:'numericColumn',
      cellStyle:(p)=>({fontFamily:'monospace',fontSize:'12px',textAlign:'right',
        color: p.value > (p.data?.ytdBudget??0) ? '#7f1d1d' : '#166534',
        fontWeight: '600'
      }),
      valueFormatter:(p)=>fmt3(p.value)
    },
    { headerName:'Variance', field:'variance', width:150, type:'numericColumn',
      cellStyle:(p)=>({fontFamily:'monospace',fontSize:'12px',textAlign:'right',
        color:p.value>=0?'#166534':'#7f1d1d', fontWeight:'700'
      }),
      valueFormatter:(p)=>fmt3(p.value)
    },
    { headerName:'% vs Budget', field:'variancePct', width:200, sortable:true,
      cellRenderer:(p:ICellRendererParams<GridRow>) => {
        if (p.data?._rowType !== 'data') return <span className={clsx('font-mono text-xs font-bold',p.value>=0?'text-emerald-700':'text-red-600')}>{fmtPct(p.value)}</span>;
        return <VarianceBar pct={p.value} variance={p.data.variance}/>;
      }
    },
  ], []);

  const getRowClass = useCallback((p: RowClassParams<GridRow>) => {
    if (!p.data) return '';
    if (p.data._rowType === 'grandtotal') return 'ag-row-grandtotal';
    if (p.data._rowType === 'subtotal')   return 'ag-row-bva-sub';
    return '';
  }, []);

  const getRowHeight = useCallback((p:any) => { const r: GridRow = p.data; if (r?._rowType==='grandtotal') return 40; if (r?._rowType==='subtotal') return 34; return 32; }, []);

  const handleExport = () => {
    if (!rows.length) return;
    const boldSet = new Set(rows.map((r,i)=>r._rowType!=='data'?i:-1).filter(i=>i>=0));
    downloadExcel([{
      sheetName:`BvA ${runParams?.fiscalYear??''}`,
      headers:['Code','Account','Cost Center','Annual Budget','YTD Budget','YTD Actual','Variance','% vs Budget'],
      rows:rows.map((r,i)=>({ cells:[r.accountCode,r.accountName,r.costCenterName??'',r.annualBudget||null,r.ytdBudget||null,r.ytdActual||null,r.variance||null,r.variancePct??null], bold:boldSet.has(i), isCurrency:[false,false,false,true,true,true,true,false] })),
      currencyColIndices:[3,4,5,6],
      colWidths:[10,40,18,16,16,16,16,12],
    }], `Budget_vs_Actual_FY${runParams?.fiscalYear??currentYear}`);
  };

  // Summary stats
  const summary = useMemo(() => {
    if (!data?.length) return null;
    const grandRow = rows.find(r => r._rowType === 'grandtotal');
    if (!grandRow) return null;
    const pctUsed = grandRow.ytdBudget ? (grandRow.ytdActual / grandRow.ytdBudget) * 100 : 0;
    return { budget: grandRow.ytdBudget, actual: grandRow.ytdActual, variance: grandRow.variance, pctUsed };
  }, [rows, data]);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      <style>{`
        .ag-row-bva-sub { background-color: #f1f5f9 !important; font-weight: 600; }
        .ag-row-grandtotal { background-color: #1F4E79 !important; color: white !important; font-weight: 700; font-size: 13px; }
        .ag-row-grandtotal .ag-cell { color: white !important; }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79]">Budget vs Actual</h1>
          <p className="text-sm text-gray-500 mt-0.5">YTD performance against approved budget</p>
        </div>
        <button onClick={handleExport} disabled={!rows.length}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40">
          <Download size={14}/> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-end gap-4">
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Fiscal Year</label>
          <select value={fiscalYear} onChange={e=>setFiscalYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]">
            {[currentYear-1, currentYear, currentYear+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">From Period</label>
          <select value={periodFrom} onChange={e=>setPeriodFrom(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]">
            {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">To Period</label>
          <select value={periodTo} onChange={e=>setPeriodTo(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]">
            {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <button onClick={()=>setRunParams({fiscalYear,periodFrom,periodTo})} disabled={isFetching}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1F4E79] text-white rounded text-sm hover:bg-[#163a5c] disabled:opacity-60">
          {isFetching?<><Loader2 size={14} className="animate-spin"/> Running…</>:<><RefreshCw size={14}/> Run Report</>}
        </button>
      </div>

      {/* KPI tiles */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:'YTD Budget',   val:fmt3(summary.budget),                 color:'bg-blue-50 border-blue-200',   text:'text-blue-800' },
            { label:'YTD Actual',   val:fmt3(summary.actual),                 color:'bg-indigo-50 border-indigo-200', text:'text-indigo-800' },
            { label:'Variance',     val:fmt3(Math.abs(summary.variance)),     color:summary.variance>=0?'bg-green-50 border-green-200':'bg-red-50 border-red-200', text:summary.variance>=0?'text-green-800':'text-red-800' },
            { label:'% Budget Used',val:`${summary.pctUsed.toFixed(1)}%`,     color:summary.pctUsed>100?'bg-red-50 border-red-200':summary.pctUsed>80?'bg-amber-50 border-amber-200':'bg-emerald-50 border-emerald-200', text:summary.pctUsed>100?'text-red-800':summary.pctUsed>80?'text-amber-800':'text-emerald-800' },
          ].map(t => (
            <div key={t.label} className={`rounded-lg border p-3 ${t.color}`}>
              <p className="text-xs text-gray-500 mb-1">{t.label}</p>
              <p className={`text-lg font-bold font-mono ${t.text}`}>{t.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 min-h-0 ag-theme-alpine rounded-lg overflow-hidden border border-gray-200">
        {!runParams ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select fiscal year / period and click "Run Report"</div>
        ) : (
          <AgGridReact<GridRow> ref={gridRef} rowData={rows} columnDefs={colDefs}
            getRowClass={getRowClass} getRowHeight={getRowHeight}
            suppressCellFocus suppressRowClickSelection animateRows={false} rowBuffer={20}
            defaultColDef={{sortable:true,resizable:true,suppressMenu:true}}/>
        )}
      </div>
    </div>
  );
}
