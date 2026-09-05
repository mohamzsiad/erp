import { useQuery } from '@tanstack/react-query';
import api from './client';

export interface SalesKpis {
  orderBookValue: number; monthlySales: number; pipelineValue: number; deliveriesDue: number;
  overdueReceivables: number; openOrders: number;
  topCustomers: Array<{ customerId: string; name: string; total: number }>;
  salesTrend: Array<{ month: string; total: number }>;
}

export const salesReportApi = {
  kpis: () => api.get<SalesKpis>('/sales/dashboard/kpis').then((r) => r.data),
  pipeline: () => api.get<any>('/sales/reports/pipeline').then((r) => r.data),
  orderBook: () => api.get<any>('/sales/reports/order-book').then((r) => r.data),
  salesRegister: (params: { dateFrom?: string; dateTo?: string } = {}) => api.get<any>('/sales/reports/sales-register', { params }).then((r) => r.data),
  vat: (params: { dateFrom?: string; dateTo?: string } = {}) => api.get<any>('/sales/reports/vat', { params }).then((r) => r.data),
  customerAgeing: () => api.get<any>('/sales/reports/customer-ageing').then((r) => r.data),
  boqProgress: () => api.get<any>('/sales/reports/boq-progress').then((r) => r.data),
};

export const useSalesKpis = () => useQuery({ queryKey: ['salesKpis'], queryFn: () => salesReportApi.kpis() });
export const useSalesReport = (key: string, fn: () => Promise<any>, enabled = true) =>
  useQuery({ queryKey: ['salesReport', key], queryFn: fn, enabled });
