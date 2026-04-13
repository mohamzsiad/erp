import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useQuotationList } from '../../../api/procurement';
import type { PurchaseQuotation } from '@clouderp/shared';
import { format } from 'date-fns';

const COLUMNS: ColDef<PurchaseQuotation>[] = [
  { field: 'docNo', headerName: 'Quotation No', width: 150, pinned: 'left' },
  {
    field: 'supplier', headerName: 'Supplier', flex: 1, minWidth: 180,
    valueFormatter: (p) => {
      const s = p.value as { code?: string; name?: string } | undefined;
      return s ? `${s.code} – ${s.name}` : '';
    },
  },
  {
    field: 'enquiry', headerName: 'Enquiry Ref', width: 150,
    valueFormatter: (p) => (p.value as { docNo?: string } | undefined)?.docNo ?? '',
  },
  {
    field: 'validityDate', headerName: 'Valid Until', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
  {
    field: 'currency', headerName: 'Currency', width: 90,
    valueFormatter: (p) => (p.value as { code?: string } | undefined)?.code ?? '',
  },
  {
    field: 'totalAmount', headerName: 'Total Amount', width: 130,
    valueFormatter: (p) => Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }),
  },
  {
    field: 'status', headerName: 'Status', width: 120,
    cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} />,
  },
  {
    field: 'createdAt', headerName: 'Created', width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '',
  },
];

export default function QuotationListPage() {
  const navigate = useNavigate();
  const [page] = useState(1);

  const { data, isLoading, refetch } = useQuotationList({ page, limit: 100 });

  const handleRowDoubleClick = useCallback(
    (row: PurchaseQuotation) => navigate(`/procurement/quotations/${row.id}`),
    [navigate]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Supplier Quotations</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
      </div>

      <div className="flex-1 p-4">
        <DataGrid<PurchaseQuotation>
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
