import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const GL_KEYS = {
  all:    ['gl-accounts'] as const,
  list:   (p: object) => ['gl-accounts', 'list', p] as const,
  tree:   () => ['gl-accounts', 'tree'] as const,
  search: (q: string) => ['gl-accounts', 'search', q] as const,
  detail: (id: string) => ['gl-accounts', id] as const,
};
export const JOURNAL_KEYS = {
  all:    ['journals'] as const,
  list:   (p: object) => ['journals', 'list', p] as const,
  detail: (id: string) => ['journals', id] as const,
};
export const AP_KEYS = {
  invoices: {
    list:   (p: object) => ['ap-invoices', 'list', p] as const,
    detail: (id: string) => ['ap-invoices', id] as const,
  },
  payments: {
    list:   (p: object) => ['ap-payments', 'list', p] as const,
  },
};
export const AR_KEYS = {
  invoices: { list: (p: object) => ['ar-invoices', 'list', p] as const },
  receipts: { list: (p: object) => ['ar-receipts', 'list', p] as const },
  customers: { list: (p: object) => ['customers', 'list', p] as const },
};
export const BUDGET_KEYS = {
  list:      (p: object) => ['budgets', 'list', p] as const,
  vsActual:  (p: object) => ['budgets', 'vs-actual', p] as const,
};
export const REPORT_KEYS = {
  trialBalance: (p: object) => ['reports', 'trial-balance', p] as const,
  pnl:          (p: object) => ['reports', 'pnl', p] as const,
  balanceSheet: (p: object) => ['reports', 'balance-sheet', p] as const,
  apAging:      (p: object) => ['reports', 'ap-aging', p] as const,
  arAging:      (p: object) => ['reports', 'ar-aging', p] as const,
};
export const COST_CENTER_KEYS = {
  search: (q: string) => ['cost-centers', 'search', q] as const,
};
export const PERIOD_KEYS = { all: () => ['periods'] as const };
export const MAPPING_KEYS = { all: () => ['account-mappings'] as const };

// ── GL Accounts ───────────────────────────────────────────────────────────────
export function useGlTree() {
  return useQuery({
    queryKey: GL_KEYS.tree(),
    queryFn: () => api.get('/finance/accounts/tree').then((r) => r.data),
  });
}
export function useGlSearch(q: string) {
  return useQuery({
    queryKey: GL_KEYS.search(q),
    queryFn: () => api.get('/finance/accounts/search', { params: { q, leafOnly: true } }).then((r) => r.data),
    enabled: q.length >= 1,
  });
}
export async function searchGlAccounts(q: string) {
  const r = await api.get('/finance/accounts/search', { params: { q, leafOnly: true } });
  return (r.data as any[]).map((a: any) => ({
    value: a.id,
    label: `${a.code} – ${a.name}`,
    subLabel: a.accountType,
    meta: a,
  }));
}
export function useCreateGlAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/finance/accounts', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: GL_KEYS.all }),
  });
}
export function useUpdateGlAccount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(`/finance/accounts/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: GL_KEYS.all }),
  });
}
export function useDeleteGlAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/finance/accounts/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: GL_KEYS.all }),
  });
}

// ── Cost Centers (search) ─────────────────────────────────────────────────────
export async function searchCostCenters(q: string) {
  const r = await api.get('/finance/cost-centers/search', { params: { q } });
  return (r.data as any[]).map((c: any) => ({
    value: c.id,
    label: `${c.code} – ${c.name}`,
    meta: c,
  }));
}

// ── Journal Entries ───────────────────────────────────────────────────────────
export function useJournalList(params: any) {
  return useQuery({
    queryKey: JOURNAL_KEYS.list(params),
    queryFn: () => api.get('/finance/journals', { params }).then((r) => r.data),
  });
}
export function useJournalDetail(id: string) {
  return useQuery({
    queryKey: JOURNAL_KEYS.detail(id),
    queryFn: () => api.get(`/finance/journals/${id}`).then((r) => r.data),
    enabled: !!id && id !== 'new',
  });
}
export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/finance/journals', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOURNAL_KEYS.all }),
  });
}
export function useReverseJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.post(`/finance/journals/${id}/reverse`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOURNAL_KEYS.all }),
  });
}

// ── AP Invoices ───────────────────────────────────────────────────────────────
export function useApInvoiceList(params: any) {
  return useQuery({
    queryKey: AP_KEYS.invoices.list(params),
    queryFn: () => api.get('/finance/ap/invoices', { params }).then((r) => r.data),
  });
}
export function useApInvoiceDetail(id: string) {
  return useQuery({
    queryKey: AP_KEYS.invoices.detail(id),
    queryFn: () => api.get(`/finance/ap/invoices/${id}`).then((r) => r.data),
    enabled: !!id && id !== 'new',
  });
}
export function useCreateApInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/finance/ap/invoices', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-invoices'] }),
  });
}
export function useApproveApInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/finance/ap/invoices/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-invoices'] }),
  });
}
export function useCancelApInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/finance/ap/invoices/${id}/cancel`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-invoices'] }),
  });
}

// ── AP Payments ───────────────────────────────────────────────────────────────
export function useApPaymentList(params: any) {
  return useQuery({
    queryKey: AP_KEYS.payments.list(params),
    queryFn: () => api.get('/finance/ap/payments', { params }).then((r) => r.data),
  });
}
export function useCreateApPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/finance/ap/payments', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] });
      qc.invalidateQueries({ queryKey: ['ap-invoices'] });
    },
  });
}

// ── AR ────────────────────────────────────────────────────────────────────────
export function useArInvoiceList(params: any) {
  return useQuery({
    queryKey: AR_KEYS.invoices.list(params),
    queryFn: () => api.get('/finance/ar/invoices', { params }).then((r) => r.data),
  });
}
export function useArReceiptList(params: any) {
  return useQuery({
    queryKey: AR_KEYS.receipts.list(params),
    queryFn: () => api.get('/finance/ar/receipts', { params }).then((r) => r.data),
  });
}
export async function searchCustomers(q: string) {
  const r = await api.get('/finance/ar/customers/search', { params: { q } });
  return (r.data as any[]).map((c: any) => ({
    value: c.id,
    label: `${c.code} – ${c.name}`,
    meta: c,
  }));
}

// ── Budgets ───────────────────────────────────────────────────────────────────
export function useBudgetList(params: any) {
  return useQuery({
    queryKey: BUDGET_KEYS.list(params),
    queryFn: () => api.get('/finance/budgets', { params }).then((r) => r.data),
  });
}
export function useBudgetVsActual(params: any, enabled = true) {
  return useQuery({
    queryKey: BUDGET_KEYS.vsActual(params),
    queryFn: () => api.get('/finance/budgets/vs-actual', { params }).then((r) => r.data),
    enabled,
  });
}

// ── Periods ───────────────────────────────────────────────────────────────────
export function usePeriods() {
  return useQuery({
    queryKey: PERIOD_KEYS.all(),
    queryFn: () => api.get('/finance/periods').then((r) => r.data),
  });
}

// ── Account Mappings ──────────────────────────────────────────────────────────
export function useAccountMappings() {
  return useQuery({
    queryKey: MAPPING_KEYS.all(),
    queryFn: () => api.get('/finance/account-mappings').then((r) => r.data),
  });
}

// ── Reports ───────────────────────────────────────────────────────────────────
export function useTrialBalance(params: any, enabled = true) {
  return useQuery({
    queryKey: REPORT_KEYS.trialBalance(params),
    queryFn: () => api.get('/finance/reports/trial-balance', { params }).then((r) => r.data),
    enabled,
  });
}
export function usePnl(params: any, enabled = true) {
  return useQuery({
    queryKey: REPORT_KEYS.pnl(params),
    queryFn: () => api.get('/finance/reports/pnl', { params }).then((r) => r.data),
    enabled,
  });
}
export function useBalanceSheet(params: any, enabled = true) {
  return useQuery({
    queryKey: REPORT_KEYS.balanceSheet(params),
    queryFn: () => api.get('/finance/reports/balance-sheet', { params }).then((r) => r.data),
    enabled,
  });
}
export function useApAging(params: any, enabled = true) {
  return useQuery({
    queryKey: REPORT_KEYS.apAging(params),
    queryFn: () => api.get('/finance/reports/ap-aging', { params }).then((r) => r.data),
    enabled,
  });
}
export function useArAging(params: any, enabled = true) {
  return useQuery({
    queryKey: REPORT_KEYS.arAging(params),
    queryFn: () => api.get('/finance/reports/ar-aging', { params }).then((r) => r.data),
    enabled,
  });
}
