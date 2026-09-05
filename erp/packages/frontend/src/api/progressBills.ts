import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export const PROGRESSBILL_KEYS = {
  all: ['progressBills'] as const,
  list: (p: object) => ['progressBills', 'list', p] as const,
  detail: (id: string) => ['progressBills', id] as const,
  prepare: (cid: string) => ['progressBills', 'prepare', cid] as const,
};

export interface ProgressLineInput { boqLineId: string; cumQty: number; }
export interface UpsertProgressBillInput { contractId: string; period: string; billDate: string; lines: ProgressLineInput[]; }
export interface ProgressBillRow {
  id: string; docNo: string; contractId: string; projectName?: string; contractDocNo?: string; period: string;
  billDate: string; amount: number; taxAmount: number; totalAmount: number; status: string;
}
export interface PrepareLine {
  boqLineId: string; section: string | null; itemDescription: string; uomCode?: string;
  contractQty: number; rate: number; contractAmount: number; previousCumQty: number; previousValue: number;
}
export interface PrepareData { contractId: string; docNo: string; projectName: string; contractValue: number; lines: PrepareLine[]; }

export const progressBillApi = {
  list: (params: { search?: string; status?: string; contractId?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: ProgressBillRow[]; total: number }>('/sales/progress-bills', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/progress-bills/${id}`).then((r) => r.data),
  prepare: (contractId: string) => api.get<PrepareData>(`/sales/progress-bills/prepare/${contractId}`).then((r) => r.data),
  create: (data: UpsertProgressBillInput) => api.post<any>('/sales/progress-bills', data).then((r) => r.data),
  update: (id: string, data: { period?: string; billDate?: string; lines?: ProgressLineInput[] }) => api.put<any>(`/sales/progress-bills/${id}`, data).then((r) => r.data),
  submit: (id: string) => api.post<any>(`/sales/progress-bills/${id}/submit`).then((r) => r.data),
  certify: (id: string) => api.post<any>(`/sales/progress-bills/${id}/certify`).then((r) => r.data),
  post: (id: string) => api.post<any>(`/sales/progress-bills/${id}/post`).then((r) => r.data),
};

export const useProgressBills = (params: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: PROGRESSBILL_KEYS.list(params), queryFn: () => progressBillApi.list(params) });
export const useProgressBill = (id: string | undefined) =>
  useQuery({ queryKey: PROGRESSBILL_KEYS.detail(id ?? ''), queryFn: () => progressBillApi.getById(id!), enabled: !!id });
export const useCreateProgressBill = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: progressBillApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: PROGRESSBILL_KEYS.all }) });
};
