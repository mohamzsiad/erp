import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export const CONTRACT_KEYS = {
  all: ['salesContracts'] as const,
  list: (p: object) => ['salesContracts', 'list', p] as const,
  detail: (id: string) => ['salesContracts', id] as const,
};

export interface BoqLineInput {
  section?: string | null;
  subSection?: string | null;
  itemDescription: string;
  uomId?: string | null;
  contractQty: number;
  rate: number;
}
export interface UpsertContractInput {
  customerId: string;
  projectRef?: string | null;
  projectName: string;
  contractValue?: number;
  startDate?: string | null;
  endDate?: string | null;
  paymentTerms?: string | null;
  costCenterId?: string | null;
  boqLines?: BoqLineInput[];
}
export interface ContractRow {
  id: string; docNo: string; customerId: string; customerName?: string; projectName: string; projectRef: string | null;
  contractValue: number; startDate: string | null; endDate: string | null; status: string; boqCount: number;
}
export interface VariationInput {
  reason?: string;
  adjustments?: Array<{ boqLineId: string; deltaQty: number }>;
  newLines?: BoqLineInput[];
}

export const contractApi = {
  list: (params: { search?: string; status?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: ContractRow[]; total: number }>('/sales/contracts', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/contracts/${id}`).then((r) => r.data),
  create: (data: UpsertContractInput) => api.post<any>('/sales/contracts', data).then((r) => r.data),
  update: (id: string, data: UpsertContractInput) => api.put<any>(`/sales/contracts/${id}`, data).then((r) => r.data),
  setBoq: (id: string, lines: BoqLineInput[]) => api.post<any>(`/sales/contracts/${id}/boq`, { lines }).then((r) => r.data),
  applyVariation: (id: string, v: VariationInput) => api.post<any>(`/sales/contracts/${id}/variations`, v).then((r) => r.data),
  setStatus: (id: string, status: string) => api.post<any>(`/sales/contracts/${id}/status`, { status }).then((r) => r.data),
};

export const useContracts = (params: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: CONTRACT_KEYS.list(params), queryFn: () => contractApi.list(params) });
export const useContract = (id: string | undefined) =>
  useQuery({ queryKey: CONTRACT_KEYS.detail(id ?? ''), queryFn: () => contractApi.getById(id!), enabled: !!id });
export const useCreateContract = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: contractApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: CONTRACT_KEYS.all }) });
};
export const useUpdateContract = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: UpsertContractInput) => contractApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: CONTRACT_KEYS.detail(id) }); qc.invalidateQueries({ queryKey: CONTRACT_KEYS.all }); } });
};
