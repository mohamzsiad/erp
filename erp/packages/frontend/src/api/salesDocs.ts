import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

// ═══════════════════════════════════════════════════════════════════════════════
// Sales Enquiries
// ═══════════════════════════════════════════════════════════════════════════════
export const ENQUIRY_KEYS = {
  all: ['salesEnquiries'] as const,
  list: (p: object) => ['salesEnquiries', 'list', p] as const,
  detail: (id: string) => ['salesEnquiries', id] as const,
};

export interface EnquiryLineInput {
  itemId: string;
  description?: string | null;
  uomId: string;
  qty: number;
  targetPrice?: number | null;
}
export interface UpsertEnquiryInput {
  customerId?: string | null;
  prospectName?: string | null;
  enquiryDate: string;
  requiredByDate?: string | null;
  salespersonId?: string | null;
  source?: string | null;
  notes?: string | null;
  lines?: EnquiryLineInput[];
}
export interface EnquiryRow {
  id: string; docNo: string; customerId: string | null; customerName: string | null;
  enquiryDate: string; requiredByDate: string | null; status: string; source: string | null; lineCount: number;
}

export const enquiryApi = {
  list: (params: { search?: string; status?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: EnquiryRow[]; total: number }>('/sales/enquiries', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/enquiries/${id}`).then((r) => r.data),
  create: (data: UpsertEnquiryInput) => api.post<any>('/sales/enquiries', data).then((r) => r.data),
  update: (id: string, data: UpsertEnquiryInput) => api.put<any>(`/sales/enquiries/${id}`, data).then((r) => r.data),
  setStatus: (id: string, status: string, lostReason?: string) =>
    api.post(`/sales/enquiries/${id}/status`, { status, lostReason }).then((r) => r.data),
  convert: (id: string) => api.post<any>(`/sales/enquiries/${id}/convert`).then((r) => r.data),
};

export const useEnquiries = (params: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: ENQUIRY_KEYS.list(params), queryFn: () => enquiryApi.list(params) });
export const useEnquiry = (id: string | undefined) =>
  useQuery({ queryKey: ENQUIRY_KEYS.detail(id ?? ''), queryFn: () => enquiryApi.getById(id!), enabled: !!id });
export const useCreateEnquiry = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: enquiryApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ENQUIRY_KEYS.all }) });
};
export const useUpdateEnquiry = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: UpsertEnquiryInput) => enquiryApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ENQUIRY_KEYS.detail(id) }); qc.invalidateQueries({ queryKey: ENQUIRY_KEYS.all }); } });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sales Quotations
// ═══════════════════════════════════════════════════════════════════════════════
export const QUOTATION_KEYS = {
  all: ['salesQuotations'] as const,
  list: (p: object) => ['salesQuotations', 'list', p] as const,
  detail: (id: string) => ['salesQuotations', id] as const,
};

export interface QuotationLineInput {
  itemId: string;
  description?: string | null;
  uomId: string;
  qty: number;
  unitPrice?: number | null;
  discountPct?: number;
  taxCodeId?: string | null;
}
export interface UpsertQuotationInput {
  customerId: string;
  enquiryId?: string | null;
  quotationDate: string;
  validTo?: string | null;
  paymentTerms?: string | null;
  salespersonId?: string | null;
  notes?: string | null;
  lines: QuotationLineInput[];
}
export interface QuotationRow {
  id: string; docNo: string; rev: number; customerId: string; customerName?: string;
  quotationDate: string; validTo: string | null; status: string; totalAmount: number;
}
export interface QuotationResult {
  id: string; warnings?: string[];
  [k: string]: unknown;
}

export const quotationApi = {
  list: (params: { search?: string; status?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: QuotationRow[]; total: number }>('/sales/quotations', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/quotations/${id}`).then((r) => r.data),
  create: (data: UpsertQuotationInput) => api.post<QuotationResult>('/sales/quotations', data).then((r) => r.data),
  update: (id: string, data: UpsertQuotationInput) => api.put<QuotationResult>(`/sales/quotations/${id}`, data).then((r) => r.data),
  setStatus: (id: string, status: string) => api.post(`/sales/quotations/${id}/status`, { status }).then((r) => r.data),
  send: (id: string) => api.post(`/sales/quotations/${id}/send`).then((r) => r.data),
  revise: (id: string) => api.post<any>(`/sales/quotations/${id}/revise`).then((r) => r.data),
  convertToOrder: (id: string) => api.post<{ orderId: string; docNo: string }>(`/sales/quotations/${id}/convert-to-order`).then((r) => r.data),
};

export const useQuotations = (params: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: QUOTATION_KEYS.list(params), queryFn: () => quotationApi.list(params) });
export const useQuotation = (id: string | undefined) =>
  useQuery({ queryKey: QUOTATION_KEYS.detail(id ?? ''), queryFn: () => quotationApi.getById(id!), enabled: !!id });
export const useCreateQuotation = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: quotationApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: QUOTATION_KEYS.all }) });
};
export const useUpdateQuotation = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: UpsertQuotationInput) => quotationApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: QUOTATION_KEYS.detail(id) }); qc.invalidateQueries({ queryKey: QUOTATION_KEYS.all }); } });
};
