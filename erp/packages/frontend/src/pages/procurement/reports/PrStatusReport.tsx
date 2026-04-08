import React, { useState } from 'react';
import { ReportPage, dateCol, numCol, statusCol, textCol } from '../../../components/reports/ReportPage';
import { usePrStatusReport, reportApi, type PrStatusRow, type ReportFilters } from '../../../api/procurementReports';
import { useToast } from '../../../components/ui/Toast';

const COLUMNS = [
  textCol<PrStatusRow>('docNo',           'PR Number',    150),
  dateCol<PrStatusRow>('docDate',         'Date'),
  textCol<PrStatusRow>('location',        'Location',     120),
  textCol<PrStatusRow>('itemCode',        'Item Code',    130),
  textCol<PrStatusRow>('itemDescription', 'Description',  undefined, 2),
  numCol <PrStatusRow>('requestedQty',    'Req. Qty'),
  numCol <PrStatusRow>('approvedQty',     'Appr. Qty'),
  numCol <PrStatusRow>('pendingQty',      'Pending Qty'),
  textCol<PrStatusRow>('poStatus',        'PO Status',    110),
  statusCol<PrStatusRow>('status',        'PR Status'),
];

export default function PrStatusReport() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [enabled, setEnabled] = useState(false);
  const toast = useToast();

  const { data, isLoading } = usePrStatusReport(filters, enabled);

  const handleGenerate = () => setEnabled(true);

  const handleExport = async () => {
    try {
      await reportApi.downloadXlsx('pr-status', filters);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <ReportPage<Record<string, unknown>>
      title="PR Status Report"
      endpoint="pr-status"
      filterConfig={{ dateRange: true, location: true, status: { options: ['DRAFT', 'APPROVED', 'ENQUIRY_SENT', 'PO_CREATED', 'SHORT_CLOSED', 'CLOSED'] } }}
      columns={COLUMNS as never}
      numericSummaryKeys={['requestedQty', 'approvedQty', 'pendingQty']}
      data={data as never}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={(f) => { setFilters(f); setEnabled(false); }}
      onGenerate={handleGenerate}
      onExport={handleExport}
    />
  );
}
