import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type {
  Salesman,
  UpsertSalesmanInput,
  PaymentTerm,
  UpsertPaymentTermInput,
  Country,
  City,
} from '@clouderp/shared';

// ═══════════════════════════════════════════════════════════════════════════════
// Salesman master
// ═══════════════════════════════════════════════════════════════════════════════
export const SALESMAN_KEYS = {
  all: ['salesmen'] as const,
  list: (params: object) => ['salesmen', 'list', params] as const,
  detail: (id: string) => ['salesmen', id] as const,
};

export const salesmanApi = {
  list: (params: { search?: string; isActive?: boolean } = {}) =>
    api.get<Salesman[]>('/sales/salesmen', { params }).then((r) => r.data),
  search: (q: string) =>
    api.get<Array<{ id: string; code: string; name: string }>>('/sales/salesmen/search', { params: { q } }).then((r) => r.data),
  getById: (id: string) => api.get<Salesman>(`/sales/salesmen/${id}`).then((r) => r.data),
  create: (data: UpsertSalesmanInput) => api.post<Salesman>('/sales/salesmen', data).then((r) => r.data),
  update: (id: string, data: UpsertSalesmanInput) => api.put<Salesman>(`/sales/salesmen/${id}`, data).then((r) => r.data),
  toggleActive: (id: string) => api.post<Salesman>(`/sales/salesmen/${id}/toggle-active`).then((r) => r.data),
  remove: (id: string) => api.delete(`/sales/salesmen/${id}`).then((r) => r.data),
};

export const useSalesmen = (params: { search?: string; isActive?: boolean } = {}) =>
  useQuery({ queryKey: SALESMAN_KEYS.list(params), queryFn: () => salesmanApi.list(params) });

export const useSalesman = (id: string | undefined) =>
  useQuery({ queryKey: SALESMAN_KEYS.detail(id ?? ''), queryFn: () => salesmanApi.getById(id!), enabled: !!id });

export const useCreateSalesman = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesmanApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: SALESMAN_KEYS.all }) });
};

export const useUpdateSalesman = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertSalesmanInput) => salesmanApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SALESMAN_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: SALESMAN_KEYS.all });
    },
  });
};

export const useToggleSalesmanActive = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesmanApi.toggleActive, onSuccess: () => qc.invalidateQueries({ queryKey: SALESMAN_KEYS.all }) });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Payment terms master
// ═══════════════════════════════════════════════════════════════════════════════
export const PAYMENT_TERM_KEYS = {
  all: ['paymentTerms'] as const,
  list: (params: object) => ['paymentTerms', 'list', params] as const,
  detail: (id: string) => ['paymentTerms', id] as const,
};

export const paymentTermApi = {
  list: (params: { search?: string; isActive?: boolean } = {}) =>
    api.get<PaymentTerm[]>('/sales/payment-terms', { params }).then((r) => r.data),
  getById: (id: string) => api.get<PaymentTerm>(`/sales/payment-terms/${id}`).then((r) => r.data),
  create: (data: UpsertPaymentTermInput) => api.post<PaymentTerm>('/sales/payment-terms', data).then((r) => r.data),
  update: (id: string, data: UpsertPaymentTermInput) => api.put<PaymentTerm>(`/sales/payment-terms/${id}`, data).then((r) => r.data),
  toggleActive: (id: string) => api.post<PaymentTerm>(`/sales/payment-terms/${id}/toggle-active`).then((r) => r.data),
  remove: (id: string) => api.delete(`/sales/payment-terms/${id}`).then((r) => r.data),
};

export const usePaymentTerms = (params: { search?: string; isActive?: boolean } = {}) =>
  useQuery({ queryKey: PAYMENT_TERM_KEYS.list(params), queryFn: () => paymentTermApi.list(params) });

export const usePaymentTerm = (id: string | undefined) =>
  useQuery({ queryKey: PAYMENT_TERM_KEYS.detail(id ?? ''), queryFn: () => paymentTermApi.getById(id!), enabled: !!id });

export const useCreatePaymentTerm = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: paymentTermApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENT_TERM_KEYS.all }) });
};

export const useUpdatePaymentTerm = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertPaymentTermInput) => paymentTermApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PAYMENT_TERM_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PAYMENT_TERM_KEYS.all });
    },
  });
};

export const useTogglePaymentTermActive = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: paymentTermApi.toggleActive, onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENT_TERM_KEYS.all }) });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Shared lookups used by the sales masters
// ═══════════════════════════════════════════════════════════════════════════════
export interface GroupCompany {
  id: string;
  code: string;
  name: string;
  baseCurrency: string;
}

export const lookupApi = {
  companies: () => api.get<GroupCompany[]>('/sales/customers/companies').then((r) => r.data),
  countries: () => api.get<Country[]>('/core/countries', { params: { isActive: true } }).then((r) => r.data),
  cities: (countryId: string) => api.get<City[]>(`/core/countries/${countryId}/cities`).then((r) => r.data),
  locations: (q = '') =>
    api.get<Array<{ id: string; code: string; name: string; type: string }>>('/core/locations/search', { params: { q } }).then((r) => r.data),
  currencies: (q = '') =>
    api.get<Array<{ id: string; code: string; name: string; symbol: string }>>('/core/currencies/search', { params: { q } }).then((r) => r.data),
};

export const useGroupCompanies = () =>
  useQuery({ queryKey: ['groupCompanies'], queryFn: lookupApi.companies });

export const useLocations = (q = '') =>
  useQuery({ queryKey: ['locations', q], queryFn: () => lookupApi.locations(q) });

export const useCurrencies = (q = '') =>
  useQuery({ queryKey: ['currencies', q], queryFn: () => lookupApi.currencies(q) });

export const useCountries = () =>
  useQuery({ queryKey: ['countries'], queryFn: lookupApi.countries });

/** Cities of the selected country — the address city dropdown. */
export const useCities = (countryId: string | undefined) =>
  useQuery({
    queryKey: ['cities', countryId ?? ''],
    queryFn: () => lookupApi.cities(countryId!),
    enabled: !!countryId,
  });

export type { Salesman, UpsertSalesmanInput, PaymentTerm, UpsertPaymentTermInput, Country, City };
