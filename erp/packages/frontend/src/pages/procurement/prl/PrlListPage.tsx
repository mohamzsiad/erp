import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Download } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { usePrlList } from '../../../api/procurement';
import type { PurchaseRequisition } from '@clouderp/shared';
import { format } from 'date-fns';

const COLUMNS: ColDef<PurchaseRequisition>[] = [
  { field: 'docNo', headerName: 'Doc No', width: 150, pinned: 'left' },
  {
    field: 'docDate', headerName: 'Date', width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
  {
    field: 'deliveryDate', headerName: 'Delivery Date', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
  {
    field: 'mrl', headerName: 'MRL Ref', width: 140,
    valueFormatter: (p) => (p.value as { docNo: string } | null)?.docNo ?? '',
  },
  { field: 'remarks', headerName: 'Remarks', flex: 2, minWidth: 200 },
  {
    field: 'status', headerName: 'Status', width: 130,
    cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} />,
  },
  {
    field: 'createdAt', headerName: 'Created', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
];

const STATUS_OPTIONS = ['DRAFT', 'APPROVED', 'ENQUIRY_SENT', 'PO_CREATED', 'SHORT_CLOSED', 'CLOSED'];

export default function PrlListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, refetch } = usePrlList({
    page: 1,
    limit: 50,
    search: search || undefined,
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleRowDoubleClick = useCallback(
    (row: PurchaseRequisition) => navigate(`/procurement/prl/${row.id}`),
    [navigate]
  );

  const handleExport = () => {
    const rows = data?.data ?? [];
    const csv = [
      ['Doc No', 'Date', 'Delivery Date', 'MRL Ref', 'Status'],
      ...rows.map((r) => [r.docNo, r.docDate, r.deliveryDate, r.mrl?.docNo ?? '', r.status]),
    ]
      .map((row) => row.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prl-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Purchase Requisition List</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />

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
            className="erp-input w-40"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="erp-input w-36" title="From" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="erp-input w-36" title="To" />
        </div>

        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        <button onClick={handleExport} className="toolbar-btn"><Download size={13} /><span>Export</span></button>
        <button
          onClick={() => navigate('/procurement/prl/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} /><span>New PRL</span>
        </button>
      </div>

      <div className="flex-1 p-4">
        <DataGrid<PurchaseRequisition>
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
