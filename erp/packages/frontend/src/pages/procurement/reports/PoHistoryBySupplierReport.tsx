import React, { useState } from 'react';
import { ReportPage, dateCol, numCol, textCol } from '../../../components/reports/ReportPage';
import { usePoHistoryReport, reportApi, type PoHistoryRow, type ReportFilters } from '../../../api/procurementReports';
import { useToast } from '../../../components/ui/Toast';

const COLUMNS = [
  textCol<PoHistoryRow>('supplierCode',    'Code',         120),
  textCol<PoHistoryRow>('supplierName',    'Supplier Name', undefined, 2),
  numCol <PoHistoryRow>('totalOrders',     'Total Orders',  130, ),
  numCol <PoHistoryRow>('totalValue',      'Total Value',   150),
  numCol <PoHistoryRow>('avgLeadTimeDays', 'Avg Lead Days', 130),
  dateCol<PoHistoryRow>('lastOrderDate',   'Last Order'),
];

export default function PoHistoryBySupplierReport() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [enabled, setEnabled] = useState(false);
  const toast = useToast();

  const { data, isLoading } = usePoHistoryReport(filters, enabled);

  const handleExport = async () => {
    try { await reportApi.downloadXlsx('po-history-by-supplier', filters); }
    catch { toast.error('Export failed'); }
  };

  return (
    <ReportPage<Record<string, unknown>>
      title="PO History by Supplier"
      endpoint="po-history-by-supplier"
      filterConfig={{ dateRange: true, supplier: true }}
      columns={COLUMNS as never}
      numericSummaryKeys={['totalOrders', 'totalValue']}
      data={data as never}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={(f) => { setFilters(f); setEnabled(false); }}
      onGenerate={() => setEnabled(true)}
      onExport={handleExport}
    />
  );
}
