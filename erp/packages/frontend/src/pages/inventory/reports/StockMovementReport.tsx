import React, { useState } from 'react';
import { InventoryReportPage } from '../../../components/reports/InventoryReportPage';
import { textCol, numCol, dateCol } from '../../../components/reports/ReportPage';
import {
  useStockMovementReport,
  invReportApi,
  type InvReportFilters,
  type StockMovementRow,
} from '../../../api/inventoryReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';
import type { CellStyle } from 'ag-grid-community';

const inStyle: CellStyle  = { textAlign: 'right', color: '#166534', fontWeight: '600' };
const outStyle: CellStyle = { textAlign: 'right', color: '#991b1b', fontWeight: '600' };
const numStyle: CellStyle = { textAlign: 'right' };

const COLUMNS: ColDef<StockMovementRow>[] = [
  dateCol('date',            'Date',           100),
  textCol('transactionType', 'Type',           110),
  textCol('sourceDocNo',     'Source Doc',     120),
  textCol('itemCode',        'Item Code',      110),
  { ...textCol<StockMovementRow>('description', 'Description', undefined, 1), minWidth: 140 },
  textCol('uom',             'UOM',             60),
  textCol('warehouse',       'Warehouse',       100),
  textCol('bin',             'Bin',              80),
  {
    field: 'inQty',
    headerName: 'In Qty',
    width: 100,
    type: 'numericColumn',
    valueFormatter: (p) =>
      p.value != null
        ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : '',
    cellStyle: (p) => p.value != null ? inStyle : numStyle,
  },
  {
    field: 'outQty',
    headerName: 'Out Qty',
    width: 100,
    type: 'numericColumn',
    valueFormatter: (p) =>
      p.value != null
        ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : '',
    cellStyle: (p) => p.value != null ? outStyle : numStyle,
  },
  numCol('balance',         'Balance',         110),
  numCol('avgCost',         'Avg Cost',        100),
  numCol('movementValue',   'Movement Value',  130),
];

export default function StockMovementReport() {
  const toast = useToast();
  const [filters,  setFilters]  = useState<InvReportFilters>({});
  const [enabled,  setEnabled]  = useState(false);
  const [snapshot, setSnapshot] = useState<InvReportFilters>({});

  const { data, isLoading } = useStockMovementReport(snapshot, enabled);

  const handleGenerate = () => {
    setSnapshot(filters);
    setEnabled(true);
  };

  const handleExport = async () => {
    try {
      await invReportApi.downloadXlsx('stock-movement', snapshot);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <InventoryReportPage<StockMovementRow>
      title="Stock Movement Report"
      endpoint="stock-movement"
      filterConfig={{ dateRange: true, item: true, warehouse: true }}
      columns={COLUMNS}
      numericSummaryKeys={['movementValue']}
      data={data}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={setFilters}
      onGenerate={handleGenerate}
      onExport={handleExport}
      getRowId={(r) => `${r.sourceDocNo}-${r.itemCode}-${r.date}-${r.transactionType}`}
    />
  );
}
