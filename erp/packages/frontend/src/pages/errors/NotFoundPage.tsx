import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <FileQuestion size={32} className="text-gray-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800">404</h1>
        <p className="text-gray-600 mt-2">The page you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white text-sm font-medium rounded-lg hover:bg-[#163D5F] transition-colors"
        >
          <ArrowLeft size={15} />
          Go back
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
