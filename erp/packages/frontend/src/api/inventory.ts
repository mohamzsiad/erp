/**
 * Inventory API — React Query hooks + raw search helpers
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type { LookupOption } from '../components/ui/LookupField';

// ── Query key factories ────────────────────────────────────────────────────────
export const INV_KEYS = {
  items:           { list: (p: object) => ['inv', 'items', 'list', p] as const,   detail: (id: string) => ['inv', 'items', id] as const },
  itemStock:       (id: string) => ['inv', 'items', id, 'stock'] as const,
  itemTxns:        (id: string, p: object) => ['inv', 'items', id, 'txns', p] as const,
  itemSuppliers:   (id: string) => ['inv', 'items', id, 'suppliers'] as const,
  itemAttachments: (id: string) => ['inv', 'items', id, 'attachments'] as const,
  reorder:         ['inv', 'reorder-alerts'] as const,
  categories:      ['inv', 'categories'] as const,
  uoms:            ['inv', 'uoms'] as const,
  warehouses:  { list: (p: object) => ['inv', 'wh', 'list', p] as const, detail: (id: string) => ['inv', 'wh', id] as const },
  bins:        { list: (p: object) => ['inv', 'bins', 'list', p] as const, detail: (id: string) => ['inv', 'bins', id] as const },
  grn:         { list: (p: object) => ['inv', 'grn', 'list', p] as const,  detail: (id: string) => ['inv', 'grn', id] as const },
  issue:       { list: (p: object) => ['inv', 'issue', 'list', p] as const, detail: (id: string) => ['inv', 'issue', id] as const },
  transfer:    { list: (p: object) => ['inv', 'transfer', 'list', p] as const, detail: (id: string) => ['inv', 'transfer', id] as const },
  adjustment:  { list: (p: object) => ['inv', 'adj', 'list', p] as const,   detail: (id: string) => ['inv', 'adj', id] as const },
  adjReasons:  ['inv', 'adj-reasons'] as const,
  physCount:   { list: (p: object) => ['inv', 'pc', 'list', p] as const, detail: (id: string) => ['inv', 'pc', id] as const },
  stockSummary:['inv', 'stock-summary'] as const,
};

// ── Generic helpers ────────────────────────────────────────────────────────────
const get    = <T>(url: string, params?: object) => api.get<{ data: T }>(url, { params }).then(r => r.data);
const post   = <T>(url: string, body?: unknown)   => api.post<{ data: T }>(url, body).then(r => r.data);
const patch  = <T>(url: string, body?: unknown)   => api.patch<{ data: T }>(url, body).then(r => r.data);
const del    = (url: string)                      => api.delete(url);

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────────────────────────────────────
export interface ItemListParams { page?: number; limit?: number; search?: string; categoryId?: string; status?: string; }

export function useItemList(params: ItemListParams) {
  return useQuery({ queryKey: INV_KEYS.items.list(params), queryFn: () => get('/inventory/items', params) });
}
export function useItem(id?: string) {
  return useQuery({ queryKey: INV_KEYS.items.detail(id!), queryFn: () => get(`/inventory/items/${id}`), enabled: !!id });
}
export function useItemStock(id?: string) {
  return useQuery({ queryKey: INV_KEYS.itemStock(id!), queryFn: () => get(`/inventory/items/${id}/stock`), enabled: !!id });
}
export function useItemTransactions(id: string, params: object) {
  return useQuery({ queryKey: INV_KEYS.itemTxns(id, params), queryFn: () => get(`/inventory/items/${id}/transactions`, params), enabled: !!id });
}
export function useItemCategories() {
  return useQuery({ queryKey: INV_KEYS.categories, queryFn: () => get('/inventory/items/categories') });
}
export function useUoms() {
  return useQuery({ queryKey: INV_KEYS.uoms, queryFn: () => get('/inventory/items/uoms') });
}
export function useReorderAlerts() {
  return useQuery({ queryKey: INV_KEYS.reorder, queryFn: () => get('/inventory/items/reorder-alerts') });
}
export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => post('/inventory/items', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'items'] }) });
}
export function useUpdateItem(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => patch(`/inventory/items/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'items'] }) });
}

// ── Item Supplier X-Ref ────────────────────────────────────────────────────────
export function useItemSupplierXRefs(itemId?: string) {
  return useQuery({ queryKey: INV_KEYS.itemSuppliers(itemId!), queryFn: () => get(`/inventory/items/${itemId}/suppliers`), enabled: !!itemId });
}
export function useUpsertItemSupplierXRefs(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: unknown[]) => api.put(`/inventory/items/${itemId}/suppliers`, { rows }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: INV_KEYS.itemSuppliers(itemId) }),
  });
}
export function useDeleteItemSupplierXRef(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (xrefId: string) => api.delete(`/inventory/items/${itemId}/suppliers/${xrefId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: INV_KEYS.itemSuppliers(itemId) }),
  });
}

// ── Item Attachments ──────────────────────────────────────────────────────────
export function useItemAttachments(itemId?: string) {
  return useQuery({ queryKey: INV_KEYS.itemAttachments(itemId!), queryFn: () => get(`/inventory/items/${itemId}/attachments`), enabled: !!itemId });
}
export function useAddItemAttachment(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => post(`/inventory/items/${itemId}/attachments`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: INV_KEYS.itemAttachments(itemId) }),
  });
}
export function useDeleteItemAttachment(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attId: string) => api.delete(`/inventory/items/${itemId}/attachments/${attId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: INV_KEYS.itemAttachments(itemId) }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WAREHOUSES
// ─────────────────────────────────────────────────────────────────────────────
export function useWarehouseList(params: object) {
  return useQuery({ queryKey: INV_KEYS.warehouses.list(params), queryFn: () => get('/inventory/warehouses', params) });
}
export function useWarehouse(id?: string) {
  return useQuery({ queryKey: INV_KEYS.warehouses.detail(id!), queryFn: () => get(`/inventory/warehouses/${id}`), enabled: !!id });
}
export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => post('/inventory/warehouses', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'wh'] }) });
}
export function useUpdateWarehouse(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => patch(`/inventory/warehouses/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'wh'] }) });
}

// ─────────────────────────────────────────────────────────────────────────────
// BINS
// ─────────────────────────────────────────────────────────────────────────────
export function useBinList(params: object) {
  return useQuery({ queryKey: INV_KEYS.bins.list(params), queryFn: () => get('/inventory/bins', params) });
}
export function useBin(id?: string) {
  return useQuery({ queryKey: INV_KEYS.bins.detail(id!), queryFn: () => get(`/inventory/bins/${id}`), enabled: !!id });
}
export function useCreateBin() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => post('/inventory/bins', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'bins'] }) });
}
export function useUpdateBin(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => patch(`/inventory/bins/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'bins'] }) });
}

// ─────────────────────────────────────────────────────────────────────────────
// GRN
// ─────────────────────────────────────────────────────────────────────────────
export function useGrnList(params: object) {
  return useQuery({ queryKey: INV_KEYS.grn.list(params), queryFn: () => get('/inventory/grn', params) });
}
export function useGrn(id?: string) {
  return useQuery({ queryKey: INV_KEYS.grn.detail(id!), queryFn: () => get(`/inventory/grn/${id}`), enabled: !!id });
}
export function useCreateGrn() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => post('/inventory/grn', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'grn'] }) });
}
export function useUpdateGrn(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => patch(`/inventory/grn/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'grn'] }) });
}
export function usePostGrn(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/grn/${id}/post`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'grn'] }) });
}
export function useCancelGrn(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/grn/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'grn'] }) });
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK ISSUE
// ─────────────────────────────────────────────────────────────────────────────
export function useIssueList(params: object) {
  return useQuery({ queryKey: INV_KEYS.issue.list(params), queryFn: () => get('/inventory/issue', params) });
}
export function useIssue(id?: string) {
  return useQuery({ queryKey: INV_KEYS.issue.detail(id!), queryFn: () => get(`/inventory/issue/${id}`), enabled: !!id });
}
export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => post('/inventory/issue', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'issue'] }) });
}
export function usePostIssue(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/issue/${id}/post`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'issue'] }) });
}
export function useCancelIssue(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/issue/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'issue'] }) });
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TRANSFER
// ─────────────────────────────────────────────────────────────────────────────
export function useTransferList(params: object) {
  return useQuery({ queryKey: INV_KEYS.transfer.list(params), queryFn: () => get('/inventory/transfer', params) });
}
export function useTransfer(id?: string) {
  return useQuery({ queryKey: INV_KEYS.transfer.detail(id!), queryFn: () => get(`/inventory/transfer/${id}`), enabled: !!id });
}
export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => post('/inventory/transfer', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'transfer'] }) });
}
export function usePostTransfer(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/transfer/${id}/post`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'transfer'] }) });
}
export function useCancelTransfer(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/transfer/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'transfer'] }) });
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK ADJUSTMENT
// ─────────────────────────────────────────────────────────────────────────────
export function useAdjustmentList(params: object) {
  return useQuery({ queryKey: INV_KEYS.adjustment.list(params), queryFn: () => get('/inventory/adjustment', params) });
}
export function useAdjustment(id?: string) {
  return useQuery({ queryKey: INV_KEYS.adjustment.detail(id!), queryFn: () => get(`/inventory/adjustment/${id}`), enabled: !!id });
}
export function useAdjustmentReasons() {
  return useQuery({ queryKey: INV_KEYS.adjReasons, queryFn: () => get('/inventory/adjustment/reasons') });
}
export function useCreateAdjustment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => post('/inventory/adjustment', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'adj'] }) });
}
export function useSubmitAdjustment(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/adjustment/${id}/submit`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'adj'] }) });
}
export function useApproveAdjustment(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/adjustment/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'adj'] }) });
}
export function useRejectAdjustment(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/inventory/adjustment/${id}/reject`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'adj'] }) });
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK SUMMARY / QUERIES
// ─────────────────────────────────────────────────────────────────────────────
export function useStockSummary() {
  return useQuery({ queryKey: INV_KEYS.stockSummary, queryFn: () => get('/inventory/stock-summary') });
}
export function useDeadStock(noMovementDays = 90) {
  return useQuery({ queryKey: ['inv', 'dead-stock', noMovementDays], queryFn: () => get('/inventory/stock-summary/dead-stock', { noMovementDays }) });
}
export function usePendingDocuments() {
  return useQuery({ queryKey: ['inv', 'pending-docs'], queryFn: () => get('/inventory/stock-summary/pending-documents') });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS (used by LookupField onSearch)
// ─────────────────────────────────────────────────────────────────────────────
export async function searchItems(q: string): Promise<LookupOption[]> {
  const res = await api.get('/inventory/items/search', { params: { q, limit: 20 } });
  const items: any[] = res.data?.data ?? res.data ?? [];
  return items.map((i: any) => ({ value: i.id, label: `${i.code} – ${i.description}`, subLabel: i.uom?.code, meta: i }));
}

export async function searchWarehouses(q: string): Promise<LookupOption[]> {
  const res = await api.get('/inventory/warehouses', { params: { search: q, limit: 20 } });
  const whs: any[] = res.data?.data ?? [];
  return whs.map((w: any) => ({ value: w.id, label: `${w.code} – ${w.name}`, meta: w }));
}

export async function searchBins(q: string, warehouseId?: string): Promise<LookupOption[]> {
  const res = await api.get('/inventory/bins', { params: { search: q, warehouseId, limit: 20 } });
  const bins: any[] = res.data?.data ?? [];
  return bins.map((b: any) => ({ value: b.id, label: `${b.code}${b.name ? ' – ' + b.name : ''}`, meta: b }));
}

export async function searchOpenPos(q: string): Promise<LookupOption[]> {
  const res = await api.get('/procurement/po', { params: { search: q, status: 'APPROVED', limit: 20 } });
  const pos: any[] = res.data?.data ?? [];
  return pos.map((p: any) => ({
    value: p.id,
    label: p.docNo,
    subLabel: p.supplierId,
    meta: p,
  }));
}

export async function searchChargeCodes(q: string): Promise<LookupOption[]> {
  try {
    const res = await api.get('/procurement/charge-codes', { params: { search: q, limit: 20 } });
    const cc: any[] = res.data?.data ?? [];
    return cc.map((c: any) => ({ value: c.id, label: `${c.code} – ${c.name}` }));
  } catch {
    return [];
  }
}

export async function searchMrls(q: string): Promise<LookupOption[]> {
  try {
    const res = await api.get('/procurement/mrl', { params: { search: q, limit: 20 } });
    const mrls: any[] = res.data?.data ?? [];
    return mrls.map((m: any) => ({ value: m.id, label: m.docNo, subLabel: m.purpose }));
  } catch {
    return [];
  }
}

export async function fetchPoLines(poId: string): Promise<any[]> {
  const res = await api.get(`/procurement/po/${poId}`);
  return res.data?.data?.lines ?? res.data?.lines ?? [];
}
