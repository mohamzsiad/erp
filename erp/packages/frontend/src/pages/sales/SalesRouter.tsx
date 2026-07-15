import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const CustomerListPage = lazy(() => import('./customers/CustomerListPage'));
const CustomerFormPage = lazy(() => import('./customers/CustomerFormPage'));
const PriceListsPage = lazy(() => import('./priceLists/PriceListsPage'));
const PriceListEditorPage = lazy(() => import('./priceLists/PriceListEditorPage'));
const EnquiriesListPage = lazy(() => import('./enquiries/EnquiriesListPage'));
const EnquiryFormPage = lazy(() => import('./enquiries/EnquiryFormPage'));
const QuotationsListPage = lazy(() => import('./quotations/QuotationsListPage'));
const QuotationFormPage = lazy(() => import('./quotations/QuotationFormPage'));

const Spinner = () => (
  <div className="flex items-center justify-center h-48">
    <Loader2 size={24} className="animate-spin text-[#1F4E79]" />
  </div>
);

export default function SalesRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route index element={<Navigate to="customers" replace />} />

        {/* Customer Master */}
        <Route path="customers" element={<CustomerListPage />} />
        <Route path="customers/new" element={<CustomerFormPage />} />
        <Route path="customers/:id" element={<CustomerFormPage />} />

        {/* Price Lists */}
        <Route path="price-lists" element={<PriceListsPage />} />
        <Route path="price-lists/new" element={<PriceListEditorPage />} />
        <Route path="price-lists/:id" element={<PriceListEditorPage />} />

        {/* Enquiries */}
        <Route path="enquiries" element={<EnquiriesListPage />} />
        <Route path="enquiries/new" element={<EnquiryFormPage />} />
        <Route path="enquiries/:id" element={<EnquiryFormPage />} />

        {/* Quotations */}
        <Route path="quotations" element={<QuotationsListPage />} />
        <Route path="quotations/new" element={<QuotationFormPage />} />
        <Route path="quotations/:id" element={<QuotationFormPage />} />
      </Routes>
    </Suspense>
  );
}
