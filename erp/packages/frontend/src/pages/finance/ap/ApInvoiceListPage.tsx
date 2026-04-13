import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Receipt, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SummaryTile } from '../../../components/ui/SummaryTile';
import { useApInvoiceList } from '../../../api/finance';

const COLUMNS: ColDef<any>[] = [
  { field: 'docNo',             headerName: 'Invoice No',      width: 140, pinned: 'left',
    cellRenderer: (p: any) => <span className="font-mono text-xs text-blue-700 font-medium">{p.value}</span> },
  { field: 'supplierName',      headerName: 'Supplier',        flex: 2, minWidth: 160 },
  { field: 'supplierInvoiceNo', headerName: 'Supplier Inv No', width: 140 },
  { field: 'invoiceDate',       headerName: 'Invoice Date',    width: 115,
    valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
  { field: 'dueDate',           headerName: 'Due Date',        width: 110,
    valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
  { field: 'totalAmount',       headerName: 'Total',           width: 120, type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }) : '' },
  { field: 'paidAmount',        headerName: 'Paid',            width: 110, type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }) : '' },
  { field: 'daysOverdue', headerName: 'Days Overdue', width: 115, type: 'numericColumn',
    cellRenderer: (p: any) => {
      const days = p.value as number;
      if (days <= 0) return <span className="text-green-600 text-xs font-medium">Current</span>;
      return <span className={`text-xs font-medium ${days > 60 ? 'text-red-600' : days > 30 ? 'text-amber-600' : 'text-yellow-600'}`}>{days} days</span>;
    },
  },
  { field: 'matchFlag', headerName: 'Match', width: 90,
    cellRenderer: (p: any) => p.value ? (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.value === 'MATCHED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {p.value}
      </span>
    ) : null },
  { field: 'status', headerName: 'Status', width: 110,
    cellRenderer: (p: any) => <StatusBadge status={p.value} /> },
];

const STATUS_OPTIONS = ['DRAFT', 'APPROVED', 'PARTIAL', 'PAID', 'CANCELLED'];

// Auto-refresh every 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000;

export default function ApInvoiceListPage() {
  const navigate = useNavigate();
  const [status, setStatus]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');

  const { data, isLoading, refetch } = useApInvoiceList({
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page: 1, limit: 200,
  });

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => refetch(), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [refetch]);

  // Compute aging tiles
  const agingTiles = React.useMemo(() => {
    const rows: any[] = data?.data ?? [];
    const buckets = { current: { count: 0, amount: 0 }, d30: { count: 0, amount: 0 }, d60: { count: 0, amount: 0 }, d90: { count: 0, amount: 0 } };
    for (const r of rows) {
      if (['CANCELLED', 'PAID'].includes(r.status)) continue;
      const outstanding = Number(r.totalAmount) - Number(r.paidAmount);
      const days = r.daysOverdue as number;
      if (days <= 0)       { buckets.current.count++; buckets.current.amount += outstanding; }
      else if (days <= 30) { buckets.d30.count++;     buckets.d30.amount    += outstanding; }
      else if (days <= 60) { buckets.d60.count++;     buckets.d60.amount    += outstanding; }
      else                 { buckets.d90.count++;     buckets.d90.amount    += outstanding; }
    }
    return buckets;
  }, [data]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3 });

  const handleRowDoubleClick = useCallback(
    (row: any) => navigate(`/finance/ap/invoices/${row.id}`),
    [navigate]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Aging Tiles */}
      <div className="grid grid-cols-4 gap-3 px-4 pt-3 pb-2 bg-gray-50 border-b border-gray-200">
        <SummaryTile
          title="Current"
          value={fmt(agingTiles.current.amount)}
          subtitle={`${agingTiles.current.count} invoice${agingTiles.current.count !== 1 ? 's' : ''}`}
          icon={<Receipt size={16} />}
          color="green"
        />
        <SummaryTile
          title="1–30 Days Overdue"
          value={fmt(agingTiles.d30.amount)}
          subtitle={`${agingTiles.d30.count} invoice${agingTiles.d30.count !== 1 ? 's' : ''}`}
          icon={<Clock size={16} />}
          color="amber"
        />
        <SummaryTile
          title="31–60 Days Overdue"
          value={fmt(agingTiles.d60.amount)}
          subtitle={`${agingTiles.d60.count} invoice${agingTiles.d60.count !== 1 ? 's' : ''}`}
          icon={<AlertTriangle size={16} />}
          color="red"
        />
        <SummaryTile
          title=">60 Days Overdue"
          value={fmt(agingTiles.d90.amount)}
          subtitle={`${agingTiles.d90.count} invoice${agingTiles.d90.count !== 1 ? 's' : ''}`}
          icon={<XCircle size={16} />}
          color="red"
        />
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">AP Invoices</h2>
        <span className="text-xs text-gray-400">({data?.total ?? 0} records)</span>
        <div className="flex-1" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="erp-input w-36">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="erp-input w-36" />
        <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className="erp-input w-36" />
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
        <button
          onClick={() => navigate('/finance/ap/invoices/new')}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          <Plus size={13} /><span>New Invoice</span>
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
