import React, { useState } from 'react';
import { InventoryReportPage } from '../../../components/reports/InventoryReportPage';
import { textCol, numCol, statusCol } from '../../../components/reports/ReportPage';
import {
  useStockBalanceReport,
  invReportApi,
  type InvReportFilters,
  type StockBalanceRow,
} from '../../../api/inventoryReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';
import type { CellClassParams } from 'ag-grid-community';

const COLUMNS: ColDef<StockBalanceRow>[] = [
  textCol('itemCode',       'Item Code',   110),
  { ...textCol<StockBalanceRow>('description', 'Description', undefined, 1), minWidth: 160 },
  textCol('category',       'Category',    120),
  textCol('uom',            'UOM',          70),
  textCol('warehouseCode',  'Warehouse',    100),
  textCol('binCode',        'Bin',           80),
  numCol('qtyOnHand',       'On Hand',      110),
  numCol('qtyReserved',     'Reserved',     110),
  numCol('qtyAvailable',    'Available',    110),
  numCol('avgCost',         'Avg Cost',     110),
  numCol('stockValue',      'Stock Value',  120),
  statusCol('status',       'Status',        90),
];

export default function StockBalanceReport() {
  const toast = useToast();
  const [filters,  setFilters]  = useState<InvReportFilters>({});
  const [enabled,  setEnabled]  = useState(false);
  const [snapshot, setSnapshot] = useState<InvReportFilters>({});

  const { data, isLoading } = useStockBalanceReport(snapshot, enabled);

  const handleGenerate = () => {
    setSnapshot(filters);
    setEnabled(true);
  };

  const handleExport = async () => {
    try {
      await invReportApi.downloadXlsx('stock-balance', snapshot);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <InventoryReportPage<StockBalanceRow>
      title="Stock Balance Report"
      endpoint="stock-balance"
      filterConfig={{ asOfDate: true, item: true, warehouse: true }}
      columns={COLUMNS}
      numericSummaryKeys={['qtyOnHand', 'qtyAvailable', 'stockValue']}
      data={data}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={setFilters}
      onGenerate={handleGenerate}
      onExport={handleExport}
      getRowId={(r) => `${r.itemCode}-${r.warehouseCode}-${r.binCode}`}
      gridOptions={{
        rowClassRules: {
          'bg-red-50': (p: CellClassParams<StockBalanceRow>) =>
            (p.data?.qtyAvailable ?? 0) <= 0,
        },
      }}
    />
  );
}
