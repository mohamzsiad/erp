import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// ── Item Master ───────────────────────────────────────────────────────────────
const ItemListPage  = lazy(() => import('./items/ItemListPage'));
const ItemFormPage  = lazy(() => import('./items/ItemFormPage'));

// ── Warehouse Master ──────────────────────────────────────────────────────────
const WarehouseListPage = lazy(() => import('./warehouses/WarehouseListPage'));
const WarehouseFormPage = lazy(() => import('./warehouses/WarehouseFormPage'));

// ── Bin Master ────────────────────────────────────────────────────────────────
const BinListPage  = lazy(() => import('./bins/BinListPage'));
const BinFormPage  = lazy(() => import('./bins/BinFormPage'));

// ── GRN ───────────────────────────────────────────────────────────────────────
const GrnListPage  = lazy(() => import('./grn/GrnListPage'));
const GrnFormPage  = lazy(() => import('./grn/GrnFormPage'));

// ── Stock Issue ───────────────────────────────────────────────────────────────
const IssueListPage = lazy(() => import('./issue/IssueListPage'));
const IssueFormPage = lazy(() => import('./issue/IssueFormPage'));

// ── Stock Transfer ────────────────────────────────────────────────────────────
const TransferListPage = lazy(() => import('./transfer/TransferListPage'));
const TransferFormPage = lazy(() => import('./transfer/TransferFormPage'));

// ── Stock Adjustment ──────────────────────────────────────────────────────────
const AdjustmentListPage = lazy(() => import('./adjustment/AdjustmentListPage'));
const AdjustmentFormPage = lazy(() => import('./adjustment/AdjustmentFormPage'));

// ── Queries ───────────────────────────────────────────────────────────────────
const StockBalancePage = lazy(() => import('./queries/StockBalancePage'));

// ── Reports ───────────────────────────────────────────────────────────────────
const StockBalanceReport         = lazy(() => import('./reports/StockBalanceReport'));
const StockAgingReport           = lazy(() => import('./reports/StockAgingReport'));
const DeadInactiveObsoleteReport = lazy(() => import('./reports/DeadInactiveObsoleteReport'));
const GrnSummaryReport           = lazy(() => import('./reports/GrnSummaryReport'));
const StockMovementReport        = lazy(() => import('./reports/StockMovementReport'));
const ReorderReport              = lazy(() => import('./reports/ReorderReport'));
const ValuationReport            = lazy(() => import('./reports/ValuationReport'));

const Spinner = () => (
  <div className="flex items-center justify-center h-48">
    <Loader2 size={24} className="animate-spin text-[#1F4E79]" />
  </div>
);

export default function InventoryRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route index element={<Navigate to="items" replace />} />

        {/* Item Master */}
        <Route path="items"     element={<ItemListPage />} />
        <Route path="items/new" element={<ItemFormPage />} />
        <Route path="items/:id" element={<ItemFormPage />} />

        {/* Warehouse Master */}
        <Route path="warehouses"     element={<WarehouseListPage />} />
        <Route path="warehouses/new" element={<WarehouseFormPage />} />
        <Route path="warehouses/:id" element={<WarehouseFormPage />} />

        {/* Bin Master */}
        <Route path="bins"     element={<BinListPage />} />
        <Route path="bins/new" element={<BinFormPage />} />
        <Route path="bins/:id" element={<BinFormPage />} />

        {/* GRN */}
        <Route path="grn"     element={<GrnListPage />} />
        <Route path="grn/new" element={<GrnFormPage />} />
        <Route path="grn/:id" element={<GrnFormPage />} />

        {/* Stock Issue */}
        <Route path="issue"     element={<IssueListPage />} />
        <Route path="issue/new" element={<IssueFormPage />} />
        <Route path="issue/:id" element={<IssueFormPage />} />

        {/* Stock Transfer */}
        <Route path="transfer"     element={<TransferListPage />} />
        <Route path="transfer/new" element={<TransferFormPage />} />
        <Route path="transfer/:id" element={<TransferFormPage />} />

        {/* Stock Adjustment */}
        <Route path="adjustment"     element={<AdjustmentListPage />} />
        <Route path="adjustment/new" element={<AdjustmentFormPage />} />
        <Route path="adjustment/:id" element={<AdjustmentFormPage />} />

        {/* Queries */}
        <Route path="queries/stock-balance" element={<StockBalancePage />} />

        {/* Reports */}
        <Route path="reports/stock-balance"           element={<StockBalanceReport />} />
        <Route path="reports/stock-aging"             element={<StockAgingReport />} />
        <Route path="reports/dead-inactive-obsolete"  element={<DeadInactiveObsoleteReport />} />
        <Route path="reports/grn-summary"             element={<GrnSummaryReport />} />
        <Route path="reports/stock-movement"          element={<StockMovementReport />} />
        <Route path="reports/reorder"                 element={<ReorderReport />} />
        <Route path="reports/valuation"               element={<ValuationReport />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="items" replace />} />
      </Routes>
    </Suspense>
  );
}
