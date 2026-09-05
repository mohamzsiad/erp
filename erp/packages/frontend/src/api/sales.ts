import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type {
  CustomerDetail,
  CustomerContact,
  CustomerAddress,
  CustomerCompanyTerms,
  CustomerEffectiveTerms,
  CustomerFinancialSummary,
  CustomerCategory,
  PriceList,
  TaxCode,
  UpsertCustomerInput,
  PaginatedResponse,
} from '@clouderp/shared';

// ── Query keys ─────────────────────────────────────────────────────────────────
export const CUSTOMER_KEYS = {
  all: ['customers'] as const,
  list: (params: object) => ['customers', 'list', params] as const,
  detail: (id: string) => ['customers', id] as const,
  financial: (id: string) => ['customers', id, 'financial'] as const,
};

// ── Types ──────────────────────────────────────────────────────────────────────
export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  creditHold?: boolean;
}

export interface CustomerListRow {
  id: string;
  code: string;
  name: string;
  tradeName: string | null;
  type: string;
  salesmanId: string | null;
  salesmanName: string | null;
  paymentTerms: string | null;
  creditLimit: number;
  creditHold: boolean;
  isBlackListed: boolean;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
}

export interface CreateCustomerResult extends CustomerDetail {
  pendingCreditApproval?: boolean;
  warnings?: Array<{ id: string; code: string; name: string; trn: string | null }>;
}

// ── API ────────────────────────────────────────────────────────────────────────
export const customerApi = {
  list: (params: CustomerListParams) =>
    api.get<PaginatedResponse<CustomerListRow>>('/sales/customers', { params }).then((r) => r.data),

  search: (q: string) =>
    api.get<Array<{ id: string; code: string; name: string }>>('/sales/customers/search', { params: { q } }).then((r) => r.data),

  getById: (id: string) =>
    api.get<CustomerDetail & { addresses: CustomerAddress[]; companyTerms: CustomerCompanyTerms[] }>(`/sales/customers/${id}`).then((r) => r.data),

  financialSummary: (id: string) =>
    api.get<CustomerFinancialSummary>(`/sales/customers/${id}/financial-summary`).then((r) => r.data),

  create: (data: UpsertCustomerInput) =>
    api.post<CreateCustomerResult>('/sales/customers', data).then((r) => r.data),

  update: (id: string, data: UpsertCustomerInput) =>
    api.put<CustomerDetail>(`/sales/customers/${id}`, data).then((r) => r.data),

  toggleActive: (id: string) =>
    api.post<{ isActive: boolean }>(`/sales/customers/${id}/toggle-active`).then((r) => r.data),

  setCreditHold: (id: string, hold: boolean) =>
    api.post<{ creditHold: boolean }>(`/sales/customers/${id}/credit-hold`, { hold }).then((r) => r.data),

  approve: (id: string) =>
    api.post<{ isActive: boolean }>(`/sales/customers/${id}/approve`).then((r) => r.data),

  groupCompanies: () =>
    api.get<Array<{ id: string; code: string; name: string; baseCurrency: string }>>('/sales/customers/companies').then((r) => r.data),

  effectiveTerms: (id: string) =>
    api.get<CustomerEffectiveTerms>(`/sales/customers/${id}/effective-terms`).then((r) => r.data),
};

// ── Hooks ──────────────────────────────────────────────────────────────────────
export const useCustomerList = (params: CustomerListParams) =>
  useQuery({ queryKey: CUSTOMER_KEYS.list(params), queryFn: () => customerApi.list(params) });

export const useCustomer = (id: string | undefined) =>
  useQuery({
    queryKey: CUSTOMER_KEYS.detail(id ?? ''),
    queryFn: () => customerApi.getById(id!),
    enabled: !!id,
  });

export const useCustomerFinancialSummary = (id: string | undefined) =>
  useQuery({
    queryKey: CUSTOMER_KEYS.financial(id ?? ''),
    queryFn: () => customerApi.financialSummary(id!),
    enabled: !!id,
  });

export const useCreateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customerApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.all }),
  });
};

export const useUpdateCustomer = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertCustomerInput) => customerApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.all });
    },
  });
};

export const useToggleCustomerActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customerApi.toggleActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.all }),
  });
};

export const useSetCreditHold = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hold }: { id: string; hold: boolean }) => customerApi.setCreditHold(id, hold),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.detail(v.id) });
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.all });
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Price Lists
// ═══════════════════════════════════════════════════════════════════════════════
export const PRICE_LIST_KEYS = {
  all: ['priceLists'] as const,
  list: (params: object) => ['priceLists', 'list', params] as const,
  detail: (id: string) => ['priceLists', id] as const,
};

export interface PriceListItemInput {
  itemId: string;
  uomId: string;
  unitPrice: number;
  minPrice?: number;
  /** Both dates are mandatory — the API rejects a line without a window. */
  validFrom: string;
  validTo: string;
}

export type PriceListKind = 'STANDARD' | 'CUSTOMER_SPECIFIC';

export interface UpsertPriceListInput {
  code?: string;
  name: string;
  type?: PriceListKind;
  ownerCustomerId?: string | null;
  currencyId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  items?: PriceListItemInput[];
}

export interface PriceListRow {
  id: string;
  code: string;
  name: string;
  type: PriceListKind;
  ownerCustomerId: string | null;
  ownerCustomerCode: string | null;
  ownerCustomerName: string | null;
  currencyId: string | null;
  currencyCode: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  isDefault: boolean;
  itemCount: number;
  assignedCount: number;
}

export interface PriceListItemRow {
  id: string;
  priceListId: string;
  itemId: string;
  uomId: string;
  unitPrice: number;
  minPrice: number;
  validFrom: string;
  validTo: string;
  itemCode?: string;
  itemDescription?: string;
  uomCode?: string;
}

export interface PriceListDetail {
  id: string;
  code: string;
  name: string;
  type: PriceListKind;
  ownerCustomerId: string | null;
  ownerCustomerCode: string | null;
  ownerCustomerName: string | null;
  currencyId: string | null;
  currencyCode: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  isDefault: boolean;
  items: PriceListItemRow[];
}

export interface PriceResolutionResult {
  unitPrice: number | null;
  minPrice: number | null;
  source: 'CUSTOMER' | 'CUSTOMER_CATEGORY' | 'DEFAULT' | 'MANUAL';
  priceListId?: string | null;
}

/** Running weighted average cost of an item, shown while pricing a line. */
export interface ItemWac {
  itemId: string;
  wac: number;
  qtyOnHand: number;
  source: 'WAC' | 'STANDARD_COST';
}

export const priceListApi = {
  list: (params: { search?: string; isActive?: boolean; type?: PriceListKind } = {}) =>
    api.get<PriceListRow[]>('/sales/price-lists', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get<PriceListDetail>(`/sales/price-lists/${id}`).then((r) => r.data),
  create: (data: UpsertPriceListInput) =>
    api.post<PriceListDetail>('/sales/price-lists', data).then((r) => r.data),
  update: (id: string, data: UpsertPriceListInput) =>
    api.put<PriceListDetail>(`/sales/price-lists/${id}`, data).then((r) => r.data),
  setDefault: (id: string) =>
    api.post(`/sales/price-lists/${id}/set-default`).then((r) => r.data),
  toggleActive: (id: string) =>
    api.post(`/sales/price-lists/${id}/toggle-active`).then((r) => r.data),
  assign: (id: string, targetType: 'CUSTOMER' | 'CATEGORY', targetId: string) =>
    api.post(`/sales/price-lists/${id}/assign`, { targetType, targetId }).then((r) => r.data),
  lookup: (params: { itemId: string; uomId: string; customerId?: string; date?: string }) =>
    api.get<PriceResolutionResult>('/sales/price-lookup', { params }).then((r) => r.data),
  itemWac: (itemId: string) =>
    api.get<ItemWac>('/sales/price-lists/item-wac', { params: { itemId } }).then((r) => r.data),
};

export const usePriceLists = (params: { search?: string; isActive?: boolean; type?: PriceListKind } = {}) =>
  useQuery({ queryKey: PRICE_LIST_KEYS.list(params), queryFn: () => priceListApi.list(params) });

export const usePriceList = (id: string | undefined) =>
  useQuery({ queryKey: PRICE_LIST_KEYS.detail(id ?? ''), queryFn: () => priceListApi.getById(id!), enabled: !!id });

export const useCreatePriceList = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: priceListApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: PRICE_LIST_KEYS.all }) });
};

export const useUpdatePriceList = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertPriceListInput) => priceListApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRICE_LIST_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PRICE_LIST_KEYS.all });
    },
  });
};

export const useSetDefaultPriceList = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => priceListApi.setDefault(id), onSuccess: () => qc.invalidateQueries({ queryKey: PRICE_LIST_KEYS.all }) });
};

// Re-export shared types used by pages
export const useGroupCompaniesLookup = () =>
  useQuery({ queryKey: ['customers', 'groupCompanies'], queryFn: customerApi.groupCompanies });

// Re-export shared types used by pages
export type {
  CustomerDetail, CustomerContact, CustomerAddress, CustomerCompanyTerms, CustomerEffectiveTerms,
  CustomerFinancialSummary, CustomerCategory, PriceList, TaxCode,
};
