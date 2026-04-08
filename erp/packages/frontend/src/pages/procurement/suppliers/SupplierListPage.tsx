import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Download } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useSupplierList } from '../../../api/procurement';
import type { Supplier } from '@clouderp/shared';
import { format } from 'date-fns';

const COLUMNS: ColDef<Supplier>[] = [
  { field: 'code', headerName: 'Code', width: 130, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 2, minWidth: 200 },
  { field: 'shortName', headerName: 'Short Name', flex: 1, minWidth: 120 },
  { field: 'creditDays', headerName: 'Credit Days', width: 110, type: 'numericColumn' },
  { field: 'creditAmount', headerName: 'Credit Amt', width: 120, type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? p.value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '' },
  {
    field: 'shipmentMode', headerName: 'Ship Mode', width: 110,
    valueFormatter: (p) => ({ NA: 'N/A', AIR: 'Air', SEA: 'Sea', LAND: 'Land' })[p.value as string] ?? p.value,
  },
  {
    field: 'isActive', headerName: 'Status', width: 90,
    cellRenderer: (p: { value: boolean }) =>
      p.value
        ? <StatusBadge status="ACTIVE" />
        : <StatusBadge status="INACTIVE" />,
  },
  {
    field: 'createdAt', headerName: 'Created', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
];

export default function SupplierListPage() {
  const navigate = useNavigate();
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const { data, isLoading, refetch } = useSupplierList({
    page,
    limit: 50,
    search: search || undefined,
    isActive: activeFilter,
  });

  const handleRowDoubleClick = useCallback(
    (row: Supplier) => navigate(`/procurement/suppliers/${row.id}`),
    [navigate]
  );

  const handleExport = () => {
    const rows = data?.data ?? [];
    const csv = [
      ['Code', 'Name', 'Short Name', 'Credit Days', 'Credit Amount', 'Status'],
      ...rows.map((r) => [r.code, r.name, r.shortName, r.creditDays, r.creditAmount, r.isActive ? 'Active' : 'Inactive']),
    ]
      .map((row) => row.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Supplier Master</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search suppliers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-input w-52"
          />
          <select
            value={activeFilter === undefined ? '' : String(activeFilter)}
            onChange={(e) => setActiveFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
            className="erp-input w-36"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {/* Actions */}
        <button onClick={() => refetch()} className="toolbar-btn" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <button onClick={handleExport} className="toolbar-btn" title="Export CSV">
          <Download size={13} />
          <span>Export</span>
        </button>
        <button
          onClick={() => navigate('/procurement/suppliers/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} />
          <span>New Supplier</span>
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 p-4">
        <DataGrid<Supplier>
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
