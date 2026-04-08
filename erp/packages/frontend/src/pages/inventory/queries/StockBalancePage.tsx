import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { searchItems, searchWarehouses, useItemCategories } from '../../../api/inventory';
import api from '../../../api/client';
import { useQuery } from '@tanstack/react-query';

// ── Fetch all stock balances with join data ────────────────────────────────────
async function fetchStockBalance(params: {
  itemId?: string;
  warehouseId?: string;
  categoryId?: string;
  status?: string;
  includeZero?: boolean;
}) {
  const res = await api.get('/inventory/stock-summary', { params });
  // We'll also query individual items to build a flat balance view
  const itemRes = await api.get('/inventory/items', { params: { limit: 1000, status: params.status || undefined } });
  const items: any[] = itemRes.data?.data ?? [];

  // Build flat rows from items with their stock balances embedded
  const rows: any[] = [];
  for (const item of items) {
    if (params.itemId && item.id !== params.itemId) continue;
    const balances = item.stockBalances ?? [];
    for (const b of balances) {
      if (params.warehouseId && b.warehouseId !== params.warehouseId) continue;
      const onHand = Number(b.qtyOnHand ?? 0);
      const reserved = Number(b.qtyReserved ?? 0);
      if (!params.includeZero && onHand === 0) continue;
      rows.push({
        itemId:        item.id,
        itemCode:      item.code,
        description:   item.description,
        category:      item.category?.name ?? '',
        warehouseId:   b.warehouseId,
        warehouseName: b.warehouse?.name ?? '',
        binCode:       b.bin?.code ?? '',
        uomCode:       item.uom?.code ?? '',
        qtyOnHand:     onHand,
        qtyReserved:   reserved,
        qtyAvailable:  onHand - reserved,
        avgCost:       Number(b.avgCost ?? 0),
        stockValue:    onHand * Number(b.avgCost ?? 0),
        status:        item.status,
      });
    }
  }
  return rows;
}

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'OBSOLETE'];

const COLUMNS: ColDef<any>[] = [
  { field: 'itemCode', headerName: 'Item Code', width: 130, pinned: 'left' },
  { field: 'description', headerName: 'Description', flex: 2, minWidth: 200 },
  { field: 'category', headerName: 'Category', width: 140 },
  { field: 'warehouseName', headerName: 'Warehouse', width: 150 },
  { field: 'binCode', headerName: 'Bin', width: 90 },
  { field: 'uomCode', headerName: 'UOM', width: 80 },
  {
    field: 'qtyOnHand', headerName: 'On Hand', width: 110, type: 'numericColumn',
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
  },
  {
    field: 'qtyReserved', headerName: 'Reserved', width: 100, type: 'numericColumn',
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
  },
  {
    field: 'qtyAvailable', headerName: 'Available', width: 110, type: 'numericColumn',
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
    cellClass: (p) => Number(p.value) < 0 ? 'text-red-600 font-semibold' : '',
  },
  {
    field: 'avgCost', headerName: 'Avg Cost', width: 110, type: 'numericColumn',
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
  },
  {
    field: 'stockValue', headerName: 'Stock Value', width: 130, type: 'numericColumn',
    valueFormatter: (p) => Number(p.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 }),
    cellClass: 'font-medium',
  },
  {
    field: 'status', headerName: 'Status', width: 100,
    cellRenderer: (p: { value: string }) => {
      const colors: Record<string, string> = { ACTIVE: 'bg-green-100 text-green-700', INACTIVE: 'bg-gray-100 text-gray-500', OBSOLETE: 'bg-amber-100 text-amber-700' };
      return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[p.value] ?? ''}`}>{p.value}</span>;
    },
  },
];

export default function StockBalancePage() {
  const [itemFilter, setItemFilter]         = useState<LookupOption | null>(null);
  const [whFilter, setWhFilter]             = useState<LookupOption | null>(null);
  const [categoryId, setCategoryId]         = useState('');
  const [status, setStatus]                 = useState('ACTIVE');
  const [includeZero, setIncludeZero]       = useState(false);

  const { data: catsData } = useItemCategories();
  const categories: any[] = (catsData as any)?.data ?? [];

  const queryParams = useMemo(() => ({
    itemId:      itemFilter?.value,
    warehouseId: whFilter?.value,
    categoryId:  categoryId || undefined,
    status:      status || undefined,
    includeZero,
  }), [itemFilter, whFilter, categoryId, status, includeZero]);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['inv', 'stock-balance-query', queryParams],
    queryFn:  () => fetchStockBalance(queryParams),
  });

  const totalValue  = useMemo(() => rows.reduce((s, r) => s + r.stockValue, 0), [rows]);
  const totalOnHand = useMemo(() => rows.reduce((s, r) => s + r.qtyOnHand, 0), [rows]);

  const handleExport = () => {
    const headers = ['Item Code', 'Description', 'Category', 'Warehouse', 'Bin', 'UOM', 'On Hand', 'Reserved', 'Available', 'Avg Cost', 'Stock Value', 'Status'];
    const csv = [headers, ...rows.map((r) => [
      r.itemCode, r.description, r.category, r.warehouseName, r.binCode, r.uomCode,
      r.qtyOnHand, r.qtyReserved, r.qtyAvailable, r.avgCost, r.stockValue, r.status,
    ])].map((row) => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'stock-balance.csv' }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-800">Stock Balance Query</h1>
        <div className="flex items-center gap-2">
          <button className="toolbar-btn" onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="toolbar-btn" onClick={handleExport}><Download size={13} /> Export Excel</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
        <div className="w-60">
          <LookupField value={itemFilter} onChange={setItemFilter} onSearch={searchItems} placeholder="Filter by item…" />
        </div>
        <div className="w-52">
          <LookupField value={whFilter} onChange={setWhFilter} onSearch={searchWarehouses} placeholder="Filter by warehouse…" />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="erp-input w-40">
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="erp-input w-32">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)}
            className="rounded border-gray-300 text-[#1F4E79]" />
          Include zero stock
        </label>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 px-4 py-2 bg-[#1F4E79]/5 border-b border-[#1F4E79]/10 text-xs">
        <span className="text-gray-500">Lines: <strong className="text-gray-800">{rows.length}</strong></span>
        <span className="text-gray-500">Total On Hand: <strong className="text-gray-800">{totalOnHand.toLocaleString(undefined, { minimumFractionDigits: 3 })}</strong></span>
        <span className="text-gray-500 ml-auto">Total Stock Value: <strong className="text-[#1F4E79] text-sm">{totalValue.toLocaleString(undefined, { minimumFractionDigits: 3 })}</strong></span>
      </div>

      {/* Grid */}
      <div className="flex-1">
        <DataGrid
          rowData={rows}
          columnDefs={COLUMNS}
          loading={isLoading}
          gridOptions={{
            pinnedBottomRowData: rows.length > 0 ? [{
              itemCode: 'TOTAL', description: '', category: '', warehouseName: '', binCode: '', uomCode: '',
              qtyOnHand: totalOnHand, qtyReserved: rows.reduce((s, r) => s + r.qtyReserved, 0),
              qtyAvailable: rows.reduce((s, r) => s + r.qtyAvailable, 0),
              avgCost: null, stockValue: totalValue, status: '',
            }] : [],
          }}
        />
      </div>
    </div>
  );
}
