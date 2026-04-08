import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { useWarehouseList } from '../../../api/inventory';

const COLUMNS: ColDef<any>[] = [
  { field: 'code', headerName: 'Code', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 2, minWidth: 180 },
  { field: 'location.name', headerName: 'Location', flex: 1, minWidth: 140, valueGetter: (p) => p.data?.location?.name ?? '' },
  { field: 'address', headerName: 'Address', flex: 2, minWidth: 200 },
  {
    field: 'isActive', headerName: 'Active', width: 90,
    cellRenderer: (p: { value: boolean }) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {p.value ? 'Active' : 'Inactive'}
      </span>
    ),
  },
  {
    field: '_bins', headerName: 'Bins', width: 80, type: 'numericColumn',
    valueGetter: (p) => p.data?.bins?.length ?? 0,
  },
];

export default function WarehouseListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useWarehouseList({ search: search || undefined, limit: 200 });
  const rows: any[] = (data as any)?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-800">Warehouse Master</h1>
        <div className="flex items-center gap-2">
          <button className="toolbar-btn" onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="toolbar-btn bg-[#1F4E79] text-white hover:bg-[#163D5F]" onClick={() => navigate('/inventory/warehouses/new')}>
            <Plus size={13} /> New Warehouse
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="erp-input w-56" />
        <span className="text-xs text-gray-400 ml-auto">{rows.length} warehouses</span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={rows} columnDefs={COLUMNS} loading={isLoading}
          onRowDoubleClicked={(e) => navigate(`/inventory/warehouses/${e.data.id}`)} />
      </div>
    </div>
  );
}
