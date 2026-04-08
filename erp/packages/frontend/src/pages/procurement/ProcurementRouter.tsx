import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const SupplierListPage = lazy(() => import('./suppliers/SupplierListPage'));
const SupplierFormPage = lazy(() => import('./suppliers/SupplierFormPage'));
const MrlListPage = lazy(() => import('./mrl/MrlListPage'));
const MrlFormPage = lazy(() => import('./mrl/MrlFormPage'));
const PrlListPage = lazy(() => import('./prl/PrlListPage'));
const PrlFormPage = lazy(() => import('./prl/PrlFormPage'));
const PoListPage = lazy(() => import('./po/PoListPage'));
const PoFormPage = lazy(() => import('./po/PoFormPage'));

// Reports
const PrStatusReport           = lazy(() => import('./reports/PrStatusReport'));
const PoStatusReport           = lazy(() => import('./reports/PoStatusReport'));
const PoHistoryBySupplierReport = lazy(() => import('./reports/PoHistoryBySupplierReport'));
const ProcurementTrackingReport = lazy(() => import('./reports/ProcurementTrackingReport'));
const LeadTimeVarianceReport   = lazy(() => import('./reports/LeadTimeVarianceReport'));
const PriceComparisonReport    = lazy(() => import('./reports/PriceComparisonReport'));
const PendingPrReport          = lazy(() => import('./reports/PendingPrReport'));

const Spinner = () => (
  <div className="flex items-center justify-center h-48">
    <Loader2 size={24} className="animate-spin text-[#1F4E79]" />
  </div>
);

export default function ProcurementRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route index element={<Navigate to="mrl" replace />} />

        {/* Supplier Master */}
        <Route path="suppliers" element={<SupplierListPage />} />
        <Route path="suppliers/new" element={<SupplierFormPage />} />
        <Route path="suppliers/:id" element={<SupplierFormPage />} />

        {/* Material Requisition */}
        <Route path="mrl" element={<MrlListPage />} />
        <Route path="mrl/new" element={<MrlFormPage />} />
        <Route path="mrl/:id" element={<MrlFormPage />} />

        {/* Purchase Requisition */}
        <Route path="prl" element={<PrlListPage />} />
        <Route path="prl/new" element={<PrlFormPage />} />
        <Route path="prl/:id" element={<PrlFormPage />} />

        {/* Purchase Order */}
        <Route path="po" element={<PoListPage />} />
        <Route path="po/new" element={<PoFormPage />} />
        <Route path="po/:id" element={<PoFormPage />} />

        {/* Reports */}
        <Route path="reports/pr-status"              element={<PrStatusReport />} />
        <Route path="reports/po-status"              element={<PoStatusReport />} />
        <Route path="reports/po-history-by-supplier" element={<PoHistoryBySupplierReport />} />
        <Route path="reports/procurement-tracking"   element={<ProcurementTrackingReport />} />
        <Route path="reports/lead-time-variance"     element={<LeadTimeVarianceReport />} />
        <Route path="reports/price-comparison"       element={<PriceComparisonReport />} />
        <Route path="reports/pending-pr"             element={<PendingPrReport />} />
      </Routes>
    </Suspense>
  );
}
