import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useEnquiryList } from '../../../api/procurement';
import type { PurchaseEnquiry } from '@clouderp/shared';
import { format } from 'date-fns';

const COLUMNS: ColDef<PurchaseEnquiry>[] = [
  { field: 'docNo', headerName: 'Enquiry No', width: 150, pinned: 'left' },
  {
    field: 'docDate', headerName: 'Date', width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
  {
    field: 'prl', headerName: 'PRL Ref', width: 150,
    valueFormatter: (p) => (p.value as { docNo?: string })?.docNo ?? '',
  },
  {
    field: 'quotations', headerName: 'Suppliers', width: 80,
    valueFormatter: (p) => String((p.value as unknown[])?.length ?? 0),
  },
  {
    field: 'status', headerName: 'Status', width: 130,
    cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} />,
  },
  {
    field: 'createdAt', headerName: 'Created', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
];

const STATUS_OPTIONS = ['DRAFT', 'SENT', 'CLOSED'];

export default function RfqListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, refetch } = useEnquiryList({
    page: 1,
    limit: 100,
    status: statusFilter || undefined,
  });

  const handleRowDoubleClick = useCallback(
    (row: PurchaseEnquiry) => navigate(`/procurement/rfq/${row.id}`),
    [navigate]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Purchase Enquiries (RFQ)</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />
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
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
      </div>

      <div className="flex-1 p-4">
        <DataGrid<PurchaseEnquiry>
          rowData={data?.data ?? []}
          columnDefs={COLUMNS}
          height="100%"
          loading={isLoading}
          pagination
          pageSize={100}
          onRowDoubleClicked={handleRowDoubleClick}
          getRowId={(row) => row.id}
        />
      </div>
    </div>
  );
}
