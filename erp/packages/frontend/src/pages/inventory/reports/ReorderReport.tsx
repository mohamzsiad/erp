import React, { useState } from 'react';
import { InventoryReportPage } from '../../../components/reports/InventoryReportPage';
import { textCol, numCol } from '../../../components/reports/ReportPage';
import {
  useReorderReport,
  invReportApi,
  type InvReportFilters,
  type ReorderRow,
} from '../../../api/inventoryReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';
import type { CellStyle } from 'ag-grid-community';

const shortageStyleHigh: CellStyle = { textAlign: 'right', color: '#991b1b', fontWeight: '600' };
const shortageStyleNorm: CellStyle = { textAlign: 'right' };

const COLUMNS: ColDef<ReorderRow>[] = [
  textCol('itemCode',          'Item Code',         110),
  { ...textCol<ReorderRow>('description', 'Description', undefined, 1), minWidth: 160 },
  textCol('category',          'Category',          110),
  textCol('uom',               'UOM',                60),
  numCol('reorderLevel',       'Reorder Level',      110),
  numCol('reorderQty',         'Reorder Qty',        110),
  numCol('qtyOnHand',          'On Hand',            100),
  numCol('qtyReserved',        'Reserved',           100),
  numCol('qtyAvailable',       'Available',          100),
  {
    field: 'shortage',
    headerName: 'Shortage',
    width: 100,
    type: 'numericColumn',
    valueFormatter: (p) =>
      Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    cellStyle: (p) => Number(p.value) > 0 ? shortageStyleHigh : shortageStyleNorm,
  },
  numCol('suggestedOrderQty',  'Suggested Order',    130),
  numCol('leadTimeDays',       'Lead Time (Days)',    120),
  numCol('standardCost',       'Std Cost',           100),
  numCol('estimatedValue',     'Est. Value',         120),
];

export default function ReorderReport() {
  const toast = useToast();
  const [filters,  setFilters]  = useState<InvReportFilters>({});
  const [enabled,  setEnabled]  = useState(false);
  const [snapshot, setSnapshot] = useState<InvReportFilters>({});

  const { data, isLoading } = useReorderReport(snapshot, enabled);

  const handleGenerate = () => {
    setSnapshot(filters);
    setEnabled(true);
  };

  const handleExport = async () => {
    try {
      await invReportApi.downloadXlsx('reorder-report', snapshot);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <InventoryReportPage<ReorderRow>
      title="Reorder Report"
      endpoint="reorder-report"
      filterConfig={{ warehouse: true }}
      columns={COLUMNS}
      numericSummaryKeys={['suggestedOrderQty', 'estimatedValue']}
      data={data}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={setFilters}
      onGenerate={handleGenerate}
      onExport={handleExport}
      getRowId={(r) => r.itemCode}
    />
  );
}
