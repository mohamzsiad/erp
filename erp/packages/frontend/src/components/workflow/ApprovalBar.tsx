/**
 * ApprovalBar — appears on document form pages that require approval.
 * Shows current status, an Approve button and a Reject button.
 * Launches ApprovalModal on action click.
 */
import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, Send, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useToast } from '../ui/Toast';
import ApprovalModal from './ApprovalModal';

export type DocType = 'MRL' | 'PRL' | 'PO' | 'AP_INVOICE' | 'GRN';
export type DocStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CLOSED' | 'PARTIAL' | 'POSTED';

interface ApprovalBarProps {
  docType: DocType;
  docId: string;
  docNo: string;
  status: DocStatus;
  queryKey: string[];            // react-query key to invalidate after action
  canSubmit?: boolean;           // show "Submit for Approval" button when DRAFT
  canApprove?: boolean;          // show approve/reject when PENDING_APPROVAL
  onStatusChange?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:            { label: 'Draft',            color: 'bg-gray-100 text-gray-600 border-gray-200',   icon: <Clock size={13} /> },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={13} /> },
  APPROVED:         { label: 'Approved',         color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle size={13} /> },
  REJECTED:         { label: 'Rejected',         color: 'bg-red-50 text-red-700 border-red-200',       icon: <XCircle size={13} /> },
  CANCELLED:        { label: 'Cancelled',        color: 'bg-gray-100 text-gray-500 border-gray-200',   icon: <XCircle size={13} /> },
  PARTIAL:          { label: 'Partial',          color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: <Clock size={13} /> },
  POSTED:           { label: 'Posted',           color: 'bg-teal-50 text-teal-700 border-teal-200',    icon: <CheckCircle size={13} /> },
  CLOSED:           { label: 'Closed',           color: 'bg-gray-100 text-gray-500 border-gray-200',   icon: <CheckCircle size={13} /> },
};

export default function ApprovalBar({
  docType, docId, docNo, status, queryKey,
  canSubmit = true, canApprove = true, onStatusChange,
}: ApprovalBarProps) {
  const toast = useToast();
  const qc    = useQueryClient();
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;

  // Submit for approval (DRAFT → PENDING_APPROVAL)
  const submitMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/workflow/approve', {
        docType,
        docId,
        action: 'submit',
      }),
    onSuccess: () => {
      toast.success('Submitted', `${docNo} submitted for approval.`);
      qc.invalidateQueries({ queryKey });
      onStatusChange?.();
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.message ?? 'Failed to submit');
    },
  });

  const handleAction = (action: 'approve' | 'reject', comment?: string) => {
    return apiClient
      .post('/workflow/approve', { docType, docId, action, comment })
      .then(() => {
        toast.success(
          action === 'approve' ? 'Approved' : 'Rejected',
          `${docNo} has been ${action === 'approve' ? 'approved' : 'rejected'}.`
        );
        qc.invalidateQueries({ queryKey });
        onStatusChange?.();
        setModal(null);
      })
      .catch((err: any) => {
        toast.error('Error', err?.response?.data?.message ?? `Failed to ${action}`);
        throw err;
      });
  };

  return (
    <>
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm">
        {/* Status badge */}
        <span className={clsx('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', cfg.color)}>
          {cfg.icon} {cfg.label}
        </span>

        <div className="flex-1" />

        {/* Actions */}
        {status === 'DRAFT' && canSubmit && (
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Submit for Approval
          </button>
        )}

        {status === 'PENDING_APPROVAL' && canApprove && (
          <>
            <button
              onClick={() => setModal('reject')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm rounded hover:bg-red-50"
            >
              <XCircle size={13} /> Reject
            </button>
            <button
              onClick={() => setModal('approve')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              <CheckCircle size={13} /> Approve
            </button>
          </>
        )}
      </div>

      {/* Approval / Rejection modal */}
      {modal && (
        <ApprovalModal
          action={modal}
          docNo={docNo}
          onConfirm={(comment) => handleAction(modal, comment)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
