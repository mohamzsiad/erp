import type { AuditInfo } from './common.js';

export type ShipmentMode = 'AIR' | 'SEA' | 'LAND' | 'NA';

// ── Supplier ──────────────────────────────────────────────────────────────────
export interface Supplier extends AuditInfo {
  id: string;
  companyId: string;
  code: string;
  name: string;
  shortName: string;
  controlAccountId: string | null;
  creditDays: number;
  creditAmount: number;
  parentSupplierId: string | null;
  shipmentMode: ShipmentMode;
  isTdsApplicable: boolean;
  isTdsParty: boolean;
  isActive: boolean;
  isParentSupplier: boolean;
}

export interface SupplierBankDetail {
  id: string;
  supplierId: string;
  bankName: string;
  accountNo: string;
  iban: string | null;
  swiftCode: string | null;
  isActive: boolean;
}

export interface SupplierContact {
  id: string;
  supplierId: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface SupplierWithDetails extends Supplier {
  bankDetails: SupplierBankDetail[];
  contacts: SupplierContact[];
}

// ── MRL ───────────────────────────────────────────────────────────────────────
export type MrlStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'CLOSED';

export interface MrlLine {
  id: string;
  mrlId: string;
  itemId: string;
  grade1: string | null;
  grade2: string | null;
  uomId: string;
  freeStock: number;
  requestedQty: number;
  approvedQty: number;
  approxPrice: number;
  lineNo: number;
}

export interface MaterialRequisition extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  docDate: string;
  locationId: string;
  chargeCodeId: string;
  deliveryDate: string;
  remarks: string | null;
  status: MrlStatus;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  lines?: MrlLine[];
}

// ── PRL ───────────────────────────────────────────────────────────────────────
export type PrlStatus = 'DRAFT' | 'APPROVED' | 'ENQUIRY_SENT' | 'PO_CREATED' | 'SHORT_CLOSED' | 'CLOSED';

export interface PrlLine {
  id: string;
  prlId: string;
  itemId: string;
  grade1: string | null;
  grade2: string | null;
  uomId: string;
  freeStock: number;
  requestedQty: number;
  approvedQty: number;
  approxPrice: number;
  chargeCodeId: string;
  lineNo: number;
  isShortClosed: boolean;
  item?: { id: string; code: string; description: string };
  uom?: { id: string; code: string; name: string };
}

export interface PurchaseRequisition extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  docDate: string;
  locationId: string;
  chargeCodeId: string;
  deliveryDate: string;
  remarks: string | null;
  status: PrlStatus;
  mrlId: string | null;
  createdById: string;
  approvedById: string | null;
  location?: { id: string; code: string; name: string };
  chargeCode?: { id: string; code: string; name: string };
  mrl?: { docNo: string } | null;
  lines?: PrlLine[];
}

// ── Purchase Enquiry / RFQ ────────────────────────────────────────────────────
export interface EnquiryQuotationSummary {
  id: string;
  supplierId: string;
  status: string;
  supplier?: { code: string; name: string };
  currency?: { code: string };
}

export interface PurchaseEnquiry extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  docDate: string;
  prlId: string | null;
  status: string;
  createdById: string;
  prl?: {
    docNo: string;
    lines?: PrlLine[];
  };
  quotations?: EnquiryQuotationSummary[];
}

// ── Purchase Quotation ────────────────────────────────────────────────────────
export interface PurchaseQuotation extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  supplierId: string;
  enquiryId: string | null;
  validityDate: string;
  currencyId: string;
  paymentTerms: string | null;
  status: string;
  totalAmount: number;
  createdById: string;
  supplier?: { id: string; code: string; name: string };
  currency?: { id: string; code: string; name?: string };
  enquiry?: { id: string; docNo: string; prl?: { docNo: string } };
}

// ── Purchase Order ────────────────────────────────────────────────────────────
export type PoStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'RECEIVED' | 'INVOICED' | 'CLOSED' | 'CANCELLED';

export interface PoLine {
  id: string;
  poId: string;
  itemId: string;
  uomId: string;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
  netAmount: number;
  chargeCodeId: string;
  lineNo: number;
}

export interface PurchaseOrder extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  docDate: string;
  supplierId: string;
  supplier?: {
    code: string;
    name: string;
    contacts?: SupplierContact[];
    bankDetails?: SupplierBankDetail[];
  };
  currencyId: string;
  currency?: { code: string };
  exchangeRate: number;
  paymentTerms: string | null;
  incoterms: string | null;
  deliveryDate: string | null;
  shipToLocationId: string | null;
  shipToLocation?: { id: string; code: string; name: string } | null;
  warehouseId: string | null;
  warehouse?: { id: string; code: string; name: string } | null;
  notes: string | null;
  status: PoStatus;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  approvedById: string | null;
  approvedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  totalAmount: number;
  lines?: PoLine[];
  grnHeaders?: { id: string; docNo: string; status: string; docDate: string }[];
  apInvoices?: { id: string; docNo: string; status: string; invoiceDate: string; totalAmount: number }[];
}

// ── Workflow ──────────────────────────────────────────────────────────────────
export interface WorkflowLevel {
  level: number;
  approverRole: string;
  minAmount: number;
  maxAmount: number | null;
}

export interface ApprovalAction {
  docType: string;
  docId: string;
  action: 'approve' | 'reject';
  comment?: string;
  lineAdjustments?: Array<{ lineId: string; approvedQty: number }>;
}

// ── Notification ──────────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  docType: string | null;
  docId: string | null;
  isRead: boolean;
  createdAt: string;
}

// StockSummary is defined in inventory.ts — imported from there
