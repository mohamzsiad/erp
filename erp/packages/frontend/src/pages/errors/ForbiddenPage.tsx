import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';

const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reason = (location.state as { reason?: string })?.reason;

  const message =
    reason === 'module-disabled'
      ? 'This module is not enabled for your company.'
      : 'You do not have permission to access this page.';

  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <ShieldOff size={32} className="text-red-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800">403</h1>
        <p className="text-gray-600 mt-2">{message}</p>
        <p className="text-gray-400 text-sm mt-1">
          Contact your system administrator if you believe this is an error.
        </p>
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white text-sm font-medium rounded-lg hover:bg-[#163D5F] transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ForbiddenPage;
