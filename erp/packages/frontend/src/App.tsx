import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from './router/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NotFoundPage = lazy(() => import('./pages/errors/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/errors/ForbiddenPage'));

// ── Procurement ───────────────────────────────────────────────────────────────
const ProcurementRouter = lazy(() => import('./pages/procurement/ProcurementRouter'));

// ── Inventory ─────────────────────────────────────────────────────────────────
const InventoryRouter = lazy(() => import('./pages/inventory/InventoryRouter'));

// ── Finance ───────────────────────────────────────────────────────────────────
const FinanceRouter = lazy(() => import('./pages/finance/FinanceRouter'));

// ── Admin ─────────────────────────────────────────────────────────────────────
const AdminRouter = lazy(() => import('./pages/admin/AdminRouter'));

// ── Notifications ─────────────────────────────────────────────────────────────
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));

// ── Spinner fallback ──────────────────────────────────────────────────────────
const PageSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 size={28} className="animate-spin text-[#1F4E79]" />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* Protected shell */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Procurement */}
          <Route
            path="/procurement/*"
            element={
              <ProtectedRoute requireModule="PROCUREMENT">
                <ProcurementRouter />
              </ProtectedRoute>
            }
          />

          {/* Inventory */}
          <Route
            path="/inventory/*"
            element={
              <ProtectedRoute requireModule="INVENTORY">
                <InventoryRouter />
              </ProtectedRoute>
            }
          />

          {/* Finance */}
          <Route
            path="/finance/*"
            element={
              <ProtectedRoute requireModule="FINANCE">
                <FinanceRouter />
              </ProtectedRoute>
            }
          />

          {/* Notifications */}
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Admin */}
          <Route path="/admin/*" element={<AdminRouter />} />

          {/* 404 inside shell */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Root redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
