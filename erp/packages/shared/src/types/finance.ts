import type { AuditInfo } from './common.js';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type ApInvoiceStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'PARTIAL' | 'CANCELLED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';
export type CostCodeType = 'COST_CENTER' | 'PROJECT' | 'DEPARTMENT';

export interface GlAccount extends AuditInfo {
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

export interface CostCenter {
  id: string;
  companyId: string;
  code: string;
  name: string;
  parentId: string | null;
  budgetHolderId: string | null;
  isActive: boolean;
}

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

export interface JournalEntry extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  entryDate: string;
  description: string;
  status: JournalStatus;
  sourceModule: string | null;
  sourceDocId: string | null;
  totalDebit: number;
  totalCredit: number;
  lines?: JournalLine[];
}

export interface ApInvoice extends AuditInfo {
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
  status: ApInvoiceStatus;
  daysOverdue?: number;
}

export interface BudgetVsActual {
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId: string | null;
  annualBudget: number;
  ytdBudget: number;
  ytdActual: number;
  variance: number;
  variancePct: number;
}
