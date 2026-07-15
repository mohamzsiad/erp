import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Download } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useCustomerList, type CustomerListRow } from '../../../api/sales';
import { format } from 'date-fns';

const COLUMNS: ColDef<CustomerListRow>[] = [
  { field: 'code', headerName: 'Code', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 2, minWidth: 220 },
  {
    field: 'type', headerName: 'Type', width: 110,
    valueFormatter: (p) => ({ COMPANY: 'Company', INDIVIDUAL: 'Individual', GOVERNMENT: 'Government' })[p.value as string] ?? p.value,
  },
  { field: 'trn', headerName: 'TRN', width: 140 },
  { field: 'categoryName', headerName: 'Category', width: 140 },
  { field: 'paymentTerms', headerName: 'Terms', width: 110 },
  {
    field: 'creditLimit', headerName: 'Credit Limit', width: 130, type: 'numericColumn',
    valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''),
  },
  {
    field: 'creditHold', headerName: 'Credit', width: 100,
    cellRenderer: (p: { value: boolean }) => (p.value ? <StatusBadge status="ON HOLD" /> : <StatusBadge status="OK" />),
  },
  {
    field: 'isActive', headerName: 'Status', width: 100,
    cellRenderer: (p: { value: boolean }) => (p.value ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="PENDING" />),
  },
  {
    field: 'createdAt', headerName: 'Created', width: 120,
    valueFormatter: (p) => (p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : ''),
  },
];

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [holdFilter, setHoldFilter] = useState<boolean | undefined>(undefined);

  const { data, isLoading, refetch } = useCustomerList({
    page: 1,
    limit: 50,
    search: search || undefined,
    isActive: activeFilter,
    creditHold: holdFilter,
  });

  const handleRowDoubleClick = useCallback(
    (row: CustomerListRow) => navigate(`/sales/customers/${row.id}`),
    [navigate],
  );

  const handleExport = () => {
    const rows = data?.data ?? [];
    const csv = [
      ['Code', 'Name', 'Type', 'TRN', 'Category', 'Terms', 'Credit Limit', 'Credit Hold', 'Status'],
      ...rows.map((r) => [
        r.code, r.name, r.type, r.trn ?? '', r.categoryName ?? '', r.paymentTerms ?? '',
        r.creditLimit, r.creditHold ? 'Hold' : 'OK', r.isActive ? 'Active' : 'Pending',
      ]),
    ].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Customer Master</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-input w-52"
          />
          <select
            value={activeFilter === undefined ? '' : String(activeFilter)}
            onChange={(e) => setActiveFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
            className="erp-input w-32"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Pending</option>
          </select>
          <select
            value={holdFilter === undefined ? '' : String(holdFilter)}
            onChange={(e) => setHoldFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
            className="erp-input w-36"
          >
            <option value="">All Credit</option>
            <option value="true">On Hold</option>
            <option value="false">Not Held</option>
          </select>
        </div>

        <button onClick={() => refetch()} className="toolbar-btn" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <button onClick={handleExport} className="toolbar-btn" title="Export CSV">
          <Download size={13} />
          <span>Export</span>
        </button>
        <button
          onClick={() => navigate('/sales/customers/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} />
          <span>New Customer</span>
        </button>
      </div>

      <div className="flex-1 p-4">
        <DataGrid<CustomerListRow>
          rowData={data?.data ?? []}
          columnDefs={COLUMNS}
          height="100%"
          loading={isLoading}
          pagination
          pageSize={50}
          onRowDoubleClicked={handleRowDoubleClick}
          getRowId={(row) => row.id}
        />
      </div>
    </div>
  );
}
