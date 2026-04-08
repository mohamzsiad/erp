import React, { useState } from 'react';
import { ReportPage, dateCol, numCol, statusCol, textCol } from '../../../components/reports/ReportPage';
import { useProcurementTrackingReport, reportApi, type ProcurementTrackingRow, type ReportFilters } from '../../../api/procurementReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';

const COLUMNS: ColDef<ProcurementTrackingRow>[] = [
  textCol <ProcurementTrackingRow>('docNo',       'PR Number',   150),
  dateCol <ProcurementTrackingRow>('prDate',      'PR Date'),
  textCol <ProcurementTrackingRow>('poDocNo',     'PO Number',   150),
  dateCol <ProcurementTrackingRow>('poDate',      'PO Date'),
  textCol <ProcurementTrackingRow>('location',    'Location',    120),
  {
    field: 'daysElapsed',
    headerName: 'Days Elapsed',
    width: 120,
    type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? String(p.value) : '',
    cellStyle: (p: { value: number }) => ({
      textAlign: 'right' as const,
      ...(p.value > 30 ? { color: '#C00000', fontWeight: 600 } : p.value > 14 ? { color: '#9C5700' } : {}),
    }),
  },
  statusCol<ProcurementTrackingRow>('status', 'Status'),
];

export default function ProcurementTrackingReport() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [enabled, setEnabled] = useState(false);
  const toast = useToast();

  const { data, isLoading } = useProcurementTrackingReport(filters, enabled);

  const handleExport = async () => {
    try { await reportApi.downloadXlsx('procurement-tracking', filters); }
    catch { toast.error('Export failed'); }
  };

  return (
    <ReportPage<Record<string, unknown>>
      title="Procurement Tracking (PR → PO Cycle)"
      endpoint="procurement-tracking"
      filterConfig={{ dateRange: true, location: true }}
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
