import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useJournalList } from '../../../api/finance';

const COLUMNS: ColDef<any>[] = [
  { field: 'docNo',        headerName: 'Journal No',   width: 140, pinned: 'left',
    cellRenderer: (p: any) => <span className="font-mono text-xs text-blue-700 font-medium">{p.value}</span> },
  { field: 'entryDate',    headerName: 'Entry Date',   width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
  { field: 'description',  headerName: 'Description',  flex: 3, minWidth: 200 },
  { field: 'sourceModule', headerName: 'Source',       width: 110,
    cellRenderer: (p: any) => p.value ? (
      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{p.value}</span>
    ) : null },
  { field: 'totalDebit',   headerName: 'Total Debit',  width: 130, type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }) : '' },
  { field: 'totalCredit',  headerName: 'Total Credit', width: 130, type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }) : '' },
  { field: 'status', headerName: 'Status', width: 110,
    cellRenderer: (p: any) => <StatusBadge status={p.value} /> },
  { field: 'createdAt', headerName: 'Created', width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
];

const STATUS_OPTIONS = ['DRAFT', 'POSTED', 'REVERSED'];

export default function JournalListPage() {
  const navigate = useNavigate();
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');

  const { data, isLoading, refetch } = useJournalList({
    search: search || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page: 1, limit: 100,
  });

  const handleRowDoubleClick = useCallback(
    (row: any) => navigate(`/finance/journals/${row.id}`),
    [navigate]
  );

  const handleExport = () => {
    const rows = data?.data ?? [];
    const csv = [
      ['Journal No', 'Entry Date', 'Description', 'Source', 'Total Debit', 'Total Credit', 'Status'],
      ...rows.map((r: any) => [r.docNo, r.entryDate, r.description, r.sourceModule, r.totalDebit, r.totalCredit, r.status]),
    ].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'journals.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-800">Journal Entries</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />
        <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="erp-input w-40" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="erp-input w-32">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="erp-input w-36" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="erp-input w-36" />
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        <button onClick={handleExport} className="toolbar-btn"><Download size={13} /><span>Export</span></button>
        <button
          onClick={() => navigate('/finance/journals/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} /><span>New Journal</span>
        </button>
      </div>
      <div className="flex-1 p-4">
        <DataGrid
          rowData={data?.data ?? []}
          columnDefs={COLUMNS}
          height="100%"
          loading={isLoading}
          pagination
          pageSize={50}
          onRowDoubleClicked={handleRowDoubleClick}
          getRowId={(r) => r.id}
        />
      </div>
    </div>
  );
}
