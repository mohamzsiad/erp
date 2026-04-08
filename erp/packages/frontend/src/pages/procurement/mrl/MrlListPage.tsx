import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Download } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useMrlList } from '../../../api/procurement';
import type { MaterialRequisition } from '@clouderp/shared';
import { format } from 'date-fns';

const COLUMNS: ColDef<MaterialRequisition>[] = [
  { field: 'docNo', headerName: 'Doc No', width: 150, pinned: 'left' },
  {
    field: 'docDate', headerName: 'Date', width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
  {
    field: 'deliveryDate', headerName: 'Delivery Date', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
  { field: 'remarks', headerName: 'Remarks', flex: 2, minWidth: 200 },
  {
    field: 'status', headerName: 'Status', width: 110,
    cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} />,
  },
  {
    field: 'createdAt', headerName: 'Created', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
];

const STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CLOSED'];

export default function MrlListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, refetch } = useMrlList({
    page: 1,
    limit: 50,
    search: search || undefined,
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleRowDoubleClick = useCallback(
    (row: MaterialRequisition) => navigate(`/procurement/mrl/${row.id}`),
    [navigate]
  );

  const handleExport = () => {
    const rows = data?.data ?? [];
    const csv = [
      ['Doc No', 'Date', 'Delivery Date', 'Remarks', 'Status'],
      ...rows.map((r) => [
        r.docNo,
        r.docDate,
        r.deliveryDate,
        r.remarks ?? '',
        r.status,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mrl-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Material Requisition List</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-input w-44"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="erp-input w-36"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="erp-input w-36"
            title="Date From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="erp-input w-36"
            title="Date To"
          />
        </div>

        <button onClick={() => refetch()} className="toolbar-btn" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <button onClick={handleExport} className="toolbar-btn">
          <Download size={13} />
          <span>Export</span>
        </button>
        <button
          onClick={() => navigate('/procurement/mrl/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} />
          <span>New MRL</span>
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 p-4">
        <DataGrid<MaterialRequisition>
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
