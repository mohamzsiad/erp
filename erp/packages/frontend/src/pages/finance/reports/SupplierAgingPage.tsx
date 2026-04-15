import React, { useState, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Download, RefreshCw, Loader2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { clsx } from 'clsx';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowClassParams, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useApAging } from '../../../api/finance';
import { downloadExcel } from '../../../utils/excelExport';

interface AgingInvoice {
  id:          string;
  docNo:       string;
  invoiceDate: string;
  dueDate:     string;
  totalAmount: number;
  paidAmount:  number;
  outstanding: number;
  daysOverdue: number;
}

interface AgingRow {
  supplierId:   string;
  supplierCode: string;
  supplierName: string;
  current:   number;
  days0_30:  number;
  days31_60: number;
  days61_90: number;
  over90:    number;
  total:     number;
  invoices:  AgingInvoice[];
}

const fmt3 = (n: number) => n ? n.toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3}) : '';
const fmtDate = (d: string | Date | null | undefined) => d ? format(new Date(d), 'dd/MM/yyyy') : '';

// ── Drill-down modal ──────────────────────────────────────────────────────────
function DrillDown({ row, onClose }: { row: AgingRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-[#1F4E79] text-lg">{row.supplierName}</h3>
            <p className="text-xs text-gray-500">{row.invoices.length} outstanding invoice{row.invoices.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full">
            <X size={18}/>
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                {['Invoice No','Invoice Date','Due Date','Days O/D','Total','Paid','Outstanding'].map(h => (
                  <th key={h} className={clsx('px-3 py-2 font-semibold text-gray-600', h!=='Invoice No'&&h!=='Invoice Date'&&h!=='Due Date' ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row.invoices.map((inv) => (
                <tr key={inv.id} className={clsx('border-b border-gray-100 hover:bg-gray-50',
                  inv.daysOverdue > 90 && 'bg-red-50',
                  inv.daysOverdue > 60 && inv.daysOverdue <= 90 && 'bg-orange-50',
                  inv.daysOverdue > 30 && inv.daysOverdue <= 60 && 'bg-yellow-50',
                )}>
                  <td className="px-3 py-1.5 font-mono text-[#1F4E79] font-medium">{inv.docNo}</td>
                  <td className="px-3 py-1.5">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-3 py-1.5">{fmtDate(inv.dueDate)}</td>
                  <td className={clsx('px-3 py-1.5 text-right font-semibold',
                    inv.daysOverdue <= 0  ? 'text-green-600' :
                    inv.daysOverdue <= 30 ? 'text-yellow-600' :
                    inv.daysOverdue <= 60 ? 'text-orange-600' : 'text-red-600')}>
                    {inv.daysOverdue <= 0 ? 'Current' : `${inv.daysOverdue}d`}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmt3(inv.totalAmount)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-500">{fmt3(inv.paidAmount)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-[#1F4E79]">{fmt3(inv.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                <td colSpan={4} className="px-3 py-2 text-sm">Total Outstanding</td>
                <td className="px-3 py-2 text-right font-mono text-sm">{fmt3(row.invoices.reduce((s,i)=>s+i.totalAmount,0))}</td>
                <td className="px-3 py-2 text-right font-mono text-sm">{fmt3(row.invoices.reduce((s,i)=>s+i.paidAmount,0))}</td>
                <td className="px-3 py-2 text-right font-mono text-sm font-bold text-[#1F4E79]">{fmt3(row.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SupplierAgingPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [asAt,      setAsAt]      = useState(today);
  const [runParams, setRunParams] = useState<any>(null);
  const [drillRow,  setDrillRow]  = useState<AgingRow | null>(null);
  const gridRef = useRef<AgGridReact<AgingRow>>(null);

  const { data, isFetching } = useApAging(
    { asAt: runParams?.asAt },
    !!runParams
  );

  // Build grid rows + summary row
  const rows = useMemo<AgingRow[]>(() => {
    if (!data?.lines) return [];
    return data.lines;
  }, [data]);

  const grandTotals = useMemo(() => {
    if (!rows.length) return null;
    return rows.reduce((a, r) => ({
      current:   a.current   + r.current,
      days0_30:  a.days0_30  + r.days0_30,
      days31_60: a.days31_60 + r.days31_60,
      days61_90: a.days61_90 + r.days61_90,
      over90:    a.over90    + r.over90,
      total:     a.total     + r.total,
    }), { current:0, days0_30:0, days31_60:0, days61_90:0, over90:0, total:0 });
  }, [rows]);

  const colDefs = useMemo<ColDef<AgingRow>[]>(() => [
    {
      headerName: 'Supplier',
      field: 'supplierName',
      flex: 3,
      minWidth: 200,
      pinned: 'left',
      cellRenderer: (p: ICellRendererParams<AgingRow>) => {
        const r = p.data!;
        return (
          <button
            onClick={() => setDrillRow(r)}
            className="flex items-center gap-1 text-[#1F4E79] hover:underline font-medium text-xs w-full text-left"
          >
            <ChevronRight size={12} className="shrink-0"/>
            <span className="text-gray-400 font-mono mr-1">{r.supplierCode}</span>
            {r.supplierName}
          </button>
        );
      },
    },
    {
      headerName: 'Current',
      field: 'current',
      width: 130,
      type: 'numericColumn',
      cellStyle: { fontFamily: 'monospace', fontSize: '12px', color: '#166534', textAlign: 'right' },
      valueFormatter: (p) => fmt3(p.value),
    },
    {
      headerName: '1–30 Days',
      field: 'days0_30',
      width: 130,
      type: 'numericColumn',
      cellStyle: { fontFamily: 'monospace', fontSize: '12px', textAlign: 'right', color: '#854d0e' },
      valueFormatter: (p) => fmt3(p.value),
    },
    {
      headerName: '31–60 Days',
      field: 'days31_60',
      width: 130,
      type: 'numericColumn',
      cellStyle: (p) => ({
        fontFamily: 'monospace', fontSize: '12px', textAlign: 'right',
        backgroundColor: p.value > 0 ? '#fef9c3' : undefined,
        color: p.value > 0 ? '#713f12' : '#374151',
        fontWeight: p.value > 0 ? '600' : '400',
      }),
      valueFormatter: (p) => fmt3(p.value),
    },
    {
      headerName: '61–90 Days',
      field: 'days61_90',
      width: 130,
      type: 'numericColumn',
      cellStyle: (p) => ({
        fontFamily: 'monospace', fontSize: '12px', textAlign: 'right',
        backgroundColor: p.value > 0 ? '#fed7aa' : undefined,
        color: p.value > 0 ? '#7c2d12' : '#374151',
        fontWeight: p.value > 0 ? '600' : '400',
      }),
      valueFormatter: (p) => fmt3(p.value),
    },
    {
      headerName: '> 90 Days',
      field: 'over90',
      width: 130,
      type: 'numericColumn',
      cellStyle: (p) => ({
        fontFamily: 'monospace', fontSize: '12px', textAlign: 'right',
        backgroundColor: p.value > 0 ? '#fee2e2' : undefined,
        color: p.value > 0 ? '#7f1d1d' : '#374151',
        fontWeight: p.value > 0 ? '700' : '400',
      }),
      valueFormatter: (p) => fmt3(p.value),
    },
    {
      headerName: 'Total',
      field: 'total',
      width: 150,
      type: 'numericColumn',
      pinned: 'right',
      cellStyle: { fontFamily: 'monospace', fontSize: '12px', textAlign: 'right', fontWeight: '700', color: '#1F4E79' },
      valueFormatter: (p) => fmt3(p.value),
    },
  ], []);

  const handleExport = () => {
    if (!rows.length) return;
    const allRows = [
      ...rows.map(r => ({ cells:[r.supplierCode,r.supplierName,r.current||null,r.days0_30||null,r.days31_60||null,r.days61_90||null,r.over90||null,r.total||null], bold:false, isCurrency:[false,false,true,true,true,true,true,true] })),
    ];
    if (grandTotals) allRows.push({ cells:['','TOTAL',grandTotals.current||null,grandTotals.days0_30||null,grandTotals.days31_60||null,grandTotals.days61_90||null,grandTotals.over90||null,grandTotals.total||null], bold:true, isCurrency:[false,false,true,true,true,true,true,true] });
    downloadExcel([{
      sheetName: `AP Aging ${runParams?.asAt??''}`,
      headers:['Code','Supplier','Current','1-30 Days','31-60 Days','61-90 Days','>90 Days','Total'],
      rows: allRows,
      currencyColIndices:[2,3,4,5,6,7],
      colWidths:[10,35,16,16,16,16,16,18],
    }], `AP_Aging_${runParams?.asAt??today}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      {drillRow && <DrillDown row={drillRow} onClose={() => setDrillRow(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79]">Supplier Aging</h1>
          <p className="text-sm text-gray-500 mt-0.5">Accounts Payable — Outstanding Invoice Aging</p>
        </div>
        <button onClick={handleExport} disabled={!rows.length}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40">
          <Download size={14}/> Export Excel
        </button>
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
        <span className="text-xs text-gray-400 self-center">Click a supplier row to see invoice detail</span>
      </div>

      {/* Bucket legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 inline-block"/> Current (not yet due)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 inline-block border border-yellow-300"/> 31–60 days overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-200 inline-block"/> 61–90 days overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 inline-block"/> &gt;90 days overdue</span>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 ag-theme-alpine rounded-lg overflow-hidden border border-gray-200">
        {!runParams ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a date and click "Run Report"</div>
        ) : (
          <AgGridReact<AgingRow>
            ref={gridRef}
            rowData={rows}
            columnDefs={colDefs}
            suppressCellFocus suppressRowClickSelection animateRows={false} rowBuffer={20}
            defaultColDef={{ sortable:true, resizable:true, suppressMenu:true }}
            rowHeight={32}
          />
        )}
      </div>

      {/* Summary bar */}
      {grandTotals && (
        <div className="bg-[#1F4E79] text-white rounded-lg px-4 py-2.5 grid grid-cols-7 text-xs font-semibold">
          <span className="col-span-1">TOTALS ({rows.length} suppliers)</span>
          <span className="text-right text-green-200">{fmt3(grandTotals.current)}</span>
          <span className="text-right text-yellow-200">{fmt3(grandTotals.days0_30)}</span>
          <span className="text-right text-orange-200">{fmt3(grandTotals.days31_60)}</span>
          <span className="text-right text-red-300">{fmt3(grandTotals.days61_90)}</span>
          <span className="text-right text-red-400">{fmt3(grandTotals.over90)}</span>
          <span className="text-right text-white font-bold">{fmt3(grandTotals.total)}</span>
        </div>
      )}
    </div>
  );
}
