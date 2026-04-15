import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export interface KpiData {
  kpis: {
    totalPoMtd: { count: number; value: number; trendPct: number };
    pendingApproval: { count: number };
    stockValue: { value: number };
    overdueSupplierInvoices: { count: number; total: number };
    budgetUtilization: { budgeted: number; actual: number; pct: number };
    avgPoLeadTimeDays: { days: number };
  };
  workSummary: {
    pendingMrl: number;
    pendingPrl: number;
    openPos: number;
    pendingApInvoice: number;
    unpostedJournals: number;
    pendingGrn: number;
  };
  charts: {
    topSuppliers: { name: string; value: number }[];
    monthlyPurchase: { month: string; value: number }[];
  };
}

export interface WorkflowTask {
  id: string;
  docType: 'MRL' | 'PRL' | 'PO' | 'AP_INVOICE' | 'GRN';
  docNo: string;
  description: string;
  requestedBy: string;
  daysPending: number;
  priority: 'high' | 'medium' | 'low';
  status: string;
  path: string;
}

export function useDashboardKpis() {
  return useQuery<KpiData>({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/kpis');
      return data;
    },
    refetchInterval: 5 * 60_000, // refresh every 5 minutes
    staleTime: 2 * 60_000,
  });
}

export function useWorkflowTasks() {
  return useQuery<{ tasks: WorkflowTask[] }>({
    queryKey: ['dashboard', 'workflow-tasks'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/workflow-tasks');
      return data;
    },
    refetchInterval: 60_000,
  });
}
