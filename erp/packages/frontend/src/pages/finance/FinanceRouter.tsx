import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// ── GL / Accounts ─────────────────────────────────────────────────────────────
const AccountsPage       = lazy(() => import('./accounts/AccountsPage'));

// ── Journals ──────────────────────────────────────────────────────────────────
const JournalListPage    = lazy(() => import('./journals/JournalListPage'));
const JournalFormPage    = lazy(() => import('./journals/JournalFormPage'));

// ── AP ────────────────────────────────────────────────────────────────────────
const ApInvoiceListPage  = lazy(() => import('./ap/ApInvoiceListPage'));
const ApInvoiceFormPage  = lazy(() => import('./ap/ApInvoiceFormPage'));
const ApPaymentListPage  = lazy(() => import('./ap/ApPaymentListPage'));
const ApPaymentFormPage  = lazy(() => import('./ap/ApPaymentFormPage'));

// ── Reports ───────────────────────────────────────────────────────────────────
const TrialBalancePage   = lazy(() => import('./reports/TrialBalancePage'));
const PnlPage            = lazy(() => import('./reports/PnlPage'));
const BalanceSheetPage   = lazy(() => import('./reports/BalanceSheetPage'));
const BudgetVsActualPage = lazy(() => import('./reports/BudgetVsActualPage'));
const SupplierAgingPage  = lazy(() => import('./reports/SupplierAgingPage'));
const CustomerAgingPage  = lazy(() => import('./reports/CustomerAgingPage'));

// ── Spinner ───────────────────────────────────────────────────────────────────
const PageSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 size={28} className="animate-spin text-[#1F4E79]" />
  </div>
);

export default function FinanceRouter() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Default redirect */}
        <Route index element={<Navigate to="journals" replace />} />

        {/* General Ledger */}
        <Route path="accounts"            element={<AccountsPage />} />

        {/* Journals */}
        <Route path="journals"            element={<JournalListPage />} />
        <Route path="journals/new"        element={<JournalFormPage />} />
        <Route path="journals/:id"        element={<JournalFormPage />} />

        {/* AP — Invoices */}
        <Route path="ap/invoices"         element={<ApInvoiceListPage />} />
        <Route path="ap/invoices/new"     element={<ApInvoiceFormPage />} />
        <Route path="ap/invoices/:id"     element={<ApInvoiceFormPage />} />

        {/* AP — Payments */}
        <Route path="ap/payments"         element={<ApPaymentListPage />} />
        <Route path="ap/payments/new"     element={<ApPaymentFormPage />} />

        {/* Reports */}
        <Route path="reports/trial-balance"    element={<TrialBalancePage />} />
        <Route path="reports/pnl"              element={<PnlPage />} />
        <Route path="reports/balance-sheet"    element={<BalanceSheetPage />} />
        <Route path="reports/budget-vs-actual" element={<BudgetVsActualPage />} />
        <Route path="reports/supplier-aging"   element={<SupplierAgingPage />} />
        <Route path="reports/customer-aging"   element={<CustomerAgingPage />} />

        {/* Catch-all inside finance */}
        <Route path="*" element={<Navigate to="journals" replace />} />
      </Routes>
    </Suspense>
  );
}
