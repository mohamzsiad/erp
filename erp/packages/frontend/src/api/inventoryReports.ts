/**
 * Inventory Reports API — hooks + download helper
 */
import { useQuery } from '@tanstack/react-query';
import api from './client';

// ── Filter types ───────────────────────────────────────────────────────────────
export interface InvReportFilters {
  dateFrom?:       string;
  dateTo?:         string;
  asOfDate?:       string;
  itemId?:         string;
  warehouseId?:    string;
  categoryId?:     string;
  supplierId?:     string;
  noMovementDays?: number;
}

// ── Row types ──────────────────────────────────────────────────────────────────
export interface StockBalanceRow {
  itemCode: string; description: string; category: string; uom: string;
  warehouseCode: string; warehouseName: string; binCode: string;
  qtyOnHand: number; qtyReserved: number; qtyAvailable: number;
  avgCost: number; stockValue: number; status: string;
}

export interface StockAgingRow {
  itemCode: string; description: string; category: string; uom: string;
  warehouseCode: string; binCode: string;
  qtyOnHand: number; avgCost: number; stockValue: number;
  lastMovement: string | null; ageDays: number; ageBucket: string; status: string;
}

export interface DioStockRow {
  itemCode: string; description: string; category: string; uom: string;
  warehouseCode: string; qtyOnHand: number; avgCost: number; stockValue: number;
  lastMovement: string | null; ageDays: number | null; status: string;
}

export interface GrnSummaryRow {
  grnNo: string; docDate: string; poNo: string;
  supplierCode: string; supplierName: string; warehouse: string;
  itemCode: string; description: string; category: string; uom: string;
  receivedQty: number; acceptedQty: number; rejectedQty: number;
  unitCost: number; lineValue: number;
}

export interface StockMovementRow {
  date: string; transactionType: string; sourceDocNo: string;
  itemCode: string; description: string; uom: string;
  warehouse: string; bin: string;
  inQty: number | null; outQty: number | null; balance: number;
  avgCost: number; movementValue: number;
}

export interface ReorderRow {
  itemCode: string; description: string; category: string; uom: string;
  reorderLevel: number; reorderQty: number;
  qtyOnHand: number; qtyReserved: number; qtyAvailable: number;
  shortage: number; suggestedOrderQty: number;
  leadTimeDays: number; standardCost: number; estimatedValue: number;
}

export interface ValuationRow {
  category: string; itemCode: string; description: string; uom: string;
  warehouseCode: string; warehouseName: string;
  qtyOnHand: number; avgCost: number; stockValue: number; status: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const BASE = '/inventory/reports';

function cleanParams(f: InvReportFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(f).filter(([, v]) => v != null && v !== ''),
  ) as Record<string, string>;
}

export const invReportApi = {
  stockBalance:       (f: InvReportFilters) => api.get<StockBalanceRow[]>   (`${BASE}/stock-balance`,          { params: cleanParams(f) }).then(r => r.data),
  stockAging:         (f: InvReportFilters) => api.get<StockAgingRow[]>     (`${BASE}/stock-aging`,            { params: cleanParams(f) }).then(r => r.data),
  deadInactiveObs:    (f: InvReportFilters) => api.get<{ dead: DioStockRow[]; inactive: DioStockRow[]; obsolete: DioStockRow[]; thresholdDays: number }>(`${BASE}/dead-inactive-obsolete`, { params: cleanParams(f) }).then(r => r.data),
  grnSummary:         (f: InvReportFilters) => api.get<GrnSummaryRow[]>     (`${BASE}/grn-summary`,            { params: cleanParams(f) }).then(r => r.data),
  stockMovement:      (f: InvReportFilters) => api.get<StockMovementRow[]>  (`${BASE}/stock-movement`,         { params: cleanParams(f) }).then(r => r.data),
  reorderReport:      (f: InvReportFilters) => api.get<ReorderRow[]>        (`${BASE}/reorder-report`,         { params: cleanParams(f) }).then(r => r.data),
  valuation:          (f: InvReportFilters) => api.get<{ rows: ValuationRow[]; byCategory: Record<string,{qty:number;value:number}>; grandTotal: number }>(`${BASE}/valuation`, { params: cleanParams(f) }).then(r => r.data),

  downloadXlsx: (endpoint: string, filters: InvReportFilters) =>
    api.get(`${BASE}/${endpoint}`, { params: { ...cleanParams(filters), export: 'xlsx' }, responseType: 'blob' }).then((r) => {
      const url  = URL.createObjectURL(r.data as Blob);
      const disp = (r.headers as Record<string, string>)['content-disposition'] ?? '';
      const name = disp.match(/filename="([^"]+)"/)?.[1] ?? `${endpoint}.xlsx`;
      Object.assign(document.createElement('a'), { href: url, download: name }).click();
      URL.revokeObjectURL(url);
    }),
};

// ── Hooks (lazy — only fetches after Generate) ─────────────────────────────
export const useStockBalanceReport    = (f: InvReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inv-report', 'stock-balance',     f], queryFn: () => invReportApi.stockBalance(f),    enabled });

export const useStockAgingReport      = (f: InvReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inv-report', 'stock-aging',       f], queryFn: () => invReportApi.stockAging(f),      enabled });

export const useDeadInactiveObsReport = (f: InvReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inv-report', 'dead-inactive-obs', f], queryFn: () => invReportApi.deadInactiveObs(f), enabled });

export const useGrnSummaryReport      = (f: InvReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inv-report', 'grn-summary',       f], queryFn: () => invReportApi.grnSummary(f),      enabled });

export const useStockMovementReport   = (f: InvReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inv-report', 'stock-movement',    f], queryFn: () => invReportApi.stockMovement(f),   enabled });

export const useReorderReport         = (f: InvReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inv-report', 'reorder',           f], queryFn: () => invReportApi.reorderReport(f),   enabled });

export const useValuationReport       = (f: InvReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inv-report', 'valuation',         f], queryFn: () => invReportApi.valuation(f),       enabled });
