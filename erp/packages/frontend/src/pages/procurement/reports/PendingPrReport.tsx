import React, { useState } from 'react';
import { ReportPage, dateCol, numCol, statusCol, textCol } from '../../../components/reports/ReportPage';
import { usePendingPrReport, reportApi, type PendingPrRow, type ReportFilters } from '../../../api/procurementReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';

const AGE_BUCKET_COLORS: Record<string, string> = {
  '0–7 days':   'text-green-700 bg-green-50',
  '8–14 days':  'text-yellow-700 bg-yellow-50',
  '15–30 days': 'text-orange-700 bg-orange-50',
  '>30 days':   'text-red-700 bg-red-50',
};

const COLUMNS: ColDef<PendingPrRow>[] = [
  textCol<PendingPrRow>('docNo',             'PR Number',     150),
  dateCol<PendingPrRow>('docDate',           'Date'),
  textCol<PendingPrRow>('location',          'Location',      120),
  {
    field: 'ageDays',
    headerName: 'Age (Days)',
    width: 110,
    type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? String(p.value) : '',
    cellStyle: (p: { value: number }) => ({
      textAlign: 'right' as const,
      ...(p.value > 30 ? { color: '#C00000', fontWeight: 600 } : p.value > 14 ? { color: '#9C5700' } : {}),
    }),
  },
  {
    field: 'ageBucket' as never,
    headerName: 'Age Bucket',
    width: 120,
    cellRenderer: (p: { value: string }) => {
      const cls = AGE_BUCKET_COLORS[p.value] ?? '';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
          {p.value}
        </span>
      );
    },
  },
  numCol<PendingPrRow>('itemCount',          'Items',         90),
  numCol<PendingPrRow>('totalRequestedQty',  'Total Req. Qty', 140),
  statusCol<PendingPrRow>('status',          'Status'),
];

export default function PendingPrReport() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [enabled, setEnabled] = useState(false);
  const toast = useToast();

  const { data, isLoading } = usePendingPrReport(filters, enabled);

  const handleExport = async () => {
    try { await reportApi.downloadXlsx('pending-pr', filters); }
    catch { toast.error('Export failed'); }
  };

  return (
    <ReportPage<Record<string, unknown>>
      title="Pending PR (Not Yet Converted)"
      endpoint="pending-pr"
      filterConfig={{ dateRange: true, location: true }}
      columns={COLUMNS as never}
      numericSummaryKeys={['itemCount', 'totalRequestedQty']}
      data={data as never}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={(f) => { setFilters(f); setEnabled(false); }}
      onGenerate={() => setEnabled(true)}
      onExport={handleExport}
    />
  );
}
