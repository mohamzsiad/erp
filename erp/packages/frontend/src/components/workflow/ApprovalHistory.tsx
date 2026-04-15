/**
 * ApprovalHistory — shows the approval trail for a document.
 * Renders a vertical timeline of approval steps.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import apiClient from '../../api/client';
import type { DocType } from './ApprovalBar';

interface ApprovalStep {
  stepOrder: number;
  status: string;
  approverName: string;
  comment?: string;
  actionAt?: string;
}

interface ApprovalHistoryProps {
  docType: DocType;
  docId: string;
  defaultOpen?: boolean;
}

const STEP_ICON: Record<string, React.ReactNode> = {
  APPROVED: <CheckCircle size={14} className="text-green-600" />,
  REJECTED: <XCircle    size={14} className="text-red-600" />,
  PENDING:  <Clock      size={14} className="text-amber-500" />,
  SKIPPED:  <Clock      size={14} className="text-gray-400" />,
};

const STEP_COLOR: Record<string, string> = {
  APPROVED: 'border-green-400 bg-green-50',
  REJECTED: 'border-red-400 bg-red-50',
  PENDING:  'border-amber-300 bg-amber-50',
  SKIPPED:  'border-gray-200 bg-gray-50',
};

export default function ApprovalHistory({ docType, docId, defaultOpen = false }: ApprovalHistoryProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  const { data, isFetching } = useQuery<{ steps: ApprovalStep[]; currentStep: number; finalStatus: string }>({
    queryKey: ['approval-history', docType, docId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/workflow/status/${docType}/${docId}`);
      return data;
    },
    enabled: open,
  });

  const steps = data?.steps ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>Approval History</span>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {isFetching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          ) : steps.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No approval history</p>
          ) : (
            <ol className="relative ml-2 mt-4 border-l-2 border-gray-200 space-y-4">
              {steps.map((step) => (
                <li key={step.stepOrder} className="ml-4">
                  <div className={clsx(
                    'absolute -left-[9px] w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white',
                    step.status === 'APPROVED' ? 'border-green-500' :
                    step.status === 'REJECTED' ? 'border-red-500' :
                    step.status === 'PENDING'  ? 'border-amber-400' : 'border-gray-300'
                  )}>
                    <div className={clsx(
                      'w-2 h-2 rounded-full',
                      step.status === 'APPROVED' ? 'bg-green-500' :
                      step.status === 'REJECTED' ? 'bg-red-500' :
                      step.status === 'PENDING'  ? 'bg-amber-400' : 'bg-gray-300'
                    )} />
                  </div>
                  <div className={clsx('rounded-lg border px-3 py-2', STEP_COLOR[step.status] ?? 'border-gray-200 bg-white')}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {STEP_ICON[step.status]}
                        <span className="text-xs font-semibold text-gray-700">Step {step.stepOrder}: {step.approverName}</span>
                      </div>
                      {step.actionAt && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {format(new Date(step.actionAt), 'dd MMM yyyy HH:mm')}
                        </span>
                      )}
                    </div>
                    {step.comment && (
                      <p className="text-xs text-gray-600 mt-1 pl-5 italic">"{step.comment}"</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
