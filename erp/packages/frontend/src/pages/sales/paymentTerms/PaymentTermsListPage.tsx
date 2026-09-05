import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { usePaymentTerms, type PaymentTerm } from '../../../api/salesMasters';

const MODE_LABEL: Record<string, string> = {
  NORMAL: 'Normal',
  ADVANCE: 'Advance',
  CASH_ON_DELIVERY: 'Cash on Delivery',
  CREDIT: 'Credit',
};
const BASIS_LABEL: Record<string, string> = {
  DOCUMENT_DATE: 'Document Date',
  DELIVERY_DATE: 'Delivery Date',
  MONTH_END: 'Month End',
  INVOICE_DATE: 'Invoice Date',
};

const COLUMNS: ColDef<PaymentTerm>[] = [
  { field: 'code', headerName: 'Code', width: 120, pinned: 'left' },
  { field: 'name', headerName: 'Description', flex: 2, minWidth: 220 },
  { field: 'paymentMode', headerName: 'Payment Mode', width: 150, valueFormatter: (p) => MODE_LABEL[p.value as string] ?? p.value },
  { field: 'dueDateBasis', headerName: 'Due Date Basis', width: 150, valueFormatter: (p) => BASIS_LABEL[p.value as string] ?? p.value },
  { field: 'creditDays', headerName: 'Credit Days', width: 120, type: 'numericColumn' },
  {
    field: 'lines', headerName: 'Instalments', width: 120, type: 'numericColumn',
    valueFormatter: (p) => String((p.value as unknown[] | undefined)?.length ?? 0),
  },
  {
    field: 'isActive', headerName: 'Status', width: 100,
    cellRenderer: (p: { value: boolean }) => (p.value ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />),
  },
];

export default function PaymentTermsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch } = usePaymentTerms({ search: search || undefined });

  const handleRowDoubleClick = useCallback(
    (row: PaymentTerm) => navigate(`/sales/payment-terms/${row.id}`),
    [navigate],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Payment Terms</h2>
        <span className="text-xs text-gray-400">({data?.length ?? 0})</span>
        <div className="flex-1" />
        <input
          type="text"
          placeholder="Search payment terms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="erp-input w-52"
        />
        <button onClick={() => refetch()} className="toolbar-btn" title="Refresh"><RefreshCw size={13} /></button>
        <button
          onClick={() => navigate('/sales/payment-terms/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} /><span>New Payment Term</span>
        </button>
      </div>

      <div className="flex-1 p-4">
        <DataGrid<PaymentTerm>
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
