import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { useBinList } from '../../../api/inventory';

const COLUMNS: ColDef<any>[] = [
  { field: 'warehouse.name', headerName: 'Warehouse', width: 150, valueGetter: (p) => p.data?.warehouse?.name ?? '' },
  { field: 'code', headerName: 'Bin Code', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Bin Name', flex: 1, minWidth: 160 },
  { field: 'zone', headerName: 'Zone', width: 90 },
  { field: 'aisle', headerName: 'Aisle', width: 80 },
  { field: 'rack', headerName: 'Rack', width: 80 },
  { field: 'level', headerName: 'Level', width: 80 },
  {
    field: 'maxWeight', headerName: 'Max Weight', width: 110, type: 'numericColumn',
    valueFormatter: (p) => p.value ? Number(p.value).toLocaleString() : '',
  },
  {
    field: 'isActive', headerName: 'Active', width: 90,
    cellRenderer: (p: { value: boolean }) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {p.value ? 'Active' : 'Inactive'}
      </span>
    ),
  },
];

export default function BinListPage() {
  const navigate = useNavigate();
  const [search, setSearch]           = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const { data, isLoading, refetch } = useBinList({ search: search || undefined, warehouseId: warehouseId || undefined, limit: 200 });
  const rows: any[] = (data as any)?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-800">Bin Master</h1>
        <div className="flex items-center gap-2">
          <button className="toolbar-btn" onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="toolbar-btn bg-[#1F4E79] text-white hover:bg-[#163D5F]" onClick={() => navigate('/inventory/bins/new')}>
            <Plus size={13} /> New Bin
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <input type="text" placeholder="Search bin code…" value={search} onChange={(e) => setSearch(e.target.value)} className="erp-input w-48" />
        <span className="text-xs text-gray-400 ml-auto">{rows.length} bins</span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={rows} columnDefs={COLUMNS} loading={isLoading}
          onRowDoubleClicked={(e) => navigate(`/inventory/bins/${e.data.id}`)} />
      </div>
    </div>
  );
}
