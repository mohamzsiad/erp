import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { usePriceLists, type PriceListRow, type PriceListKind } from '../../../api/sales';
import { format } from 'date-fns';

const COLUMNS: ColDef<PriceListRow>[] = [
  { field: 'code', headerName: 'Code', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Description', flex: 2, minWidth: 220 },
  {
    field: 'type', headerName: 'Type', width: 160,
    valueFormatter: (p) => (p.value === 'CUSTOMER_SPECIFIC' ? 'Customer Specific' : 'Standard'),
  },
  {
    field: 'ownerCustomerName', headerName: 'Customer', width: 200,
    valueFormatter: (p) => (p.value as string | null) ?? '—',
  },
  { field: 'currencyCode', headerName: 'Currency', width: 100 },
  { field: 'itemCount', headerName: 'Items', width: 90, type: 'numericColumn' },
  { field: 'assignedCount', headerName: 'Attached To', width: 120, type: 'numericColumn' },
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
  const [typeFilter, setTypeFilter] = useState<PriceListKind | ''>('');
  const { data, isLoading, refetch } = usePriceLists({
    search: search || undefined,
    type: typeFilter || undefined,
  });

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
        <select className="erp-input w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as PriceListKind | '')}>
          <option value="">All types</option>
          <option value="STANDARD">Standard</option>
          <option value="CUSTOMER_SPECIFIC">Customer Specific</option>
        </select>
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
