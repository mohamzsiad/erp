import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useQuotations, type QuotationRow } from '../../../api/salesDocs';
import { format } from 'date-fns';

const COLUMNS: ColDef<QuotationRow>[] = [
  { field: 'docNo', headerName: 'Doc No', width: 150, pinned: 'left' },
  { field: 'rev', headerName: 'Rev', width: 70, type: 'numericColumn' },
  { field: 'customerName', headerName: 'Customer', flex: 2, minWidth: 200 },
  { field: 'quotationDate', headerName: 'Date', width: 120, valueFormatter: (p) => (p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '') },
  { field: 'validTo', headerName: 'Valid To', width: 120, valueFormatter: (p) => (p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '') },
  { field: 'totalAmount', headerName: 'Total', width: 130, type: 'numericColumn', valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '') },
  { field: 'status', headerName: 'Status', width: 120, cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} /> },
];

export default function QuotationsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, refetch } = useQuotations({ search: search || undefined, status: status || undefined });
  const onRow = useCallback((r: QuotationRow) => navigate(`/sales/quotations/${r.id}`), [navigate]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Sales Quotations</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0})</span>
        <div className="flex-1" />
        <input className="erp-input w-52" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="erp-input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        <button onClick={() => navigate('/sales/quotations/new')} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"><Plus size={13} /><span>New Quotation</span></button>
      </div>
      <div className="flex-1 p-4">
        <DataGrid<QuotationRow> rowData={data?.data ?? []} columnDefs={COLUMNS} height="100%" loading={isLoading} pagination pageSize={50} onRowDoubleClicked={onRow} getRowId={(r) => r.id} />
      </div>
    </div>
  );
}
