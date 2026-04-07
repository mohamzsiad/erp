import React from 'react';
import {
  Save,
  Send,
  CheckCircle,
  XCircle,
  Printer,
  RotateCcw,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface ToolbarAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
}

interface DocumentToolbarProps {
  title?: string;
  docNo?: string;
  status?: React.ReactNode;
  actions?: ToolbarAction[];
  /** Shorthand prop: show a Save button */
  onSave?: () => void;
  /** Shorthand prop: show a Submit button */
  onSubmit?: () => void;
  /** Shorthand prop: show an Approve button */
  onApprove?: () => void;
  /** Shorthand prop: show a Reject button */
  onReject?: () => void;
  /** Shorthand prop: show a Print button */
  onPrint?: () => void;
  /** Shorthand prop: show a New button */
  onNew?: () => void;
  /** Shorthand prop: show a Delete button */
  onDelete?: () => void;
  /** Shorthand prop: show a Reset/Cancel button */
  onReset?: () => void;
  saving?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: 'toolbar-btn bg-[#1F4E79] text-white hover:bg-[#163D5F]',
  secondary: 'toolbar-btn',
  danger: 'toolbar-btn text-red-600 hover:bg-red-50',
  success: 'toolbar-btn text-green-600 hover:bg-green-50',
};

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  title,
  docNo,
  status,
  actions,
  onSave,
  onSubmit,
  onApprove,
  onReject,
  onPrint,
  onNew,
  onDelete,
  onReset,
  saving,
  className,
}) => {
  const shorthandActions: ToolbarAction[] = [
    onNew && { id: 'new', label: 'New', icon: <Plus size={14} />, onClick: onNew, variant: 'secondary' },
    onSave && {
      id: 'save',
      label: saving ? 'Saving…' : 'Save',
      icon: saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />,
      onClick: onSave,
      variant: 'primary',
      disabled: saving,
    },
    onSubmit && { id: 'submit', label: 'Submit', icon: <Send size={14} />, onClick: onSubmit, variant: 'primary' },
    onApprove && { id: 'approve', label: 'Approve', icon: <CheckCircle size={14} />, onClick: onApprove, variant: 'success' },
    onReject && { id: 'reject', label: 'Reject', icon: <XCircle size={14} />, onClick: onReject, variant: 'danger' },
    onPrint && { id: 'print', label: 'Print', icon: <Printer size={14} />, onClick: onPrint, variant: 'secondary' },
    onReset && { id: 'reset', label: 'Reset', icon: <RotateCcw size={14} />, onClick: onReset, variant: 'secondary' },
    onDelete && { id: 'delete', label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, variant: 'danger' },
  ].filter(Boolean) as ToolbarAction[];

  const allActions = [...shorthandActions, ...(actions ?? [])].filter((a) => !a.hidden);

  return (
    <div className={clsx('flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200', className)}>
      {/* Document info */}
      <div className="flex items-center gap-2 mr-2">
        {title && <span className="text-sm font-semibold text-gray-700">{title}</span>}
        {docNo && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{docNo}</span>
        )}
        {status}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {allActions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              VARIANT_CLASSES[action.variant ?? 'secondary']
            )}
          >
            {action.loading ? <Loader2 size={13} className="animate-spin" /> : action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
