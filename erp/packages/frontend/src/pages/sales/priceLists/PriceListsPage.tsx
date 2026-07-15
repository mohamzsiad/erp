import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { usePriceLists, type PriceListRow } from '../../../api/sales';
import { format } from 'date-fns';

const COLUMNS: ColDef<PriceListRow>[] = [
  { field: 'name', headerName: 'Name', flex: 2, minWidth: 220, pinned: 'left' },
  { field: 'itemCount', headerName: 'Items', width: 90, type: 'numericColumn' },
  {
    field: 'isDefault', headerName: 'Default', width: 100,
    cellRenderer: (p: { value: boolean }) => (p.value ? <StatusBadge status="DEFAULT" /> : <span className="text-gray-300">—</span>),
  },
  {
    field: 'isActive', headerName: 'Status', width: 100,
    cellRenderer: (p: { value: boolean }) => (p.value ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />),
  },
  {
    field: 'validFrom', headerName: 'Valid From', width: 120,
    valueFormatter: (p) => (p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : ''),
  },
  {
    field: 'validTo', headerName: 'Valid To', width: 120,
    valueFormatter: (p) => (p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : ''),
  },
];

export default function PriceListsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch } = usePriceLists({ search: search || undefined });

  const handleRowDoubleClick = useCallback(
    (row: PriceListRow) => navigate(`/sales/price-lists/${row.id}`),
    [navigate],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Price Lists</h2>
        <span className="text-xs text-gray-400">({data?.length ?? 0})</span>
        <div className="flex-1" />
        <input
          type="text"
          placeholder="Search price lists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="erp-input w-52"
        />
        <button onClick={() => refetch()} className="toolbar-btn" title="Refresh"><RefreshCw size={13} /></button>
        <button
          onClick={() => navigate('/sales/price-lists/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} /><span>New Price List</span>
        </button>
      </div>

      <div className="flex-1 p-4">
        <DataGrid<PriceListRow>
          rowData={data ?? []}
          columnDefs={COLUMNS}
          height="100%"
          loading={isLoading}
          onRowDoubleClicked={handleRowDoubleClick}
          getRowId={(row) => row.id}
        />
      </div>
    </div>
  );
}
