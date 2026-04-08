import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useGrnList } from '../../../api/inventory';
import { format } from 'date-fns';

const STATUS_OPTIONS = ['DRAFT', 'POSTED', 'CANCELLED'];

const COLUMNS: ColDef<any>[] = [
  { field: 'docNo', headerName: 'GRN No', width: 140, pinned: 'left' },
  { field: 'docDate', headerName: 'Date', width: 110, valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
  { field: 'po.docNo', headerName: 'PO No', width: 130, valueGetter: (p) => p.data?.po?.docNo ?? '' },
  { field: 'supplier.name', headerName: 'Supplier', flex: 2, minWidth: 180, valueGetter: (p) => p.data?.po?.supplier?.name ?? '' },
  { field: 'warehouse.name', headerName: 'Warehouse', width: 140, valueGetter: (p) => p.data?.warehouse?.name ?? '' },
  {
    field: '_lines', headerName: 'Lines', width: 70, type: 'numericColumn',
    valueGetter: (p) => p.data?.lines?.length ?? 0,
  },
  {
    field: 'status', headerName: 'Status', width: 100,
    cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} />,
  },
  {
    field: 'postedAt', headerName: 'Posted', width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '',
  },
];

export default function GrnListPage() {
  const navigate = useNavigate();
  const [status, setStatus]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [search, setSearch]     = useState('');

  const { data, isLoading, refetch } = useGrnList({ status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, search: search || undefined, limit: 200 });
  const rows: any[] = (data as any)?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-800">Goods Receipt Notes</h1>
        <div className="flex items-center gap-2">
          <button className="toolbar-btn" onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="toolbar-btn bg-[#1F4E79] text-white hover:bg-[#163D5F]" onClick={() => navigate('/inventory/grn/new')}>
            <Plus size={13} /> New GRN
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
        <input type="text" placeholder="Search GRN / PO…" value={search} onChange={(e) => setSearch(e.target.value)} className="erp-input w-48" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="erp-input w-32">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="erp-input w-36" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="erp-input w-36" />
        <span className="text-xs text-gray-400 ml-auto">{rows.length} records</span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={rows} columnDefs={COLUMNS} loading={isLoading}
          onRowDoubleClicked={(e) => navigate(`/inventory/grn/${e.data.id}`)} />
      </div>
    </div>
  );
}
