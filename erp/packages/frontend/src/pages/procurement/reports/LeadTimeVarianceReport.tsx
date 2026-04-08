import React, { useState } from 'react';
import { ReportPage, numCol, textCol } from '../../../components/reports/ReportPage';
import { useLeadTimeVarianceReport, reportApi, type LeadTimeVarianceRow, type ReportFilters } from '../../../api/procurementReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';

const COLUMNS: ColDef<LeadTimeVarianceRow>[] = [
  textCol<LeadTimeVarianceRow>('supplierCode',    'Supplier Code',  130),
  textCol<LeadTimeVarianceRow>('supplierName',    'Supplier',       undefined, 2),
  textCol<LeadTimeVarianceRow>('itemCode',        'Item Code',      130),
  textCol<LeadTimeVarianceRow>('itemDescription', 'Description',    undefined, 2),
  numCol <LeadTimeVarianceRow>('plannedLeadDays', 'Planned Days',   130),
  numCol <LeadTimeVarianceRow>('actualLeadDays',  'Actual Days',    130),
  {
    field: 'variance',
    headerName: 'Variance (Days)',
    width: 130,
    type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? String(p.value) : '',
    cellStyle: (p: { value: number }) => ({
      textAlign: 'right' as const,
      ...(p.value > 0 ? { color: '#C00000' } : p.value < 0 ? { color: '#107C10' } : {}),
      ...(Math.abs(p.value) > 5 ? { fontWeight: 600 } : {}),
    }),
  },
  numCol<LeadTimeVarianceRow>('poCount', 'PO Count', 100),
];

export default function LeadTimeVarianceReport() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [enabled, setEnabled] = useState(false);
  const toast = useToast();

  const { data, isLoading } = useLeadTimeVarianceReport(filters, enabled);

  const handleExport = async () => {
    try { await reportApi.downloadXlsx('lead-time-variance', filters); }
    catch { toast.error('Export failed'); }
  };

  return (
    <ReportPage<Record<string, unknown>>
      title="Lead Time Variance"
      endpoint="lead-time-variance"
      filterConfig={{ dateRange: true, supplier: true, item: true }}
      columns={COLUMNS as never}
      numericSummaryKeys={['poCount']}
      data={data as never}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={(f) => { setFilters(f); setEnabled(false); }}
      onGenerate={() => setEnabled(true)}
      onExport={handleExport}
    />
  );
}
