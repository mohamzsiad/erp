import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type {
  Supplier,
  SupplierWithDetails,
  MaterialRequisition,
  MrlLine,
  PurchaseRequisition,
  PrlLine,
  PurchaseOrder,
  PoLine,
} from '@clouderp/shared';
import type { PaginatedResponse } from '@clouderp/shared';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const SUPPLIER_KEYS = {
  all: ['suppliers'] as const,
  list: (params: object) => ['suppliers', 'list', params] as const,
  detail: (id: string) => ['suppliers', id] as const,
};

export const MRL_KEYS = {
  all: ['mrl'] as const,
  list: (params: object) => ['mrl', 'list', params] as const,
  detail: (id: string) => ['mrl', id] as const,
};

export const PRL_KEYS = {
  all: ['prl'] as const,
  list: (params: object) => ['prl', 'list', params] as const,
  detail: (id: string) => ['prl', id] as const,
};

export const PO_KEYS = {
  all: ['po'] as const,
  list: (params: object) => ['po', 'list', params] as const,
  detail: (id: string) => ['po', id] as const,
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SupplierListParams {
  page?: number;
  limit?: number;
  search?: string;
  locationId?: string;
  isActive?: boolean;
}

export interface DocListParams {
  page?: number;
  limit?: number;
  search?: string;
  locationId?: string;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateSupplierInput {
  name: string;
  shortName: string;
  locationId: string;
  controlAccountId?: string;
  creditDays?: number;
  creditAmount?: number;
  shipmentMode?: string;
  isTdsApplicable?: boolean;
  isParentSupplier?: boolean;
  parentSupplierId?: string;
}

export interface CreateMrlInput {
  locationId: string;
  docDate: string;
  chargeCodeId: string;
  deliveryDate: string;
  remarks?: string;
  lines: Omit<MrlLine, 'id' | 'mrlId' | 'freeStock'>[];
}

export interface CreatePrlInput {
  locationId: string;
  docDate: string;
  chargeCodeId: string;
  deliveryDate: string;
  remarks?: string;
  mrlId?: string;
  lines: Omit<PrlLine, 'id' | 'prlId' | 'freeStock' | 'isShortClosed'>[];
}

export interface CreatePoInput {
  supplierId: string;
  docDate: string;
  currencyId?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  incoterms?: string;
  deliveryDate?: string;
  shipToLocationId?: string;
  lines: Omit<PoLine, 'id' | 'poId' | 'receivedQty' | 'invoicedQty' | 'netAmount'>[];
}

export interface WorkflowActionInput {
  action: 'approve' | 'reject';
  comment?: string;
  lineAdjustments?: { lineId: string; approvedQty: number }[];
}

export interface StockSummaryResponse {
  obsoleteStock: number;
  inactiveStock: number;
  deadStock: number;
  pendingIssues: number;
  pendingLto: number;
  pendingGrn: number;
}

// ── Supplier API ──────────────────────────────────────────────────────────────
export const supplierApi = {
  list: (params: SupplierListParams) =>
    api.get<PaginatedResponse<Supplier>>('/procurement/suppliers', { params }).then((r) => r.data),

  search: (q: string) =>
    api.get<Supplier[]>('/procurement/suppliers/search', { params: { q } }).then((r) => r.data),

  getById: (id: string) =>
    api.get<SupplierWithDetails>(`/procurement/suppliers/${id}`).then((r) => r.data),

  create: (data: CreateSupplierInput) =>
    api.post<SupplierWithDetails>('/procurement/suppliers', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateSupplierInput>) =>
    api.put<SupplierWithDetails>(`/procurement/suppliers/${id}`, data).then((r) => r.data),

  toggleActive: (id: string) =>
    api.patch<{ isActive: boolean }>(`/procurement/suppliers/${id}/toggle-active`).then((r) => r.data),

  getStatement: (id: string) =>
    api.get(`/procurement/suppliers/${id}/statement`).then((r) => r.data),
};

// ── Supplier Hooks ────────────────────────────────────────────────────────────
export const useSupplierList = (params: SupplierListParams) =>
  useQuery({
    queryKey: SUPPLIER_KEYS.list(params),
    queryFn: () => supplierApi.list(params),
  });

export const useSupplier = (id: string | undefined) =>
  useQuery({
    queryKey: SUPPLIER_KEYS.detail(id ?? ''),
    queryFn: () => supplierApi.getById(id!),
    enabled: !!id,
  });

export const useCreateSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supplierApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIER_KEYS.all }),
  });
};

export const useUpdateSupplier = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateSupplierInput>) => supplierApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUPPLIER_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: SUPPLIER_KEYS.all });
    },
  });
};

export const useToggleSupplierActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supplierApi.toggleActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIER_KEYS.all }),
  });
};

// ── MRL API ───────────────────────────────────────────────────────────────────
export const mrlApi = {
  list: (params: DocListParams) =>
    api.get<PaginatedResponse<MaterialRequisition>>('/procurement/mrl', { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<MaterialRequisition>(`/procurement/mrl/${id}`).then((r) => r.data),

  create: (data: CreateMrlInput) =>
    api.post<MaterialRequisition>('/procurement/mrl', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateMrlInput>) =>
    api.put<MaterialRequisition>(`/procurement/mrl/${id}`, data).then((r) => r.data),

  submit: (id: string) =>
    api.post<MaterialRequisition>(`/procurement/mrl/${id}/submit`).then((r) => r.data),

  approve: (id: string, input: WorkflowActionInput) =>
    api.post(`/procurement/mrl/${id}/approve`, input).then((r) => r.data),

  reject: (id: string, input: WorkflowActionInput) =>
    api.post(`/procurement/mrl/${id}/reject`, input).then((r) => r.data),

  convertToPrl: (id: string) =>
    api.post<PurchaseRequisition>(`/procurement/mrl/${id}/convert-to-prl`).then((r) => r.data),
};

// ── MRL Hooks ─────────────────────────────────────────────────────────────────
export const useMrlList = (params: DocListParams) =>
  useQuery({
    queryKey: MRL_KEYS.list(params),
    queryFn: () => mrlApi.list(params),
  });

export const useMrl = (id: string | undefined) =>
  useQuery({
    queryKey: MRL_KEYS.detail(id ?? ''),
    queryFn: () => mrlApi.getById(id!),
    enabled: !!id,
  });

export const useCreateMrl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mrlApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: MRL_KEYS.all }),
  });
};

export const useUpdateMrl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateMrlInput>) => mrlApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MRL_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: MRL_KEYS.all });
    },
  });
};

export const useSubmitMrl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => mrlApi.submit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MRL_KEYS.detail(id) }),
  });
};

export const useApproveMrl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkflowActionInput) => mrlApi.approve(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MRL_KEYS.detail(id) }),
  });
};

export const useRejectMrl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkflowActionInput) => mrlApi.reject(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: MRL_KEYS.detail(id) }),
  });
};

export const useConvertMrlToPrl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => mrlApi.convertToPrl(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MRL_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PRL_KEYS.all });
    },
  });
};

// ── PRL API ───────────────────────────────────────────────────────────────────
export const prlApi = {
  list: (params: DocListParams) =>
    api.get<PaginatedResponse<PurchaseRequisition>>('/procurement/prl', { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<PurchaseRequisition>(`/procurement/prl/${id}`).then((r) => r.data),

  create: (data: CreatePrlInput) =>
    api.post<PurchaseRequisition>('/procurement/prl', data).then((r) => r.data),

  update: (id: string, data: Partial<CreatePrlInput>) =>
    api.put<PurchaseRequisition>(`/procurement/prl/${id}`, data).then((r) => r.data),

  shortClose: (id: string, lineIds: string[]) =>
    api.post(`/procurement/prl/${id}/short-close`, { lineIds }).then((r) => r.data),

  createEnquiry: (id: string, supplierIds: string[]) =>
    api.post(`/procurement/prl/${id}/create-enquiry`, { supplierIds }).then((r) => r.data),
};

// ── PRL Hooks ─────────────────────────────────────────────────────────────────
export const usePrlList = (params: DocListParams) =>
  useQuery({
    queryKey: PRL_KEYS.list(params),
    queryFn: () => prlApi.list(params),
  });

export const usePrl = (id: string | undefined) =>
  useQuery({
    queryKey: PRL_KEYS.detail(id ?? ''),
    queryFn: () => prlApi.getById(id!),
    enabled: !!id,
  });

export const useCreatePrl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: prlApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: PRL_KEYS.all }),
  });
};

export const useUpdatePrl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreatePrlInput>) => prlApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRL_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PRL_KEYS.all });
    },
  });
};

// ── PO API ────────────────────────────────────────────────────────────────────
export const poApi = {
  list: (params: DocListParams) =>
    api.get<PaginatedResponse<PurchaseOrder>>('/procurement/po', { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<PurchaseOrder>(`/procurement/po/${id}`).then((r) => r.data),

  create: (data: CreatePoInput) =>
    api.post<PurchaseOrder>('/procurement/po', data).then((r) => r.data),

  update: (id: string, data: Partial<CreatePoInput>) =>
    api.put<PurchaseOrder>(`/procurement/po/${id}`, data).then((r) => r.data),

  submit: (id: string) =>
    api.post<PurchaseOrder>(`/procurement/po/${id}/submit`).then((r) => r.data),

  approve: (id: string, input: WorkflowActionInput) =>
    api.post(`/procurement/po/${id}/approve`, input).then((r) => r.data),

  reject: (id: string, input: WorkflowActionInput) =>
    api.post(`/procurement/po/${id}/reject`, input).then((r) => r.data),

  cancel: (id: string, reason: string) =>
    api.post(`/procurement/po/${id}/cancel`, { reason }).then((r) => r.data),

  shortClose: (id: string, lineIds: string[]) =>
    api.post(`/procurement/po/${id}/short-close`, { lineIds }).then((r) => r.data),
};

// ── PO Hooks ──────────────────────────────────────────────────────────────────
export const usePoList = (params: DocListParams) =>
  useQuery({
    queryKey: PO_KEYS.list(params),
    queryFn: () => poApi.list(params),
  });

export const usePo = (id: string | undefined) =>
  useQuery({
    queryKey: PO_KEYS.detail(id ?? ''),
    queryFn: () => poApi.getById(id!),
    enabled: !!id,
  });

export const useCreatePo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: poApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: PO_KEYS.all }),
  });
};

export const useUpdatePo = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreatePoInput>) => poApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PO_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PO_KEYS.all });
    },
  });
};

export const useSubmitPo = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => poApi.submit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PO_KEYS.detail(id) }),
  });
};

export const useApprovePo = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkflowActionInput) => poApi.approve(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PO_KEYS.detail(id) }),
  });
};

export const useRejectPo = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkflowActionInput) => poApi.reject(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PO_KEYS.detail(id) }),
  });
};

export const useCancelPo = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => poApi.cancel(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: PO_KEYS.detail(id) }),
  });
};

// ── Inventory Stock Summary (used by MRL/PRL tiles) ───────────────────────────
export const useStockSummary = (locationId: string | undefined) =>
  useQuery({
    queryKey: ['inventory', 'stock-summary', locationId],
    queryFn: () =>
      api.get<StockSummaryResponse>('/inventory/stock-summary', { params: { locationId } }).then((r) => r.data),
    enabled: !!locationId,
  });

// ── Lookup helpers (for LookupField onSearch) ─────────────────────────────────
export const searchSuppliers = async (q: string) => {
  const res = await supplierApi.search(q);
  return res.map((s) => ({ value: s.id, label: s.name, subLabel: s.code }));
};

export const searchLocations = async (q: string) => {
  const res = await api.get<{ id: string; code: string; name: string }[]>('/core/locations/search', {
    params: { q },
  });
  return res.data.map((l) => ({ value: l.id, label: l.name, subLabel: l.code }));
};

export const searchGlAccounts = async (q: string) => {
  const res = await api.get<{ id: string; code: string; name: string }[]>('/finance/gl-accounts/search', {
    params: { q },
  });
  return res.data.map((a) => ({ value: a.id, label: a.name, subLabel: a.code }));
};

export const searchItems = async (q: string) => {
  const res = await api.get<{ id: string; code: string; description: string }[]>('/inventory/items/search', {
    params: { q },
  });
  return res.data.map((i) => ({ value: i.id, label: i.description, subLabel: i.code }));
};

export const searchChargeCodes = async (q: string) => {
  const res = await api.get<{ id: string; code: string; name: string }[]>('/finance/charge-codes/search', {
    params: { q },
  });
  return res.data.map((c) => ({ value: c.id, label: `${c.code} – ${c.name}`, subLabel: c.code }));
};
