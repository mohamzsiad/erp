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

// ═══════════════════════════════════════════════════════════════════════════════
// Sales Orders
// ═══════════════════════════════════════════════════════════════════════════════
export const ORDER_KEYS = {
  all: ['salesOrders'] as const,
  list: (p: object) => ['salesOrders', 'list', p] as const,
  detail: (id: string) => ['salesOrders', id] as const,
  availability: (id: string) => ['salesOrders', id, 'availability'] as const,
};

export interface OrderLineInput {
  itemId: string;
  description?: string | null;
  uomId: string;
  orderedQty: number;
  unitPrice?: number | null;
  discountPct?: number;
  taxCodeId?: string | null;
}
export interface UpsertOrderInput {
  customerId: string;
  quotationId?: string | null;
  orderType?: 'STOCK' | 'SERVICE' | 'PROJECT' | 'DIRECT';
  orderDate: string;
  requestedDate?: string | null;
  paymentTerms?: string | null;
  warehouseId?: string | null;
  notes?: string | null;
  lines: OrderLineInput[];
}
export interface OrderRow {
  id: string; docNo: string; customerId: string; customerName?: string; orderType: string;
  orderDate: string; status: string; totalAmount: number; creditHoldReason: string | null;
}
export interface AvailabilityLine { lineId: string; itemId: string; orderedQty: number; onHand: number; reserved: number; availableToPromise: number; }
export interface OrderAvailability { orderId: string; warehouseId: string | null; lines: AvailabilityLine[]; }
export interface CreditCheck {
  decision: 'PASS' | 'HOLD' | 'BLOCK'; availableCredit: number; exceeded: boolean; hasOverdue: boolean; reason?: string;
}

export const orderApi = {
  list: (params: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: OrderRow[]; total: number }>('/sales/orders', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/orders/${id}`).then((r) => r.data),
  availability: (id: string) => api.get<OrderAvailability>(`/sales/orders/${id}/availability`).then((r) => r.data),
  create: (data: UpsertOrderInput) => api.post<any>('/sales/orders', data).then((r) => r.data),
  update: (id: string, data: UpsertOrderInput) => api.put<any>(`/sales/orders/${id}`, data).then((r) => r.data),
  confirm: (id: string) => api.post<any & { creditCheck?: CreditCheck; warnings?: string[] }>(`/sales/orders/${id}/confirm`).then((r) => r.data),
  approve: (id: string) => api.post<any>(`/sales/orders/${id}/approve`).then((r) => r.data),
  reject: (id: string, reason?: string) => api.post<any>(`/sales/orders/${id}/reject`, { reason }).then((r) => r.data),
  releaseHold: (id: string) => api.post<any>(`/sales/orders/${id}/release-hold`).then((r) => r.data),
  cancel: (id: string, reason?: string) => api.post<any>(`/sales/orders/${id}/cancel`, { reason }).then((r) => r.data),
  shortClose: (id: string) => api.post<any>(`/sales/orders/${id}/short-close`).then((r) => r.data),
};

export const useOrders = (params: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: ORDER_KEYS.list(params), queryFn: () => orderApi.list(params) });
export const useOrder = (id: string | undefined) =>
  useQuery({ queryKey: ORDER_KEYS.detail(id ?? ''), queryFn: () => orderApi.getById(id!), enabled: !!id });
export const useOrderAvailability = (id: string | undefined) =>
  useQuery({ queryKey: ORDER_KEYS.availability(id ?? ''), queryFn: () => orderApi.availability(id!), enabled: !!id });
export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: orderApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEYS.all }) });
};
export const useUpdateOrder = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: UpsertOrderInput) => orderApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ORDER_KEYS.detail(id) }); qc.invalidateQueries({ queryKey: ORDER_KEYS.all }); } });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Delivery Notes
// ═══════════════════════════════════════════════════════════════════════════════
export const DELIVERY_KEYS = {
  all: ['deliveries'] as const,
  list: (p: object) => ['deliveries', 'list', p] as const,
  detail: (id: string) => ['deliveries', id] as const,
};

export interface DeliveryLineInput {
  salesOrderLineId?: string | null;
  itemId: string;
  uomId: string;
  deliveredQty: number;
  binId?: string | null;
}
export interface UpsertDeliveryInput {
  customerId: string;
  salesOrderId?: string | null;
  deliveryDate: string;
  warehouseId: string;
  vehicleNo?: string | null;
  driver?: string | null;
  notes?: string | null;
  lines: DeliveryLineInput[];
}
export interface DeliveryRow {
  id: string; docNo: string; customerId: string; customerName?: string; salesOrderId: string | null;
  deliveryDate: string; status: string; lineCount: number;
}
export interface OpenOrderLine {
  salesOrderLineId: string; itemId: string; uomId: string; itemCode?: string; itemDescription?: string; uomCode?: string;
  orderedQty: number; deliveredQty: number; outstanding: number;
}
export interface OpenOrderLines {
  salesOrderId: string; docNo: string; customerId: string; warehouseId: string | null; lines: OpenOrderLine[];
}

export const deliveryApi = {
  list: (params: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: DeliveryRow[]; total: number }>('/sales/deliveries', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/deliveries/${id}`).then((r) => r.data),
  openLines: (orderId: string) => api.get<OpenOrderLines>(`/sales/deliveries/open-lines/${orderId}`).then((r) => r.data),
  create: (data: UpsertDeliveryInput) => api.post<any>('/sales/deliveries', data).then((r) => r.data),
  update: (id: string, data: UpsertDeliveryInput) => api.put<any>(`/sales/deliveries/${id}`, data).then((r) => r.data),
  post: (id: string) => api.post<any>(`/sales/deliveries/${id}/post`).then((r) => r.data),
  acknowledge: (id: string) => api.post<any>(`/sales/deliveries/${id}/acknowledge`).then((r) => r.data),
};

export const useDeliveries = (params: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: DELIVERY_KEYS.list(params), queryFn: () => deliveryApi.list(params) });
export const useDelivery = (id: string | undefined) =>
  useQuery({ queryKey: DELIVERY_KEYS.detail(id ?? ''), queryFn: () => deliveryApi.getById(id!), enabled: !!id });
export const useCreateDelivery = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: deliveryApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: DELIVERY_KEYS.all }) });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sales Invoices
// ═══════════════════════════════════════════════════════════════════════════════
export const INVOICE_KEYS = {
  all: ['salesInvoices'] as const,
  list: (p: object) => ['salesInvoices', 'list', p] as const,
  detail: (id: string) => ['salesInvoices', id] as const,
};
export interface InvoiceLineInput {
  itemId: string; description?: string | null; uomId: string; qty: number; unitPrice: number; discountPct?: number; taxCodeId?: string | null;
}
export interface UpsertInvoiceInput {
  customerId: string; deliveryNoteId?: string | null; salesOrderId?: string | null; invoiceDate: string; dueDate?: string | null; description?: string | null; lines: InvoiceLineInput[];
}
export interface InvoiceRow {
  id: string; docNo: string; customerId: string; customerName?: string; invoiceDate: string; dueDate: string;
  amount: number; taxAmount: number; totalAmount: number; paidAmount: number; status: string;
}
export const invoiceApi = {
  list: (params: { search?: string; status?: string; customerId?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: InvoiceRow[]; total: number }>('/sales/invoices', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/invoices/${id}`).then((r) => r.data),
  create: (data: UpsertInvoiceInput) => api.post<any>('/sales/invoices', data).then((r) => r.data),
  createFromDelivery: (deliveryNoteId: string) => api.post<any>(`/sales/invoices/from-delivery/${deliveryNoteId}`).then((r) => r.data),
  update: (id: string, data: UpsertInvoiceInput) => api.put<any>(`/sales/invoices/${id}`, data).then((r) => r.data),
  post: (id: string) => api.post<any>(`/sales/invoices/${id}/post`).then((r) => r.data),
  cancel: (id: string) => api.post<any>(`/sales/invoices/${id}/cancel`).then((r) => r.data),
};
export const useInvoices = (params: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: INVOICE_KEYS.list(params), queryFn: () => invoiceApi.list(params) });
export const useInvoice = (id: string | undefined) =>
  useQuery({ queryKey: INVOICE_KEYS.detail(id ?? ''), queryFn: () => invoiceApi.getById(id!), enabled: !!id });
export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: invoiceApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: INVOICE_KEYS.all }) });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sales Returns
// ═══════════════════════════════════════════════════════════════════════════════
export const RETURN_KEYS = { all: ['salesReturns'] as const, list: (p: object) => ['salesReturns', 'list', p] as const, detail: (id: string) => ['salesReturns', id] as const };
export interface ReturnLineInput { itemId: string; uomId: string; qty: number; }
export interface UpsertReturnInput { salesInvoiceId?: string | null; deliveryNoteId?: string | null; customerId?: string | null; returnDate: string; reason?: string | null; lines: ReturnLineInput[]; }
export interface ReturnRow { id: string; docNo: string; salesInvoiceId: string | null; deliveryNoteId: string | null; customerId: string | null; returnDate: string; reason: string | null; status: string; lineCount: number; }
export const returnApi = {
  list: (params: { search?: string; status?: string; page?: number; limit?: number } = {}) => api.get<{ data: ReturnRow[]; total: number }>('/sales/returns', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/returns/${id}`).then((r) => r.data),
  create: (data: UpsertReturnInput) => api.post<any>('/sales/returns', data).then((r) => r.data),
  approve: (id: string) => api.post<any>(`/sales/returns/${id}/approve`).then((r) => r.data),
  receive: (id: string) => api.post<any>(`/sales/returns/${id}/receive`).then((r) => r.data),
  close: (id: string) => api.post<any>(`/sales/returns/${id}/close`).then((r) => r.data),
};
export const useReturns = (params: { search?: string; status?: string } = {}) => useQuery({ queryKey: RETURN_KEYS.list(params), queryFn: () => returnApi.list(params) });
export const useReturn = (id: string | undefined) => useQuery({ queryKey: RETURN_KEYS.detail(id ?? ''), queryFn: () => returnApi.getById(id!), enabled: !!id });
export const useCreateReturn = () => { const qc = useQueryClient(); return useMutation({ mutationFn: returnApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: RETURN_KEYS.all }) }); };

// ═══════════════════════════════════════════════════════════════════════════════
// Credit Notes
// ═══════════════════════════════════════════════════════════════════════════════
export const CREDITNOTE_KEYS = { all: ['creditNotes'] as const, list: (p: object) => ['creditNotes', 'list', p] as const, detail: (id: string) => ['creditNotes', id] as const };
export interface CreditNoteLineInput { itemId: string; description?: string | null; uomId: string; qty: number; unitPrice: number; discountPct?: number; taxCodeId?: string | null; }
export interface UpsertCreditNoteInput { customerId: string; salesReturnId?: string | null; creditDate: string; reason?: string | null; lines: CreditNoteLineInput[]; }
export interface CreditNoteRow { id: string; docNo: string; customerId: string; customerName?: string; creditDate: string; amount: number; taxAmount: number; totalAmount: number; status: string; }
export const creditNoteApi = {
  list: (params: { search?: string; status?: string; page?: number; limit?: number } = {}) => api.get<{ data: CreditNoteRow[]; total: number }>('/sales/credit-notes', { params }).then((r) => r.data),
  getById: (id: string) => api.get<any>(`/sales/credit-notes/${id}`).then((r) => r.data),
  create: (data: UpsertCreditNoteInput) => api.post<any>('/sales/credit-notes', data).then((r) => r.data),
  createFromReturn: (returnId: string) => api.post<any>(`/sales/credit-notes/from-return/${returnId}`).then((r) => r.data),
  approve: (id: string) => api.post<any>(`/sales/credit-notes/${id}/approve`).then((r) => r.data),
  post: (id: string) => api.post<any>(`/sales/credit-notes/${id}/post`).then((r) => r.data),
  cancel: (id: string) => api.post<any>(`/sales/credit-notes/${id}/cancel`).then((r) => r.data),
};
export const useCreditNotes = (params: { search?: string; status?: string } = {}) => useQuery({ queryKey: CREDITNOTE_KEYS.list(params), queryFn: () => creditNoteApi.list(params) });
export const useCreditNote = (id: string | undefined) => useQuery({ queryKey: CREDITNOTE_KEYS.detail(id ?? ''), queryFn: () => creditNoteApi.getById(id!), enabled: !!id });
export const useCreateCreditNote = () => { const qc = useQueryClient(); return useMutation({ mutationFn: creditNoteApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: CREDITNOTE_KEYS.all }) }); };
