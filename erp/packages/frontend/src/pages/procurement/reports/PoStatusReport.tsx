import React, { useState } from 'react';
import { ReportPage, dateCol, numCol, statusCol, textCol } from '../../../components/reports/ReportPage';
import { usePoStatusReport, reportApi, type PoStatusRow, type ReportFilters } from '../../../api/procurementReports';
import { useToast } from '../../../components/ui/Toast';

const COLUMNS = [
  textCol<PoStatusRow>('docNo',           'PO Number',    150),
  dateCol<PoStatusRow>('docDate',         'Date'),
  textCol<PoStatusRow>('supplier',        'Supplier',     undefined, 2),
  textCol<PoStatusRow>('itemCode',        'Item Code',    130),
  textCol<PoStatusRow>('itemDescription', 'Description',  undefined, 2),
  numCol <PoStatusRow>('orderedQty',      'Ordered'),
  numCol <PoStatusRow>('receivedQty',     'Received'),
  numCol <PoStatusRow>('invoicedQty',     'Invoiced'),
  numCol <PoStatusRow>('balanceQty',      'Balance'),
  numCol <PoStatusRow>('netAmount',       'Net Amount',   130),
  dateCol<PoStatusRow>('deliveryDate',    'Delivery Date'),
  {
    field: 'overdue' as never,
    headerName: 'Overdue',
    width: 90,
    cellRenderer: (p: { value: boolean }) =>
      p.value ? <span className="text-red-600 text-xs font-semibold">⚠ YES</span> : null,
  },
  statusCol<PoStatusRow>('status', 'Status'),
];

export default function PoStatusReport() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [enabled, setEnabled] = useState(false);
  const toast = useToast();

  const { data, isLoading } = usePoStatusReport(filters, enabled);

  const handleExport = async () => {
    try { await reportApi.downloadXlsx('po-status', filters); }
    catch { toast.error('Export failed'); }
  };

  return (
    <ReportPage<Record<string, unknown>>
      title="PO Status Report"
      endpoint="po-status"
      filterConfig={{ dateRange: true, supplier: true, item: true, status: { options: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'RECEIVED', 'INVOICED', 'CLOSED', 'CANCELLED'] } }}
      columns={COLUMNS as never}
      numericSummaryKeys={['orderedQty', 'receivedQty', 'balanceQty', 'netAmount']}
      data={data as never}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={(f) => { setFilters(f); setEnabled(false); }}
      onGenerate={() => setEnabled(true)}
      onExport={handleExport}
    />
  );
}
