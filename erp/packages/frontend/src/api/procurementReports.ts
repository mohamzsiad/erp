import { useQuery } from '@tanstack/react-query';
import api from './client';

// ── Common filter types ───────────────────────────────────────────────────────
export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  supplierId?: string;
  itemId?: string;
  status?: string;
}

// ── Report row types ──────────────────────────────────────────────────────────
export interface PrStatusRow {
  prlId: string;
  docNo: string;
  docDate: string;
  location: string;
  itemCode: string;
  itemDescription: string;
  requestedQty: number;
  approvedQty: number;
  poStatus: string | null;
  pendingQty: number;
  status: string;
}

export interface PoStatusRow {
  poId: string;
  docNo: string;
  docDate: string;
  supplier: string;
  itemCode: string;
  itemDescription: string;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  balanceQty: number;
  netAmount: number;
  deliveryDate: string | null;
  overdue: boolean;
  status: string;
}

export interface PoHistoryRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  totalOrders: number;
  totalValue: number;
  avgLeadTimeDays: number | null;
  lastOrderDate: string | null;
}

export interface ProcurementTrackingRow {
  docNo: string;
  prDate: string;
  poDocNo: string | null;
  poDate: string | null;
  daysElapsed: number;
  status: string;
  location: string;
}

export interface LeadTimeVarianceRow {
  supplierCode: string;
  supplierName: string;
  itemCode: string;
  itemDescription: string;
  plannedLeadDays: number;
  actualLeadDays: number;
  variance: number;
  poCount: number;
}

export interface PriceComparisonRow {
  itemCode: string;
  itemDescription: string;
  uom: string;
  supplierCode: string;
  supplierName: string;
  price1: number | null;
  price2: number | null;
  price3: number | null;
  price4: number | null;
  price5: number | null;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface PendingPrRow {
  prlId: string;
  docNo: string;
  docDate: string;
  location: string;
  ageDays: number;
  ageBucket: string;
  itemCount: number;
  totalRequestedQty: number;
  status: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────
const BASE = '/procurement/reports';

function cleanParams(f: ReportFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(f).filter(([, v]) => v != null && v !== '')
  ) as Record<string, string>;
}

export const reportApi = {
  prStatus:              (f: ReportFilters) => api.get<PrStatusRow[]>            (`${BASE}/pr-status`,              { params: cleanParams(f) }).then(r => r.data),
  poStatus:              (f: ReportFilters) => api.get<PoStatusRow[]>             (`${BASE}/po-status`,              { params: cleanParams(f) }).then(r => r.data),
  poHistoryBySupplier:   (f: ReportFilters) => api.get<PoHistoryRow[]>            (`${BASE}/po-history-by-supplier`, { params: cleanParams(f) }).then(r => r.data),
  procurementTracking:   (f: ReportFilters) => api.get<ProcurementTrackingRow[]>  (`${BASE}/procurement-tracking`,  { params: cleanParams(f) }).then(r => r.data),
  leadTimeVariance:      (f: ReportFilters) => api.get<LeadTimeVarianceRow[]>     (`${BASE}/lead-time-variance`,    { params: cleanParams(f) }).then(r => r.data),
  priceComparison:       (f: ReportFilters) => api.get<PriceComparisonRow[]>      (`${BASE}/price-comparison`,      { params: cleanParams(f) }).then(r => r.data),
  pendingPr:             (f: ReportFilters) => api.get<PendingPrRow[]>            (`${BASE}/pending-pr`,            { params: cleanParams(f) }).then(r => r.data),

  /** Trigger browser download of xlsx by navigating directly */
  downloadXlsx: (endpoint: string, filters: ReportFilters) => {
    const token = localStorage.getItem('accessToken') ?? '';
    const params = new URLSearchParams({ ...cleanParams(filters), export: 'xlsx' });
    // Use axios to get the blob, then trigger download
    return api.get(`${BASE}/${endpoint}?${params}`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      const url = URL.createObjectURL(r.data as Blob);
      const disposition = (r.headers as Record<string,string>)['content-disposition'] ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${endpoint}.xlsx`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  },
};

// ── React Query hooks ─────────────────────────────────────────────────────────
// Each hook is lazy: only fetches when `enabled` is true (user clicked "Generate")
export const usePrStatusReport = (filters: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report', 'pr-status', filters], queryFn: () => reportApi.prStatus(filters), enabled });

export const usePoStatusReport = (filters: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report', 'po-status', filters], queryFn: () => reportApi.poStatus(filters), enabled });

export const usePoHistoryReport = (filters: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report', 'po-history', filters], queryFn: () => reportApi.poHistoryBySupplier(filters), enabled });

export const useProcurementTrackingReport = (filters: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report', 'tracking', filters], queryFn: () => reportApi.procurementTracking(filters), enabled });

export const useLeadTimeVarianceReport = (filters: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report', 'lead-time', filters], queryFn: () => reportApi.leadTimeVariance(filters), enabled });

export const usePriceComparisonReport = (filters: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report', 'price-comparison', filters], queryFn: () => reportApi.priceComparison(filters), enabled });

export const usePendingPrReport = (filters: ReportFilters, enabled: boolean) =>
  useQuery({ queryKey: ['report', 'pending-pr', filters], queryFn: () => reportApi.pendingPr(filters), enabled });
