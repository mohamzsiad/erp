import type { AuditInfo } from './common.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export type AccountType       = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type JournalStatus     = 'DRAFT' | 'POSTED' | 'REVERSED';
export type ApInvoiceStatus   = 'DRAFT' | 'APPROVED' | 'PAID' | 'PARTIAL' | 'CANCELLED';
export type PaymentMethod     = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';
export type CostCodeType      = 'COST_CENTER' | 'PROJECT' | 'DEPARTMENT';
export type AccountMappingType =
  | 'INVENTORY_ACCOUNT'
  | 'SUPPLIER_CONTROL'
  | 'CUSTOMER_CONTROL'
  | 'GRN_CLEARING'
  | 'BANK_ACCOUNT'
  | 'AP_EXPENSE'
  | 'AR_REVENUE';

// ── GL Account ────────────────────────────────────────────────────────────────
export interface GlAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  accountType: AccountType;
  parentId: string | null;
  isControl: boolean;
  currencyId: string | null;
  isActive: boolean;
  children?: GlAccount[];
}

export interface GlAccountTree extends GlAccount {
  children: GlAccountTree[];
}

// ── Cost Center ───────────────────────────────────────────────────────────────
export interface CostCenter {
  id: string;
  companyId: string;
  code: string;
  name: string;
  parentId: string | null;
  budgetHolderId: string | null;
  isActive: boolean;
  children?: CostCenter[];
}

export interface CostCenterBudgetStatus {
  costCenterId: string;
  code: string;
  name: string;
  period: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePct: number;
}

// ── Cost Code ─────────────────────────────────────────────────────────────────
export interface CostCode {
  id: string;
  companyId: string;
  code: string;
  name: string;
  costCenterId: string | null;
  type: CostCodeType;
  isActive: boolean;
}

// ── Journal ───────────────────────────────────────────────────────────────────
export interface JournalLine {
  id: string;
  journalId: string;
  accountId: string;
  costCenterId: string | null;
  debit: number;
  credit: number;
  currencyId: string | null;
  fxRate: number;
  description: string | null;
  lineNo: number;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  docNo: string;
  entryDate: string;
  description: string;
  status: JournalStatus;
  sourceModule: string | null;
  sourceDocId: string | null;
  reversedById: string | null;
  postedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: JournalLine[];
}

export interface PostJournalInput {
  entryDate: string; // yyyy-MM-dd
  description: string;
  lines: Array<{
    accountId: string;
    costCenterId?: string;
    debit: number;
    credit: number;
    currencyId?: string;
    fxRate?: number;
    description?: string;
  }>;
  sourceModule?: 'MANUAL' | 'PROCUREMENT' | 'INVENTORY' | 'AP' | 'AR';
  sourceDocId?: string;
}

// ── AP ────────────────────────────────────────────────────────────────────────
export interface ApInvoice {
  id: string;
  companyId: string;
  docNo: string;
  supplierId: string;
  poId: string | null;
  grnId: string | null;
  supplierInvoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: ApInvoiceStatus;
  matchFlag: string | null;
  journalId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  // Enriched
  supplierName?: string;
  daysOverdue?: number;
  agingBucket?: string;
}

export interface ApPayment {
  id: string;
  companyId: string;
  docNo: string;
  supplierId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankAccountId: string | null;
  notes: string | null;
  status: string;
  journalId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  allocations?: ApAllocation[];
}

export interface ApAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  allocatedAt: string;
}

// ── AR ────────────────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ArInvoice {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  description: string | null;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  journalId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  daysOverdue?: number;
  agingBucket?: string;
}

export interface ArReceipt {
  id: string;
  companyId: string;
  docNo: string;
  customerId: string;
  receiptDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes: string | null;
  status: string;
  journalId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArAllocation {
  id: string;
  receiptId: string;
  invoiceId: string;
  amount: number;
  allocatedAt: string;
}

// ── Budget ────────────────────────────────────────────────────────────────────
export interface Budget {
  id: string;
  companyId: string;
  fiscalYear: number;
  accountId: string;
  costCenterId: string | null;
  annualAmount: number;
  periods?: BudgetPeriod[];
}

export interface BudgetPeriod {
  id: string;
  budgetId: string;
  periodMonth: number;
  periodYear: number;
  budgetedAmount: number;
  actualAmount: number;
}

export interface BudgetVsActual {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  costCenterId: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  annualBudget: number;
  ytdBudget: number;
  ytdActual: number;
  variance: number;
  variancePct: number;
}

// ── Period Close ──────────────────────────────────────────────────────────────
export interface Period {
  year: number;
  month: number;
  label: string;         // e.g. "Jan 2026"
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  closedById: string | null;
  reopenedAt: string | null;
}

// ── Account Mapping ───────────────────────────────────────────────────────────
export interface AccountMapping {
  id: string;
  companyId: string;
  mappingType: AccountMappingType;
  refId: string | null;
  accountId: string;
  accountCode?: string;
  accountName?: string;
}

// ── Financial Reports ─────────────────────────────────────────────────────────
export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface PnlLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'REVENUE' | 'EXPENSE';
  amount: number;
}

export interface PnlReport {
  periodFrom: string;
  periodTo: string;
  revenue: PnlLine[];
  expenses: PnlLine[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export interface BalanceSheetLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  balance: number;
}

export interface BalanceSheetReport {
  asOf: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface AgingLine {
  entityId: string;
  entityCode: string;
  entityName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}
