/**
 * InventoryReportPage — shared layout for all inventory reports.
 * Extends the base ReportPage pattern with inventory-specific filter fields:
 *   warehouse, category, asOfDate, noMovementDays
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, RefreshCw, Loader2 } from 'lucide-react';
import DataGrid, { type ColDef } from '../ui/DataGrid';
import { LookupField, type LookupOption } from '../ui/LookupField';
import { FormField, Input } from '../ui/FormField';
import { useToast } from '../ui/Toast';
import { searchItems, searchWarehouses } from '../../api/inventory';
import { searchSuppliers } from '../../api/procurement';
import type { InvReportFilters } from '../../api/inventoryReports';
import { SummaryRow } from './ReportPage';

// ── Filter config ──────────────────────────────────────────────────────────────
export type InvFilterConfig = {
  dateRange?:      boolean;  // dateFrom / dateTo
  asOfDate?:       boolean;  // single "as-of" date picker
  item?:           boolean;
  warehouse?:      boolean;
  supplier?:       boolean;
  noMovementDays?: boolean;  // integer field
};

// ── Filter panel ───────────────────────────────────────────────────────────────
interface InvFilterPanelProps {
  config:     InvFilterConfig;
  filters:    InvReportFilters;
  onChange:   (f: InvReportFilters) => void;
  onGenerate: () => void;
  generating?: boolean;
}

export const InvFilterPanel: React.FC<InvFilterPanelProps> = ({
  config,
  filters,
  onChange,
  onGenerate,
  generating,
}) => {
  const [collapsed, setCollapsed]   = useState(false);
  const [itemOpt,   setItemOpt]     = useState<LookupOption | null>(null);
  const [whOpt,     setWhOpt]       = useState<LookupOption | null>(null);
  const [suppOpt,   setSuppOpt]     = useState<LookupOption | null>(null);

  const set = (key: keyof InvReportFilters, value: string | number | undefined) =>
    onChange({ ...filters, [key]: value === '' ? undefined : value });

  const activeCount = Object.values(filters).filter((v) => v != null && v !== '').length;

  const handleClear = () => {
    setItemOpt(null);
    setWhOpt(null);
    setSuppOpt(null);
    onChange({});
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        Filters
        {activeCount > 0 && (
          <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">
            {activeCount} active
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap items-end gap-4">

            {/* As-of date */}
            {config.asOfDate && (
              <FormField label="As of Date" className="w-36">
                <Input
                  type="date"
                  value={filters.asOfDate ?? ''}
                  onChange={(e) => set('asOfDate', e.target.value)}
                />
              </FormField>
            )}

            {/* Date range */}
            {config.dateRange && (
              <>
                <FormField label="Date From" className="w-36">
                  <Input
                    type="date"
                    value={filters.dateFrom ?? ''}
                    onChange={(e) => set('dateFrom', e.target.value)}
                  />
                </FormField>
                <FormField label="Date To" className="w-36">
                  <Input
                    type="date"
                    value={filters.dateTo ?? ''}
                    onChange={(e) => set('dateTo', e.target.value)}
                  />
                </FormField>
              </>
            )}

            {/* Item */}
            {config.item && (
              <FormField label="Item" className="w-52">
                <LookupField
                  value={itemOpt}
                  onChange={(opt) => { setItemOpt(opt); set('itemId', opt?.value); }}
                  onSearch={searchItems}
                  placeholder="All items…"
                />
              </FormField>
            )}

            {/* Warehouse */}
            {config.warehouse && (
              <FormField label="Warehouse" className="w-48">
                <LookupField
                  value={whOpt}
                  onChange={(opt) => { setWhOpt(opt); set('warehouseId', opt?.value); }}
                  onSearch={searchWarehouses}
                  placeholder="All warehouses…"
                />
              </FormField>
            )}

            {/* Supplier */}
            {config.supplier && (
              <FormField label="Supplier" className="w-52">
                <LookupField
                  value={suppOpt}
                  onChange={(opt) => { setSuppOpt(opt); set('supplierId', opt?.value); }}
                  onSearch={searchSuppliers}
                  placeholder="All suppliers…"
                />
              </FormField>
            )}

            {/* No movement days */}
            {config.noMovementDays && (
              <FormField label="No Movement ≥ (days)" className="w-36">
                <Input
                  type="number"
                  min={1}
                  value={filters.noMovementDays ?? ''}
                  onChange={(e) =>
                    set('noMovementDays', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </FormField>
            )}

            {/* Actions */}
            <div className="flex items-end pb-0.5 gap-2">
              <button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50 px-4"
              >
                {generating ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Generate Report
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="toolbar-btn text-xs"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main InventoryReportPage layout ───────────────────────────────────────────
interface InventoryReportPageProps<T extends object> {
  title:                string;
  endpoint:             string;
  filterConfig:         InvFilterConfig;
  columns:              ColDef<T>[];
  numericSummaryKeys?:  string[];
  data:                 T[] | undefined;
  isLoading:            boolean;
  filters:              InvReportFilters;
  onFiltersChange:      (f: InvReportFilters) => void;
  onGenerate:           () => void;
  /** Override the default Export Excel behaviour (e.g. for multi-tab reports) */
  onExport:             () => void;
  /** Optional slot rendered between header and filter panel (e.g. tab bar) */
  headerSlot?:          React.ReactNode;
  /** Optional getRowId override */
  getRowId?:            (row: T) => string;
  /** Extra gridOptions */
  gridOptions?:         Record<string, unknown>;
}

export function InventoryReportPage<T extends object>({
  title,
  filterConfig,
  columns,
  numericSummaryKeys = [],
  data,
  isLoading,
  filters,
  onFiltersChange,
  onGenerate,
  onExport,
  headerSlot,
  getRowId,
  gridOptions,
}: InventoryReportPageProps<T>) {
  return (
    <div className="flex flex-col h-full">
      {/* Report header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {data && (
          <span className="text-xs text-gray-400">({data.length} records)</span>
        )}
        <div className="flex-1" />
        <button
          onClick={onExport}
          className="toolbar-btn"
          title="Export to Excel"
        >
          <Download size={13} />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Optional slot (e.g. tab switcher) */}
      {headerSlot}

      {/* Filter panel */}
      <InvFilterPanel
        config={filterConfig}
        filters={filters}
        onChange={onFiltersChange}
        onGenerate={onGenerate}
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
          <DataGrid<T>
            rowData={data ?? []}
            columnDefs={columns}
            height="100%"
            loading={isLoading}
            pagination
            pageSize={100}
            getRowId={
              getRowId
                ? (row) => getRowId(row)
                : (row) => {
                    const id =
                      (row as Record<string,unknown>)['id'] ??
                      (row as Record<string,unknown>)['itemCode'] ??
                      Math.random();
                    return String(id);
                  }
            }
            gridOptions={gridOptions as never}
          />
        )}
      </div>

      {/* Summary footer */}
      {data && numericSummaryKeys.length > 0 && (
        <SummaryRow
          data={data as unknown as Record<string, unknown>[]}
          numericKeys={numericSummaryKeys}
        />
      )}
    </div>
  );
}
