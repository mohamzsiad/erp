import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useProgressBills, type ProgressBillRow } from '../../../api/progressBills';
import { format } from 'date-fns';

const money = (v: number | null | undefined) => (v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '');

const COLUMNS: ColDef<ProgressBillRow>[] = [
  { field: 'docNo', headerName: 'Doc No', width: 140, pinned: 'left' },
  { field: 'projectName', headerName: 'Project', flex: 2, minWidth: 200 },
  { field: 'period', headerName: 'Period', width: 120 },
  { field: 'billDate', headerName: 'Date', width: 120, valueFormatter: (p) => (p.value ? format(new Date(p.value as string), 'dd/MM/yyyy') : '') },
  { field: 'amount', headerName: 'This Bill', width: 130, type: 'numericColumn', valueFormatter: (p) => money(p.value) },
  { field: 'totalAmount', headerName: 'Total', width: 130, type: 'numericColumn', valueFormatter: (p) => money(p.value) },
  { field: 'status', headerName: 'Status', width: 120, cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} /> },
];

export default function ProgressBillsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, refetch } = useProgressBills({ search: search || undefined, status: status || undefined });
  const onRow = useCallback((r: ProgressBillRow) => navigate(`/sales/progress-bills/${r.id}`), [navigate]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Progress Bills (IPC)</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0})</span>
        <div className="flex-1" />
        <input className="erp-input w-52" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="erp-input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {['DRAFT', 'SUBMITTED', 'CERTIFIED', 'POSTED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        <button onClick={() => navigate('/sales/progress-bills/new')} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"><Plus size={13} /><span>New Progress Bill</span></button>
      </div>
      <div className="flex-1 p-4">
        <DataGrid<ProgressBillRow> rowData={data?.data ?? []} columnDefs={COLUMNS} height="100%" loading={isLoading} pagination pageSize={50} onRowDoubleClicked={onRow} getRowId={(r) => r.id} />
      </div>
    </div>
  );
}
