import React, { useState } from 'react';
import { InventoryReportPage } from '../../../components/reports/InventoryReportPage';
import { textCol, numCol, dateCol } from '../../../components/reports/ReportPage';
import {
  useGrnSummaryReport,
  invReportApi,
  type InvReportFilters,
  type GrnSummaryRow,
} from '../../../api/inventoryReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';

const COLUMNS: ColDef<GrnSummaryRow>[] = [
  textCol('grnNo',        'GRN No',          110),
  dateCol('docDate',      'Date',             100),
  textCol('poNo',         'PO No',            110),
  textCol('supplierCode', 'Supplier Code',    110),
  { ...textCol<GrnSummaryRow>('supplierName', 'Supplier Name', undefined, 1), minWidth: 140 },
  textCol('warehouse',    'Warehouse',        100),
  textCol('itemCode',     'Item Code',        110),
  { ...textCol<GrnSummaryRow>('description', 'Description', undefined, 1), minWidth: 140 },
  textCol('category',     'Category',         110),
  textCol('uom',          'UOM',               60),
  numCol('receivedQty',   'Received',          100),
  numCol('acceptedQty',   'Accepted',          100),
  numCol('rejectedQty',   'Rejected',           90),
  numCol('unitCost',      'Unit Cost',          100),
  numCol('lineValue',     'Line Value',         120),
];

export default function GrnSummaryReport() {
  const toast = useToast();
  const [filters,  setFilters]  = useState<InvReportFilters>({});
  const [enabled,  setEnabled]  = useState(false);
  const [snapshot, setSnapshot] = useState<InvReportFilters>({});

  const { data, isLoading } = useGrnSummaryReport(snapshot, enabled);

  const handleGenerate = () => {
    setSnapshot(filters);
    setEnabled(true);
  };

  const handleExport = async () => {
    try {
      await invReportApi.downloadXlsx('grn-summary', snapshot);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <InventoryReportPage<GrnSummaryRow>
      title="GRN Summary Report"
      endpoint="grn-summary"
      filterConfig={{ dateRange: true, supplier: true, item: true, warehouse: true }}
      columns={COLUMNS}
      numericSummaryKeys={['receivedQty', 'acceptedQty', 'rejectedQty', 'lineValue']}
      data={data}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={setFilters}
      onGenerate={handleGenerate}
      onExport={handleExport}
      getRowId={(r) => `${r.grnNo}-${r.itemCode}`}
    />
  );
}
