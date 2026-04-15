import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const ModulesPage   = lazy(() => import('./ModulesPage'));
const UsersPage     = lazy(() => import('./UsersPage'));
const RolesPage     = lazy(() => import('./RolesPage'));
const SequencesPage = lazy(() => import('./SequencesPage'));

const Spin = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 size={28} className="animate-spin text-[#1F4E79]" />
  </div>
);

export default function AdminRouter() {
  return (
    <Suspense fallback={<Spin />}>
      <Routes>
        <Route index element={<Navigate to="modules" replace />} />
        <Route path="modules"   element={<ModulesPage />} />
        <Route path="users"     element={<UsersPage />} />
        <Route path="roles"     element={<RolesPage />} />
        <Route path="sequences" element={<SequencesPage />} />
        <Route path="*"         element={<Navigate to="modules" replace />} />
      </Routes>
    </Suspense>
  );
}
