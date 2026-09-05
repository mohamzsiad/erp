import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useSalesmen, type Salesman } from '../../../api/salesMasters';

const TYPE_LABEL: Record<string, string> = {
  SALESMAN: 'Salesman',
  SUPERVISOR: 'Supervisor',
  VAN_SALESMAN: 'Van Salesman',
  MANAGER: 'Manager',
};

const COLUMNS: ColDef<Salesman>[] = [
  { field: 'code', headerName: 'Code', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 2, minWidth: 220 },
  { field: 'type', headerName: 'Type', width: 130, valueFormatter: (p) => TYPE_LABEL[p.value as string] ?? p.value },
  { field: 'locationName', headerName: 'Sales & Delivery Location', width: 200, valueFormatter: (p) => (p.value as string | null) ?? '—' },
  {
    field: 'minMarkupPct', headerName: 'Min Markup %', width: 130, type: 'numericColumn',
    valueFormatter: (p) => (p.value != null ? Number(p.value).toFixed(3) : ''),
  },
  {
    field: 'maxVariancePct', headerName: 'Max Variance %', width: 140, type: 'numericColumn',
    valueFormatter: (p) => (p.value != null ? Number(p.value).toFixed(3) : ''),
  },
  { field: 'contactNumber', headerName: 'Contact', width: 130 },
  { field: 'customerCount', headerName: 'Customers', width: 110, type: 'numericColumn' },
  {
    field: 'isActive', headerName: 'Status', width: 100,
    cellRenderer: (p: { value: boolean }) => (p.value ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />),
  },
];

export default function SalesmenListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch } = useSalesmen({ search: search || undefined });

  const handleRowDoubleClick = useCallback(
    (row: Salesman) => navigate(`/sales/salesmen/${row.id}`),
    [navigate],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Salesman Master</h2>
        <span className="text-xs text-gray-400">({data?.length ?? 0})</span>
        <div className="flex-1" />
        <input
          type="text"
          placeholder="Search salesmen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="erp-input w-52"
        />
        <button onClick={() => refetch()} className="toolbar-btn" title="Refresh"><RefreshCw size={13} /></button>
        <button
          onClick={() => navigate('/sales/salesmen/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} /><span>New Salesman</span>
        </button>
      </div>

      <div className="flex-1 p-4">
        <DataGrid<Salesman>
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
