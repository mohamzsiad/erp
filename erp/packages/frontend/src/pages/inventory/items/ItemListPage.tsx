import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useItemList } from '../../../api/inventory';
import { format } from 'date-fns';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'OBSOLETE'];

const COLUMNS: ColDef<any>[] = [
  { field: 'code', headerName: 'Item Code', width: 130, pinned: 'left' },
  { field: 'description', headerName: 'Description', flex: 2, minWidth: 200 },
  { field: 'category.name', headerName: 'Category', width: 140, valueGetter: (p) => p.data?.category?.name ?? '' },
  { field: 'uom.code', headerName: 'UOM', width: 80, valueGetter: (p) => p.data?.uom?.code ?? '' },
  {
    field: 'status', headerName: 'Status', width: 100,
    cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} />,
  },
  {
    field: 'reorderLevel', headerName: 'Reorder Lvl', width: 110, type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3 }) : '',
  },
  {
    field: '_onHand', headerName: 'On Hand', width: 110, type: 'numericColumn',
    valueGetter: (p) => (p.data?.stockBalances ?? []).reduce((s: number, b: any) => s + Number(b.qtyOnHand ?? 0), 0),
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
    cellClass: (p) => {
      const onHand = p.value ?? 0;
      const reorder = Number(p.data?.reorderLevel ?? 0);
      return reorder > 0 && onHand <= reorder ? 'text-red-600 font-semibold' : '';
    },
  },
  {
    field: '_reserved', headerName: 'Reserved', width: 110, type: 'numericColumn',
    valueGetter: (p) => (p.data?.stockBalances ?? []).reduce((s: number, b: any) => s + Number(b.qtyReserved ?? 0), 0),
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
  },
  {
    field: '_avgCost', headerName: 'Avg Cost', width: 110, type: 'numericColumn',
    valueGetter: (p) => {
      const balances = p.data?.stockBalances ?? [];
      if (!balances.length) return 0;
      const totalQty = balances.reduce((s: number, b: any) => s + Number(b.qtyOnHand ?? 0), 0);
      if (!totalQty) return 0;
      return balances.reduce((s: number, b: any) => s + Number(b.qtyOnHand ?? 0) * Number(b.avgCost ?? 0), 0) / totalQty;
    },
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
  },
];

export default function ItemListPage() {
  const navigate = useNavigate();
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data, isLoading, refetch } = useItemList({ page: 1, limit: 200, search: search || undefined, status: status || undefined });
  const rows: any[] = (data as any)?.data ?? [];

  const handleRowDoubleClick = useCallback(
    (row: any) => navigate(`/inventory/items/${row.id}`),
    [navigate],
  );

  const handleExport = () => {
    const csv = [
      ['Code', 'Description', 'Category', 'UOM', 'Status', 'Reorder Lvl', 'On Hand', 'Reserved', 'Avg Cost'],
      ...rows.map((r) => [
        r.code, r.description, r.category?.name ?? '', r.uom?.code ?? '', r.status,
        r.reorderLevel ?? 0,
        (r.stockBalances ?? []).reduce((s: number, b: any) => s + Number(b.qtyOnHand), 0),
        (r.stockBalances ?? []).reduce((s: number, b: any) => s + Number(b.qtyReserved), 0),
        '',
      ]),
    ].map(row => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'items.csv' }).click();
    URL.revokeObjectURL(url);
  };

  const belowReorder = rows.filter((r) => {
    const onHand = (r.stockBalances ?? []).reduce((s: number, b: any) => s + Number(b.qtyOnHand), 0);
    return Number(r.reorderLevel ?? 0) > 0 && onHand <= Number(r.reorderLevel);
  }).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-800">Item Master</h1>
          {belowReorder > 0 && (
            <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              <AlertTriangle size={11} />
              {belowReorder} below reorder
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="toolbar-btn" onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="toolbar-btn" onClick={handleExport}><Download size={13} /> Export</button>
          <button className="toolbar-btn bg-[#1F4E79] text-white hover:bg-[#163D5F]" onClick={() => navigate('/inventory/items/new')}>
            <Plus size={13} /> New Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <input
          type="text" placeholder="Search code / description…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="erp-input w-56"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="erp-input w-36">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{rows.length} items</span>
      </div>

      {/* Grid */}
      <div className="flex-1">
        <DataGrid
          rowData={rows}
          columnDefs={COLUMNS}
          loading={isLoading}
          onRowDoubleClicked={(e) => handleRowDoubleClick(e.data)}
        />
      </div>
    </div>
  );
}
