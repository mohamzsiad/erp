import React, { useState } from 'react';
import { InventoryReportPage } from '../../../components/reports/InventoryReportPage';
import { textCol, numCol, dateCol, statusCol } from '../../../components/reports/ReportPage';
import {
  useStockAgingReport,
  invReportApi,
  type InvReportFilters,
  type StockAgingRow,
} from '../../../api/inventoryReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';
import type { CellStyle } from 'ag-grid-community';

// Color map: 0-30 green, 31-90 yellow, 91-180 orange, 180+ red
function ageBucketStyle(bucket: string): CellStyle {
  if (!bucket) return {};
  const b = bucket.toLowerCase();
  if (b.startsWith('0-30'))                                return { background: '#dcfce7', color: '#166534' };
  if (b.startsWith('31-60') || b.startsWith('61-90'))     return { background: '#fef9c3', color: '#713f12' };
  if (b.startsWith('91-180'))                              return { background: '#ffedd5', color: '#9a3412' };
  return                                                          { background: '#fee2e2', color: '#991b1b' };
}

const COLUMNS: ColDef<StockAgingRow>[] = [
  textCol('itemCode',      'Item Code',   110),
  { ...textCol<StockAgingRow>('description', 'Description', undefined, 1), minWidth: 160 },
  textCol('category',      'Category',    120),
  textCol('uom',           'UOM',          60),
  textCol('warehouseCode', 'Warehouse',    100),
  textCol('binCode',       'Bin',           80),
  numCol('qtyOnHand',      'On Hand',      100),
  numCol('avgCost',        'Avg Cost',     100),
  numCol('stockValue',     'Stock Value',  120),
  dateCol('lastMovement',  'Last Movement', 120),
  {
    field: 'ageDays',
    headerName: 'Age (Days)',
    width: 100,
    type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? String(p.value) : '',
    cellStyle: { textAlign: 'right' } as CellStyle,
  },
  {
    field: 'ageBucket',
    headerName: 'Age Bucket',
    width: 130,
    cellStyle: (p) => ageBucketStyle(p.value as string),
  },
  statusCol('status', 'Status', 90),
];

export default function StockAgingReport() {
  const toast = useToast();
  const [filters,  setFilters]  = useState<InvReportFilters>({});
  const [enabled,  setEnabled]  = useState(false);
  const [snapshot, setSnapshot] = useState<InvReportFilters>({});

  const { data, isLoading } = useStockAgingReport(snapshot, enabled);

  const handleGenerate = () => {
    setSnapshot(filters);
    setEnabled(true);
  };

  const handleExport = async () => {
    try {
      await invReportApi.downloadXlsx('stock-aging', snapshot);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <InventoryReportPage<StockAgingRow>
      title="Stock Aging Report"
      endpoint="stock-aging"
      filterConfig={{ warehouse: true, item: true }}
      columns={COLUMNS}
      numericSummaryKeys={['qtyOnHand', 'stockValue']}
      data={data}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={setFilters}
      onGenerate={handleGenerate}
      onExport={handleExport}
      getRowId={(r) => `${r.itemCode}-${r.warehouseCode}-${r.binCode}`}
    />
  );
}
