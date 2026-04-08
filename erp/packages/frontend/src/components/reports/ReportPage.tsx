import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, RefreshCw, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import DataGrid, { type ColDef } from '../ui/DataGrid';
import { StatusBadge } from '../ui/StatusBadge';
import { LookupField, type LookupOption } from '../ui/LookupField';
import { FormField, Input, Select } from '../ui/FormField';
import { useToast } from '../ui/Toast';
import { searchLocations, searchSuppliers, searchItems } from '../../api/procurement';
import type { ReportFilters } from '../../api/procurementReports';

// ── Filter Panel ──────────────────────────────────────────────────────────────
export type FilterConfig = {
  dateRange?: boolean;
  location?: boolean;
  supplier?: boolean;
  item?: boolean;
  status?: { options: string[] };
};

interface ReportFilterPanelProps {
  config: FilterConfig;
  filters: ReportFilters;
  onChange: (f: ReportFilters) => void;
  onGenerate: () => void;
  generating?: boolean;
}

export const ReportFilterPanel: React.FC<ReportFilterPanelProps> = ({
  config,
  filters,
  onChange,
  onGenerate,
  generating,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const [locationOpt, setLocationOpt] = useState<LookupOption | null>(null);
  const [supplierOpt, setSupplierOpt] = useState<LookupOption | null>(null);
  const [itemOpt, setItemOpt] = useState<LookupOption | null>(null);

  const set = (key: keyof ReportFilters, value: string | undefined) =>
    onChange({ ...filters, [key]: value || undefined });

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Filter header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        Filters
        {Object.values(filters).filter(Boolean).length > 0 && (
          <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">
            {Object.values(filters).filter(Boolean).length} active
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap items-end gap-4">
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

            {/* Location */}
            {config.location && (
              <FormField label="Location" className="w-48">
                <LookupField
                  value={locationOpt}
                  onChange={(opt) => {
                    setLocationOpt(opt);
                    set('locationId', opt?.value);
                  }}
                  onSearch={searchLocations}
                  placeholder="All locations…"
                />
              </FormField>
            )}

            {/* Supplier */}
            {config.supplier && (
              <FormField label="Supplier" className="w-52">
                <LookupField
                  value={supplierOpt}
                  onChange={(opt) => {
                    setSupplierOpt(opt);
                    set('supplierId', opt?.value);
                  }}
                  onSearch={searchSuppliers}
                  placeholder="All suppliers…"
                />
              </FormField>
            )}

            {/* Item */}
            {config.item && (
              <FormField label="Item" className="w-52">
                <LookupField
                  value={itemOpt}
                  onChange={(opt) => {
                    setItemOpt(opt);
                    set('itemId', opt?.value);
                  }}
                  onSearch={searchItems}
                  placeholder="All items…"
                />
              </FormField>
            )}

            {/* Status */}
            {config.status && (
              <FormField label="Status" className="w-36">
                <Select
                  options={config.status.options.map((s) => ({
                    value: s,
                    label: s.replace(/_/g, ' '),
                  }))}
                  placeholder="All"
                  value={filters.status ?? ''}
                  onChange={(e) => set('status', e.target.value)}
                />
              </FormField>
            )}

            {/* Generate button */}
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
                onClick={() => {
                  setLocationOpt(null);
                  setSupplierOpt(null);
                  setItemOpt(null);
                  onChange({});
                }}
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

// ── Status badge cell renderer helper ────────────────────────────────────────
export const statusCellRenderer = (p: { value: string }) => (
  p.value ? <StatusBadge status={p.value} /> : null
);

// ── Summary footer ────────────────────────────────────────────────────────────
interface SummaryRowProps {
  data: Record<string, unknown>[];
  numericKeys: string[];
  label?: string;
}

export const SummaryRow: React.FC<SummaryRowProps> = ({ data, numericKeys, label = 'TOTAL' }) => {
  if (data.length === 0) return null;

  const totals: Record<string, number> = {};
  for (const key of numericKeys) {
    totals[key] = data.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  }

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs font-semibold text-blue-800">
      <span className="text-blue-600">{label} ({data.length} rows)</span>
      {numericKeys.map((k) => (
        <span key={k}>
          {k}: {totals[k].toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
        </span>
      ))}
    </div>
  );
};

// ── Main ReportPage layout ────────────────────────────────────────────────────
interface ReportPageProps<T extends Record<string, unknown>> {
  title: string;
  endpoint: string;
  filterConfig: FilterConfig;
  columns: ColDef<T>[];
  numericSummaryKeys?: string[];
  data: T[] | undefined;
  isLoading: boolean;
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  onGenerate: () => void;
  onExport: () => void;
}

export function ReportPage<T extends Record<string, unknown>>({
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
}: ReportPageProps<T>) {
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

      {/* Filter panel */}
      <ReportFilterPanel
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
            pageSize={50}
            getRowId={(row) => {
              // Use first string key as id fallback
              const id = row['id'] ?? row['prlId'] ?? row['poId'] ?? row['supplierCode'] ?? Math.random();
              return String(id);
            }}
            gridOptions={{
              rowClassRules: {
                'bg-red-50 text-red-700': (p) => (p.data as Record<string,unknown>)?.overdue === true,
              },
            }}
          />
        )}
      </div>

      {/* Summary footer */}
      {data && numericSummaryKeys.length > 0 && (
        <SummaryRow
          data={data as Record<string, unknown>[]}
          numericKeys={numericSummaryKeys}
        />
      )}
    </div>
  );
}

// ── Shared column builders ────────────────────────────────────────────────────
export function dateCol<T>(field: string, header: string, width = 110): ColDef<T> {
  return {
    field: field as never,
    headerName: header,
    width,
    valueFormatter: (p) => {
      if (!p.value) return '';
      const d = new Date(p.value as string);
      return isNaN(d.getTime()) ? p.value as string : d.toLocaleDateString('en-GB');
    },
  };
}

export function numCol<T>(field: string, header: string, width = 120): ColDef<T> {
  return {
    field: field as never,
    headerName: header,
    width,
    type: 'numericColumn',
    valueFormatter: (p) =>
      p.value != null
        ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : '',
    cellStyle: { textAlign: 'right' },
  };
}

export function statusCol<T>(field: string, header: string, width = 110): ColDef<T> {
  return {
    field: field as never,
    headerName: header,
    width,
    cellRenderer: statusCellRenderer,
  };
}

export function textCol<T>(field: string, header: string, width?: number, flex?: number): ColDef<T> {
  const def: ColDef<T> = { field: field as never, headerName: header };
  if (width) def.width = width;
  if (flex) def.flex = flex;
  return def;
}

// ── Overdue row style helper ──────────────────────────────────────────────────
export function overdueRowClass(params: { data?: Record<string, unknown> }): string {
  return params.data?.overdue === true ? 'erp-row-overdue' : '';
}
