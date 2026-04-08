import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useAdjustmentList } from '../../../api/inventory';
import { format } from 'date-fns';

const COLUMNS: ColDef<any>[] = [
  { field: 'docNo', headerName: 'Adj No', width: 140, pinned: 'left' },
  { field: 'docDate', headerName: 'Date', width: 110, valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
  { field: 'warehouse.name', headerName: 'Warehouse', flex: 1, minWidth: 140, valueGetter: (p) => p.data?.warehouse?.name ?? '' },
  { field: 'reason.name', headerName: 'Reason', width: 160, valueGetter: (p) => p.data?.reason?.name ?? '' },
  { field: '_lines', headerName: 'Lines', width: 70, type: 'numericColumn', valueGetter: (p) => p.data?.lines?.length ?? 0 },
  {
    field: '_variance', headerName: 'Total Variance Value', width: 160, type: 'numericColumn',
    valueGetter: (p) => (p.data?.lines ?? []).reduce((s: number, l: any) => s + Math.abs(Number(l.varianceQty ?? 0)) * Number(l.avgCost ?? 0), 0),
    valueFormatter: (p) => Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }),
  },
  { field: 'status', headerName: 'Status', width: 110, cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} /> },
];

export default function AdjustmentListPage() {
  const navigate = useNavigate();
  const [status, setStatus]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const { data, isLoading, refetch } = useAdjustmentList({ status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 200 });
  const rows: any[] = (data as any)?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-800">Stock Adjustments</h1>
        <div className="flex items-center gap-2">
          <button className="toolbar-btn" onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="toolbar-btn bg-[#1F4E79] text-white hover:bg-[#163D5F]" onClick={() => navigate('/inventory/adjustment/new')}>
            <Plus size={13} /> New Adjustment
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="erp-input w-36">
          <option value="">All Statuses</option>
          {['DRAFT','SUBMITTED','APPROVED','POSTED','CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="erp-input w-36" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="erp-input w-36" />
        <span className="text-xs text-gray-400 ml-auto">{rows.length} records</span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={rows} columnDefs={COLUMNS} loading={isLoading}
          onRowDoubleClicked={(e) => navigate(`/inventory/adjustment/${e.data.id}`)} />
      </div>
    </div>
  );
}
