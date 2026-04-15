import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ApprovalModalProps {
  action: 'approve' | 'reject';
  docNo: string;
  onConfirm: (comment?: string) => Promise<void>;
  onClose: () => void;
}

export default function ApprovalModal({ action, docNo, onConfirm, onClose }: ApprovalModalProps) {
  const [comment, setComment]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const isReject = action === 'reject';

  const handleConfirm = async () => {
    if (isReject && !comment.trim()) {
      setError('A reason is required when rejecting.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(comment.trim() || undefined);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={clsx('px-5 py-4 flex items-center gap-3', isReject ? 'bg-red-50 border-b border-red-100' : 'bg-green-50 border-b border-green-100')}>
          {isReject
            ? <XCircle size={20} className="text-red-600 shrink-0" />
            : <CheckCircle size={20} className="text-green-600 shrink-0" />}
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              {isReject ? 'Reject' : 'Approve'} {docNo}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isReject
                ? 'The document will be returned to the requester.'
                : 'The document will be moved to the next step.'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {isReject ? 'Reason for rejection' : 'Comment'}{isReject && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => { setComment(e.target.value); setError(''); }}
            rows={3}
            placeholder={isReject ? 'Provide a reason...' : 'Optional comment...'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79] resize-none"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50',
              isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {isReject ? 'Reject' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
