import React, { useState } from 'react';
import { ReportPage, numCol, textCol } from '../../../components/reports/ReportPage';
import { usePriceComparisonReport, reportApi, type PriceComparisonRow, type ReportFilters } from '../../../api/procurementReports';
import { useToast } from '../../../components/ui/Toast';

const fmtPrice = (p: { value: number | null }) =>
  p.value != null
    ? p.value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : '—';

const COLUMNS = [
  textCol<PriceComparisonRow>('itemCode',        'Item Code',    130),
  textCol<PriceComparisonRow>('itemDescription', 'Description',  undefined, 2),
  textCol<PriceComparisonRow>('uom',             'UOM',          80),
  textCol<PriceComparisonRow>('supplierCode',    'Supplier',     120),
  textCol<PriceComparisonRow>('supplierName',    'Supplier Name', undefined, 1),
  { field: 'price1' as never, headerName: 'Price 1', width: 120, type: 'numericColumn', valueFormatter: fmtPrice, cellStyle: { textAlign: 'right' } },
  { field: 'price2' as never, headerName: 'Price 2', width: 120, type: 'numericColumn', valueFormatter: fmtPrice, cellStyle: { textAlign: 'right' } },
  { field: 'price3' as never, headerName: 'Price 3', width: 120, type: 'numericColumn', valueFormatter: fmtPrice, cellStyle: { textAlign: 'right' } },
  { field: 'price4' as never, headerName: 'Price 4', width: 120, type: 'numericColumn', valueFormatter: fmtPrice, cellStyle: { textAlign: 'right' } },
  { field: 'price5' as never, headerName: 'Price 5', width: 120, type: 'numericColumn', valueFormatter: fmtPrice, cellStyle: { textAlign: 'right' } },
  numCol<PriceComparisonRow>('avgPrice', 'Avg Price', 120),
  numCol<PriceComparisonRow>('minPrice', 'Min Price', 120),
  numCol<PriceComparisonRow>('maxPrice', 'Max Price', 120),
];

export default function PriceComparisonReport() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [enabled, setEnabled] = useState(false);
  const toast = useToast();

  const { data, isLoading } = usePriceComparisonReport(filters, enabled);

  const handleExport = async () => {
    try { await reportApi.downloadXlsx('price-comparison', filters); }
    catch { toast.error('Export failed'); }
  };

  return (
    <ReportPage<Record<string, unknown>>
      title="Price Comparison (Last 5 Purchases)"
      endpoint="price-comparison"
      filterConfig={{ item: true, supplier: true }}
      columns={COLUMNS as never}
      numericSummaryKeys={[]}
      data={data as never}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={(f) => { setFilters(f); setEnabled(false); }}
      onGenerate={() => setEnabled(true)}
      onExport={handleExport}
    />
  );
}
