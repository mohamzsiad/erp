import React, { useState } from 'react';
import { Download } from 'lucide-react';
import DataGrid from '../../../components/ui/DataGrid';
import { InvFilterPanel } from '../../../components/reports/InventoryReportPage';
import { textCol, numCol, dateCol, SummaryRow } from '../../../components/reports/ReportPage';
import {
  useDeadInactiveObsReport,
  invReportApi,
  type InvReportFilters,
  type DioStockRow,
} from '../../../api/inventoryReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';

type TabKey = 'dead' | 'inactive' | 'obsolete';

const COLUMNS: ColDef<DioStockRow>[] = [
  textCol('itemCode',      'Item Code',   110),
  { ...textCol<DioStockRow>('description', 'Description', undefined, 1), minWidth: 160 },
  textCol('category',      'Category',    120),
  textCol('uom',           'UOM',          60),
  textCol('warehouseCode', 'Warehouse',    100),
  numCol('qtyOnHand',      'On Hand',      100),
  numCol('avgCost',        'Avg Cost',     100),
  numCol('stockValue',     'Stock Value',  120),
  dateCol('lastMovement',  'Last Movement', 120),
  {
    field: 'ageDays',
    headerName: 'Age (Days)',
    width: 100,
    type: 'numericColumn',
    valueFormatter: (p) => p.value != null ? String(p.value) : '—',
    cellStyle: { textAlign: 'right' },
  },
];

const TAB_LABELS: Record<TabKey, string> = {
  dead:     'Dead Stock',
  inactive: 'Inactive Stock',
  obsolete: 'Obsolete Stock',
};

export default function DeadInactiveObsoleteReport() {
  const toast = useToast();
  const [filters,   setFilters]   = useState<InvReportFilters>({});
  const [enabled,   setEnabled]   = useState(false);
  const [snapshot,  setSnapshot]  = useState<InvReportFilters>({});
  const [activeTab, setActiveTab] = useState<TabKey>('dead');

  const { data, isLoading } = useDeadInactiveObsReport(snapshot, enabled);

  const handleGenerate = () => {
    setSnapshot(filters);
    setEnabled(true);
  };

  const handleExport = async () => {
    try {
      await invReportApi.downloadXlsx('dead-inactive-obsolete', snapshot);
    } catch {
      toast.error('Export failed');
    }
  };

  const tabData: DioStockRow[] = data ? data[activeTab] : [];
  const totalRows = data ? data.dead.length + data.inactive.length + data.obsolete.length : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">
          Dead / Inactive / Obsolete Stock Report
        </h2>
        {data && (
          <span className="text-xs text-gray-400">({totalRows} total records)</span>
        )}
        {data?.thresholdDays != null && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Threshold: {data.thresholdDays} days
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleExport}
          className="toolbar-btn"
          title="Export all 3 tabs to Excel"
        >
          <Download size={13} />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white px-4 gap-1">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 text-xs font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {TAB_LABELS[tab]}
            {data && (
              <span className="ml-1.5 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full">
                {data[tab].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter panel */}
      <InvFilterPanel
        config={{ item: true, warehouse: true, noMovementDays: true }}
        filters={filters}
        onChange={setFilters}
        onGenerate={handleGenerate}
        generating={isLoading}
      />

      {/* Grid */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col gap-2">
        {!data && !isLoading && (
          <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">
            Set filters above and click "Generate Report"
          </div>
        )}
        {(data || isLoading) && (
          <DataGrid<DioStockRow>
            rowData={tabData}
            columnDefs={COLUMNS}
            height="100%"
            loading={isLoading}
            pagination
            pageSize={100}
            getRowId={(r) => `${r.itemCode}-${r.warehouseCode}`}
          />
        )}
      </div>

      {/* Summary footer */}
      {tabData.length > 0 && (
        <SummaryRow
          data={tabData as unknown as Record<string, unknown>[]}
          numericKeys={['qtyOnHand', 'stockValue']}
          label={`${TAB_LABELS[activeTab].toUpperCase()} TOTAL`}
        />
      )}
    </div>
  );
}
