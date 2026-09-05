// ═══════════════════════════════════════════════════════════════════════════════
// Sales module shared types & DTOs
// Order-to-cash: Enquiry → Quotation → Sales Order → Delivery Note → Sales Invoice
//               (+ Returns / Credit Notes) and BOQ progress billing.
// Convention: money as number, dates as ISO strings (yyyy-MM-dd), Decimal → number.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Enums ─────────────────────────────────────────────────────────────────────
export type CustomerType         = 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
export type AddressType          = 'BILL_TO' | 'SHIP_TO';
export type PriceListType        = 'STANDARD' | 'CUSTOMER_SPECIFIC';
export type SalesmanType         = 'SALESMAN' | 'SUPERVISOR' | 'VAN_SALESMAN' | 'MANAGER';
export type PaymentMode          = 'NORMAL' | 'ADVANCE' | 'CASH_ON_DELIVERY' | 'CREDIT';
export type DueDateBasis         = 'DOCUMENT_DATE' | 'DELIVERY_DATE' | 'MONTH_END' | 'INVOICE_DATE';
export type SalesEnquiryStatus   = 'OPEN' | 'QUOTED' | 'WON' | 'LOST' | 'CLOSED';
export type SalesQuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type SalesOrderType       = 'STOCK' | 'SERVICE' | 'PROJECT' | 'DIRECT';
export type SalesOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CREDIT_HOLD'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';
export type DeliveryNoteStatus   = 'DRAFT' | 'DISPATCHED' | 'DELIVERED';
export type SalesInvoiceStatus   = 'DRAFT' | 'POSTED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type SalesReturnStatus    = 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'CLOSED';
export type CreditNoteStatus     = 'DRAFT' | 'APPROVED' | 'POSTED' | 'APPLIED' | 'CANCELLED';
export type SalesContractStatus  = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export type ProgressBillStatus   = 'DRAFT' | 'SUBMITTED' | 'CERTIFIED' | 'POSTED';

export type CreditCheckMode      = 'BLOCK' | 'WARN' | 'OFF';

// ── Module config ─────────────────────────────────────────────────────────────
export interface SalesConfig {
  CREDIT_CHECK_MODE: CreditCheckMode;
  RESERVE_STOCK_ON_ORDER: boolean;
  ALLOW_NEGATIVE_STOCK: boolean;
  SO_APPROVAL_REQUIRED: boolean;
  DEFAULT_TAX_CODE: string;
  AUTO_POST_INVOICE: boolean;
  PRICE_OVERRIDE_ALLOWED: boolean;
}

// ── Tax Code ──────────────────────────────────────────────────────────────────
export interface TaxCode {
  id: string;
  companyId: string;
  code: string;
  name: string;
  rate: number;                 // percentage, e.g. 5 = 5%
  vatOutputAccountId: string | null;
  isActive: boolean;
}

// ── Customer master ───────────────────────────────────────────────────────────
export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  type: AddressType;
  name: string | null;
  line1: string;
  line2: string | null;
  line3: string | null;
  line4: string | null;
  line5: string | null;
  countryId: string | null;
  country: string | null;
  cityId: string | null;
  city: string | null;
  postalCode: string | null;
  street: string | null;
  // Contact details are held per address — there is no separate contacts tab
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  // Statutory registration numbers
  vatNo: string | null;
  crNo: string | null;
  taxCardNo: string | null;
  isDefault: boolean;
}

// ── Country / city reference data ─────────────────────────────────────────────
export interface Country {
  id: string;
  code: string;
  name: string;
  /** Expected leading characters of a VAT number, e.g. "OM". */
  vatPrefix: string | null;
  /** Mandated total length of a VAT number; null means unchecked. */
  vatLength: number | null;
  vatFormatHint: string | null;
  isActive: boolean;
  cityCount?: number;
}

export interface City {
  id: string;
  countryId: string;
  code: string;
  name: string;
  isActive?: boolean;
}

// ── Salesman master ───────────────────────────────────────────────────────────
export interface Salesman {
  id: string;
  companyId: string;
  code: string;
  name: string;
  shortName: string | null;
  type: SalesmanType;
  minMarkupPct: number;
  maxVariancePct: number;
  locationId: string | null;
  locationName?: string | null;
  contactNumber: string | null;
  email: string | null;
  userId: string | null;
  isActive: boolean;
  customerCount?: number;
}

export interface UpsertSalesmanInput {
  code?: string;
  name: string;
  shortName?: string | null;
  type?: SalesmanType;
  minMarkupPct?: number;
  maxVariancePct?: number;
  locationId?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  userId?: string | null;
  isActive?: boolean;
}

// ── Payment terms master ──────────────────────────────────────────────────────
export interface PaymentTermLine {
  id?: string;
  lineNo?: number;
  paymentPct: number;
  addMonths: number;
  creditDays: number;
  cashDiscountDays: number | null;
  cashDiscountPct: number | null;
  isActive: boolean;
}

export interface PaymentTerm {
  id: string;
  companyId: string;
  code: string;
  name: string;
  shortName: string | null;
  paymentMode: PaymentMode;
  dueDateBasis: DueDateBasis;
  dueDateAfterAdvance: boolean;
  creditDays: number;
  isActive: boolean;
  lines: PaymentTermLine[];
}

export interface UpsertPaymentTermInput {
  code?: string;
  name: string;
  shortName?: string | null;
  paymentMode?: PaymentMode;
  dueDateBasis?: DueDateBasis;
  dueDateAfterAdvance?: boolean;
  creditDays?: number;
  isActive?: boolean;
  lines?: Array<Omit<PaymentTermLine, 'id' | 'lineNo'>>;
}

// ── Company-wise customer terms (group companies) ─────────────────────────────
export interface CustomerCompanyTerms {
  id?: string;
  companyId: string;
  companyName?: string | null;
  salesmanId: string | null;
  salesmanName?: string | null;
  priceListId: string | null;
  priceListName?: string | null;
  paymentTermId: string | null;
  paymentTermName?: string | null;
  creditLimit: number;
  creditExposureLimit: number;
  closeToExpiryDays: number | null;
  isBlackListed: boolean;
  isGreyListed: boolean;
  isActive: boolean;
}

export interface CustomerCategory {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CustomerDetail {
  id: string;
  companyId: string;
  code: string;
  name: string;
  tradeName: string | null;
  type: CustomerType;
  trn: string | null;
  defaultTaxCodeId: string | null;
  isTaxExempt: boolean;
  paymentTerms: string | null;
  paymentTermId: string | null;
  currencyId: string | null;
  creditLimit: number;
  creditHold: boolean;
  isBlackListed: boolean;
  priceListId: string | null;
  salespersonId: string | null;
  salesmanId: string | null;
  categoryId: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  contacts?: CustomerContact[];
  addresses?: CustomerAddress[];
  companyTerms?: CustomerCompanyTerms[];
  // Enriched
  categoryName?: string;
  salespersonName?: string;
  salesmanName?: string | null;
  paymentTermName?: string | null;
  currencyCode?: string | null;
  priceListLabel?: string | null;
  currencyIds?: string[];
  allowedCurrencies?: Array<{ currencyId: string; code: string; name: string; isDefault: boolean }>;
}

/** Terms a sales document spools off the customer master for a given company. */
export interface CustomerEffectiveTerms {
  customerId: string;
  companyId: string;
  salesmanId: string | null;
  priceListId: string | null;
  paymentTermId: string | null;
  paymentTerms: string | null;
  currencyId: string | null;
  creditLimit: number;
  creditExposureLimit: number;
  creditHold: boolean;
  isBlackListed: boolean;
  isGreyListed: boolean;
  isActive: boolean;
  defaultTaxCodeId: string | null;
  isTaxExempt: boolean;
  /** True when the customer has a terms row for this company. */
  hasCompanyTerms?: boolean;
}

export interface CustomerFinancialSummary {
  customerId: string;
  creditLimit: number;
  outstandingBalance: number;
  overdueAmount: number;
  openOrderValue: number;
  availableCredit: number;
}

export interface UpsertCustomerInput {
  code?: string;
  name: string;
  tradeName?: string;
  type?: CustomerType;
  trn?: string;
  defaultTaxCodeId?: string;
  isTaxExempt?: boolean;
  paymentTerms?: string;
  paymentTermId?: string;
  currencyId?: string;
  creditLimit?: number;
  creditHold?: boolean;
  isBlackListed?: boolean;
  priceListId?: string;
  salespersonId?: string;
  salesmanId?: string;
  categoryId?: string;
  notes?: string;
  isActive?: boolean;
  contacts?: Array<Omit<CustomerContact, 'id' | 'customerId'>>;
  addresses?: Array<Omit<CustomerAddress, 'id' | 'customerId'>>;
  companyTerms?: CustomerCompanyTerms[];
  /** Currencies this customer may transact in; the first is the default. */
  currencyIds?: string[];
}

// ── Price lists ───────────────────────────────────────────────────────────────
export interface PriceListItem {
  id: string;
  priceListId: string;
  itemId: string;
  uomId: string;
  unitPrice: number;
  minPrice: number;
  /** Both dates are mandatory — a price with no validity window is rejected. */
  validFrom: string;
  validTo: string;
  // Enriched
  itemCode?: string;
  itemDescription?: string;
}

export interface PriceList {
  id: string;
  companyId: string;
  /** Mandatory unique key — auto-generated (STD001 / CSP001) when left blank. */
  code: string;
  name: string;
  /** STANDARD attaches to many customers/categories; CUSTOMER_SPECIFIC to one customer. */
  type: PriceListType;
  ownerCustomerId: string | null;
  ownerCustomerCode?: string | null;
  ownerCustomerName?: string | null;
  currencyId: string | null;
  currencyCode?: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  isDefault: boolean;
  itemCount?: number;
  assignedCount?: number;
  items?: PriceListItem[];
}

export interface PriceResolution {
  unitPrice: number | null;
  minPrice: number | null;
  source: 'CUSTOMER' | 'CUSTOMER_CATEGORY' | 'DEFAULT' | 'MANUAL';
}

// ── Common line shape ─────────────────────────────────────────────────────────
export interface SalesLineBase {
  id: string;
  itemId: string;
  description: string | null;
  uomId: string;
  lineNo: number;
  itemCode?: string;
  itemDescription?: string;
  uomCode?: string;
}

// ── Sales Enquiry ─────────────────────────────────────────────────────────────
export interface SalesEnquiryLine {
  id: string;
  enquiryId: string;
  itemId: string;
  description: string | null;
  uomId: string;
  qty: number;
  targetPrice: number | null;
  lineNo: number;
}

export interface SalesEnquiry {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string | null;
  prospectName: string | null;
  enquiryDate: string;
  requiredByDate: string | null;
  salespersonId: string | null;
  source: string | null;
  lostReason: string | null;
  notes: string | null;
  status: SalesEnquiryStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: SalesEnquiryLine[];
  customerName?: string;
}

// ── Sales Quotation ───────────────────────────────────────────────────────────
export interface SalesQuotationLine {
  id: string;
  quotationId: string;
  itemId: string;
  description: string | null;
  uomId: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId: string | null;
  netAmount: number;
  lineNo: number;
}

export interface SalesQuotation {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  enquiryId: string | null;
  rev: number;
  quotationDate: string;
  validTo: string | null;
  paymentTerms: string | null;
  salespersonId: string | null;
  status: SalesQuotationStatus;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: SalesQuotationLine[];
  customerName?: string;
}

// ── Sales Order ───────────────────────────────────────────────────────────────
export interface SalesOrderLine {
  id: string;
  orderId: string;
  itemId: string;
  description: string | null;
  uomId: string;
  orderedQty: number;
  deliveredQty: number;
  invoicedQty: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId: string | null;
  netAmount: number;
  requestedDate: string | null;
  // Stock reservation held by this line
  reservedQty: number;
  reserveWarehouseId: string | null;
  reserveUntil: string | null;
  lineNo: number;
  // Enriched (availability)
  availableToPromise?: number;
  groupAvailable?: number;
  reserveWarehouseCode?: string | null;
  /** From the item master — reservation controls are hidden when false. */
  reservationAllowed?: boolean;
}

/** Warehouse-level and group-level stock for one item. */
export interface ItemStockPosition {
  itemId: string;
  warehouseId: string | null;
  warehouseOnHand: number;
  warehouseReserved: number;
  warehouseAvailable: number;
  groupOnHand: number;
  groupReserved: number;
  groupAvailable: number;
  byWarehouse: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    onHand: number;
    reserved: number;
    available: number;
  }>;
}

export interface SalesOrder {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  quotationId: string | null;
  contractId: string | null;
  orderType: SalesOrderType;
  orderDate: string;
  requestedDate: string | null;
  billToAddressId: string | null;
  shipToAddressId: string | null;
  salespersonId: string | null;
  salesmanId: string | null;
  paymentTerms: string | null;
  paymentTermId: string | null;
  currencyId: string | null;
  exchangeRate: number;
  /** Location the order is raised from. */
  locationId: string | null;
  warehouseId: string | null;
  notes: string | null;
  status: SalesOrderStatus;
  creditHoldReason: string | null;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  createdById: string;
  approvedById: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: SalesOrderLine[];
  customerName?: string;
  salesmanName?: string | null;
  currencyCode?: string | null;
  locationName?: string | null;
}

export interface CreditCheckResult {
  passed: boolean;
  mode: CreditCheckMode;
  creditLimit: number;
  availableCredit: number;
  orderValue: number;
  overdueAmount: number;
  onHold: boolean;
  message?: string;
}

// ── Delivery Note ─────────────────────────────────────────────────────────────
export interface DeliveryNoteLine {
  id: string;
  deliveryNoteId: string;
  salesOrderLineId: string | null;
  itemId: string;
  uomId: string;
  deliveredQty: number;
  binId: string | null;
  unitCost: number;
  lineNo: number;
}

export interface DeliveryNote {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  salesOrderId: string | null;
  deliveryDate: string;
  shipToAddressId: string | null;
  warehouseId: string;
  vehicleNo: string | null;
  driver: string | null;
  notes: string | null;
  status: DeliveryNoteStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: DeliveryNoteLine[];
  customerName?: string;
}

// ── Sales Invoice ─────────────────────────────────────────────────────────────
export interface SalesInvoiceLine {
  id: string;
  invoiceId: string;
  itemId: string;
  description: string | null;
  uomId: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxCodeId: string | null;
  netAmount: number;
  taxAmount: number;
  lineTotal: number;
  lineNo: number;
}

export interface SalesInvoice {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  deliveryNoteId: string | null;
  salesOrderId: string | null;
  invoiceDate: string;
  dueDate: string;
  description: string | null;
  subTotal: number;
  discountAmount: number;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: SalesInvoiceStatus;
  journalId: string | null;
  arInvoiceId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: SalesInvoiceLine[];
  customerName?: string;
}

// ── Sales Return ──────────────────────────────────────────────────────────────
export interface SalesReturnLine {
  id: string;
  returnId: string;
  itemId: string;
  uomId: string;
  qty: number;
  lineNo: number;
}

export interface SalesReturn {
  id: string;
  companyId: string;
  docNo: string;
  salesInvoiceId: string | null;
  deliveryNoteId: string | null;
  customerId: string | null;
  returnDate: string;
  reason: string | null;
  status: SalesReturnStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: SalesReturnLine[];
}

// ── Credit Note ───────────────────────────────────────────────────────────────
export interface CreditNoteLine {
  id: string;
  creditNoteId: string;
  itemId: string;
  description: string | null;
  uomId: string;
  qty: number;
  unitPrice: number;
  taxCodeId: string | null;
  netAmount: number;
  taxAmount: number;
  lineTotal: number;
  lineNo: number;
}

export interface CreditNote {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  salesReturnId: string | null;
  creditDate: string;
  reason: string | null;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: CreditNoteStatus;
  journalId: string | null;
  arInvoiceId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: CreditNoteLine[];
  customerName?: string;
}

// ── Project / Contract billing ────────────────────────────────────────────────
export interface BoqLine {
  id: string;
  contractId: string;
  section: string | null;
  subSection: string | null;
  itemDescription: string;
  uomId: string | null;
  contractQty: number;
  rate: number;
  contractAmount: number;
  lineNo: number;
  // Enriched (progress)
  certifiedQtyToDate?: number;
  certifiedValueToDate?: number;
}

export interface SalesContract {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  projectRef: string | null;
  projectName: string;
  contractValue: number;
  startDate: string | null;
  endDate: string | null;
  paymentTerms: string | null;
  costCenterId: string | null;
  status: SalesContractStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  boqLines?: BoqLine[];
  customerName?: string;
}

export interface ProgressBillLine {
  id: string;
  progressBillId: string;
  boqLineId: string;
  cumQty: number;
  cumValue: number;
  previousValue: number;
  thisValue: number;
  lineNo: number;
  // Enriched
  itemDescription?: string;
  contractQty?: number;
  rate?: number;
}

export interface ProgressBill {
  id: string;
  companyId: string;
  docNo: string;
  contractId: string;
  period: string;
  billDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: ProgressBillStatus;
  journalId: string | null;
  arInvoiceId: string | null;
  certifiedById: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: ProgressBillLine[];
}

export interface ContractProgressSummary {
  contractId: string;
  contractValue: number;
  certifiedToDate: number;
  thisBill: number;
  balanceToComplete: number;
  percentComplete: number;
}
