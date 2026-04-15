import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { useApPaymentList } from '../../../api/finance';

const COLUMNS: ColDef<any>[] = [
  {
    field: 'docNo',
    headerName: 'Payment No',
    width: 145,
    pinned: 'left',
    cellRenderer: (p: any) => (
      <span className="font-mono text-xs text-blue-700 font-medium">{p.value}</span>
    ),
  },
  {
    field: 'supplierName',
    headerName: 'Supplier',
    flex: 2,
    minWidth: 160,
  },
  {
    field: 'paymentDate',
    headerName: 'Payment Date',
    width: 120,
    valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '',
  },
  {
    field: 'paymentMethod',
    headerName: 'Method',
    width: 130,
    cellRenderer: (p: any) => {
      const map: Record<string, string> = {
        BANK_TRANSFER: 'Bank Transfer',
        CHEQUE:        'Cheque',
        CASH:          'Cash',
      };
      return (
        <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium">
          {map[p.value] ?? p.value}
        </span>
      );
    },
  },
  {
    field: 'amount',
    headerName: 'Amount',
    width: 130,
    type: 'numericColumn',
    cellRenderer: (p: any) => (
      <span className="font-semibold text-[#1F4E79] tabular-nums">
        {p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }) : ''}
      </span>
    ),
  },
  {
    field: 'notes',
    headerName: 'Reference / Notes',
    flex: 2,
    minWidth: 150,
    cellRenderer: (p: any) => p.value ? (
      <span className="text-gray-500 text-xs truncate">{p.value}</span>
    ) : null,
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 100,
    cellRenderer: (p: any) => (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
        p.value === 'POSTED' ? 'bg-green-100 text-green-700' :
        p.value === 'VOID'   ? 'bg-red-100 text-red-700' :
        'bg-gray-100 text-gray-600'
      }`}>
        {p.value}
      </span>
    ),
  },
  {
    field: 'createdAt',
    headerName: 'Posted',
    width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '',
  },
];

export default function ApPaymentListPage() {
  const navigate = useNavigate();
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [supplierId,  setSupplierId]  = useState('');

  const { data, isLoading, refetch } = useApPaymentList({
    dateFrom:   dateFrom   || undefined,
    dateTo:     dateTo     || undefined,
    supplierId: supplierId || undefined,
    page: 1, limit: 200,
  });

  const handleRowDoubleClick = useCallback(
    (row: any) => { /* read-only for now — payments can't be edited once posted */ },
    [],
  );

  const handleExport = () => {
    const rows = data?.data ?? [];
    const csv = [
      ['Payment No', 'Supplier', 'Payment Date', 'Method', 'Amount', 'Notes', 'Status'],
      ...rows.map((r: any) => [r.docNo, r.supplierName, r.paymentDate, r.paymentMethod, r.amount, r.notes ?? '', r.status]),
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'ap-payments.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-800">AP Payments</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />
        <label className="text-xs text-gray-500">From</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="erp-input w-36" />
        <label className="text-xs text-gray-500">To</label>
        <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className="erp-input w-36" />
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        <button onClick={handleExport}    className="toolbar-btn"><Download  size={13} /><span>Export</span></button>
        <button
          onClick={() => navigate('/finance/ap/payments/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} /><span>New Payment</span>
        </button>
      </div>

      {/* Grid */}
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
