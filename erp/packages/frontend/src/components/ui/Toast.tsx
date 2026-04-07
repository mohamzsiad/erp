import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { clsx } from 'clsx';

const ICONS = {
  success: <CheckCircle size={16} className="text-green-500" />,
  error: <AlertCircle size={16} className="text-red-500" />,
  warning: <AlertTriangle size={16} className="text-amber-500" />,
  info: <Info size={16} className="text-blue-500" />,
};

const BG = {
  success: 'border-green-200 bg-green-50',
  error: 'border-red-200 bg-red-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
};

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg pointer-events-auto animate-slide-in',
            BG[toast.type]
          )}
        >
          <span className="shrink-0 mt-0.5">{ICONS[toast.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{toast.title}</p>
            {toast.message && (
              <p className="text-xs text-gray-600 mt-0.5">{toast.message}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
          >
            <X size={13} className="text-gray-500" />
          </button>
        </div>
      ))}
    </div>
  );
};

/** Convenience hook to fire toasts from anywhere */
export const useToast = () => {
  const addToast = useUiStore((s) => s.addToast);
  return {
    success: (title: string, message?: string) => addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => addToast({ type: 'error', title, message }),
    warning: (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) => addToast({ type: 'info', title, message }),
  };
};
