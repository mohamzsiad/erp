/**
 * TanStack Query hooks for the 7 PR line sub-sections.
 * All hooks take (prlId, lineId) so query keys are scoped correctly.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

// ── Query Key Factory ─────────────────────────────────────────────────────────
export const PR_SUB_KEYS = {
  deliverySchedule: (prlId: string, lineId: string) =>
    ['prl', prlId, 'lines', lineId, 'delivery-schedule'] as const,
  accountDetails: (prlId: string, lineId: string) =>
    ['prl', prlId, 'lines', lineId, 'account-details'] as const,
  alternateItems: (prlId: string, lineId: string) =>
    ['prl', prlId, 'lines', lineId, 'alternate-items'] as const,
  itemStatus: (prlId: string, lineId: string) =>
    ['prl', prlId, 'lines', lineId, 'item-status'] as const,
  shortClose: (prlId: string, lineId: string) =>
    ['prl', prlId, 'lines', lineId, 'short-close'] as const,
  attachments: (prlId: string, lineId: string) =>
    ['prl', prlId, 'lines', lineId, 'attachments'] as const,
  leadTime: (prlId: string, lineId: string) =>
    ['prl', prlId, 'lines', lineId, 'lead-time'] as const,
};

const BASE = (prlId: string, lineId: string) =>
  `/procurement/prl/${prlId}/lines/${lineId}`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeliveryScheduleRow {
  id?: string;
  deliveryDate: string;
  qty: number;
  locationId?: string | null;
  remarks?: string | null;
  location?: { id: string; code: string; name: string } | null;
}

export interface AccountDetailRow {
  id?: string;
  glAccountId: string;
  costCentreId: string;
  projectCode?: string | null;
  percentage: number;
  amount?: number;
  budgetYear: number;
  glAccount?: { id: string; code: string; name: string };
  costCentre?: { id: string; code: string; name: string };
}

export interface AlternateItemRow {
  id?: string;
  itemId: string;
  grade1?: string | null;
  grade2?: string | null;
  uom?: string | null;
  approxPrice?: number;
  priority: number;
  remarks?: string | null;
  item?: { id: string; code: string; description: string };
}

export interface ItemStatusData {
  itemId: string;
  itemCode: string;
  description: string;
  currentStock: number;
  reservedQty: number;
  availableStock: number;
  openPRQty: number;
  openPOQty: number;
  lastPurchaseDate: string | null;
  lastPurchasePrice: number | null;
  lastSupplier: string | null;
  avgLeadTimeDays: number | null;
  reorderLevel: number | null;
  safetyStock: number | null;
}

export interface ShortCloseInfo {
  id: string;
  requestedQty: number;
  shortClosedQty: number;
  shortCloseReason: string | null;
  shortClosedAt: string | null;
  shortClosedById: string | null;
  shortCloseStatus: 'NONE' | 'PARTIAL' | 'FULL';
  onPOQty: number;
  prStatus: string;
}

export interface AttachmentItem {
  id: string;
  fileName: string;
  blobUrl: string;
  sasUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: string;
}

export interface LeadTimeData {
  itemId: string;
  systemLeadTimeDays: number | null;
  manualLeadTimeDays: number | null;
  effectiveLeadTimeDays: number;
  source: 'SYSTEM' | 'MANUAL';
  expectedDeliveryDate: string | null;
  prApprovalDate: string | null;
  historicalLeadTimes: Array<{
    poNumber: string;
    supplier: string;
    poDate: string;
    leadTimeDays: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DELIVERY SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

export function useDeliverySchedules(prlId: string, lineId: string, enabled = true) {
  return useQuery<DeliveryScheduleRow[]>({
    queryKey: PR_SUB_KEYS.deliverySchedule(prlId, lineId),
    queryFn:  () => api.get(BASE(prlId, lineId) + '/delivery-schedule').then((r) => r.data),
    enabled:  enabled && !!prlId && !!lineId,
    staleTime: 30_000,
  });
}

export function useUpsertDeliverySchedules(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: DeliveryScheduleRow[]) =>
      api.post(BASE(prlId, lineId) + '/delivery-schedule', { rows }).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.deliverySchedule(prlId, lineId) }),
  });
}

export function useDeleteDeliverySchedule(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) =>
      api.delete(BASE(prlId, lineId) + `/delivery-schedule/${scheduleId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.deliverySchedule(prlId, lineId) }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ACCOUNT DETAILS
// ═══════════════════════════════════════════════════════════════════════════════

export function useAccountDetails(prlId: string, lineId: string, enabled = true) {
  return useQuery<AccountDetailRow[]>({
    queryKey: PR_SUB_KEYS.accountDetails(prlId, lineId),
    queryFn:  () => api.get(BASE(prlId, lineId) + '/account-details').then((r) => r.data),
    enabled:  enabled && !!prlId && !!lineId,
    staleTime: 30_000,
  });
}

export function useUpsertAccountDetails(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: AccountDetailRow[]) =>
      api.post(BASE(prlId, lineId) + '/account-details', { rows }).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.accountDetails(prlId, lineId) }),
  });
}

export function useDeleteAccountDetail(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (detailId: string) =>
      api.delete(BASE(prlId, lineId) + `/account-details/${detailId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.accountDetails(prlId, lineId) }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ALTERNATE ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

export function useAlternateItems(prlId: string, lineId: string, enabled = true) {
  return useQuery<AlternateItemRow[]>({
    queryKey: PR_SUB_KEYS.alternateItems(prlId, lineId),
    queryFn:  () => api.get(BASE(prlId, lineId) + '/alternate-items').then((r) => r.data),
    enabled:  enabled && !!prlId && !!lineId,
    staleTime: 30_000,
  });
}

export function useUpsertAlternateItems(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: AlternateItemRow[]) =>
      api.post(BASE(prlId, lineId) + '/alternate-items', { rows }).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.alternateItems(prlId, lineId) }),
  });
}

export function useDeleteAlternateItem(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (altId: string) =>
      api.delete(BASE(prlId, lineId) + `/alternate-items/${altId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.alternateItems(prlId, lineId) }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ITEM STATUS
// ═══════════════════════════════════════════════════════════════════════════════

export function useItemStatus(prlId: string, lineId: string, enabled = true) {
  return useQuery<ItemStatusData>({
    queryKey: PR_SUB_KEYS.itemStatus(prlId, lineId),
    queryFn:  () => api.get(BASE(prlId, lineId) + '/item-status').then((r) => r.data),
    enabled:  enabled && !!prlId && !!lineId,
    staleTime: 60_000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SHORT CLOSE
// ═══════════════════════════════════════════════════════════════════════════════

export function useShortCloseInfo(prlId: string, lineId: string, enabled = true) {
  return useQuery<ShortCloseInfo>({
    queryKey: PR_SUB_KEYS.shortClose(prlId, lineId),
    queryFn:  () => api.get(BASE(prlId, lineId) + '/short-close').then((r) => r.data),
    enabled:  enabled && !!prlId && !!lineId,
    staleTime: 30_000,
  });
}

export function useShortCloseLine(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { qty: number; reason: string }) =>
      api.post(BASE(prlId, lineId) + '/short-close', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.shortClose(prlId, lineId) });
      qc.invalidateQueries({ queryKey: ['prl', prlId] });
    },
  });
}

export function useReopenLine(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post(BASE(prlId, lineId) + '/reopen', {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.shortClose(prlId, lineId) });
      qc.invalidateQueries({ queryKey: ['prl', prlId] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export function useAttachments(prlId: string, lineId: string, enabled = true) {
  return useQuery<AttachmentItem[]>({
    queryKey: PR_SUB_KEYS.attachments(prlId, lineId),
    queryFn:  () => api.get(BASE(prlId, lineId) + '/attachments').then((r) => r.data),
    enabled:  enabled && !!prlId && !!lineId,
    staleTime: 60_000,
  });
}

export function useUploadAttachment(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(BASE(prlId, lineId) + '/attachments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.attachments(prlId, lineId) }),
  });
}

export function useDeleteAttachment(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete(BASE(prlId, lineId) + `/attachments/${attachmentId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.attachments(prlId, lineId) }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. LEAD TIME
// ═══════════════════════════════════════════════════════════════════════════════

export function useLeadTime(prlId: string, lineId: string, enabled = true) {
  return useQuery<LeadTimeData>({
    queryKey: PR_SUB_KEYS.leadTime(prlId, lineId),
    queryFn:  () => api.get(BASE(prlId, lineId) + '/lead-time').then((r) => r.data),
    enabled:  enabled && !!prlId && !!lineId,
    staleTime: 60_000,
  });
}

export function useUpdateLeadTime(prlId: string, lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadTimeDays: number | null) =>
      api.patch(BASE(prlId, lineId) + '/lead-time', { leadTimeDays }).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: PR_SUB_KEYS.leadTime(prlId, lineId) }),
  });
}
