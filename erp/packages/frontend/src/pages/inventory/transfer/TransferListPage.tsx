import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useTransferList } from '../../../api/inventory';
import { format } from 'date-fns';

const COLUMNS: ColDef<any>[] = [
  { field: 'docNo', headerName: 'Transfer No', width: 140, pinned: 'left' },
  { field: 'docDate', headerName: 'Date', width: 110, valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
  { field: 'fromWarehouse.name', headerName: 'From Warehouse', flex: 1, minWidth: 140, valueGetter: (p) => p.data?.fromWarehouse?.name ?? '' },
  { field: 'toWarehouse.name', headerName: 'To Warehouse', flex: 1, minWidth: 140, valueGetter: (p) => p.data?.toWarehouse?.name ?? '' },
  { field: '_lines', headerName: 'Lines', width: 70, type: 'numericColumn', valueGetter: (p) => p.data?.lines?.length ?? 0 },
  { field: 'status', headerName: 'Status', width: 100, cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} /> },
];

export default function TransferListPage() {
  const navigate = useNavigate();
  const [status, setStatus]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const { data, isLoading, refetch } = useTransferList({ status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 200 });
  const rows: any[] = (data as any)?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-800">Stock Transfers</h1>
        <div className="flex items-center gap-2">
          <button className="toolbar-btn" onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="toolbar-btn bg-[#1F4E79] text-white hover:bg-[#163D5F]" onClick={() => navigate('/inventory/transfer/new')}>
            <Plus size={13} /> New Transfer
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="erp-input w-32">
          <option value="">All Statuses</option>
          {['DRAFT','POSTED','CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="erp-input w-36" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="erp-input w-36" />
        <span className="text-xs text-gray-400 ml-auto">{rows.length} records</span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={rows} columnDefs={COLUMNS} loading={isLoading}
          onRowDoubleClicked={(e) => navigate(`/inventory/transfer/${e.data.id}`)} />
      </div>
    </div>
  );
}
