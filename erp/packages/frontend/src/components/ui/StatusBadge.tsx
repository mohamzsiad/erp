import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'open'
  | 'partial'
  | 'closed'
  | 'cancelled'
  | 'active'
  | 'inactive'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  draft: 'badge-draft',
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  open: 'badge-open',
  partial: 'badge-partial',
  closed: 'badge-closed',
  cancelled: 'badge-cancelled',
  active: 'badge-active',
  inactive: 'badge-inactive',
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-green-100 text-green-700',
  danger: 'bg-red-100 text-red-700',
};

const STATUS_MAP: Record<string, BadgeVariant> = {
  DRAFT: 'draft',
  SUBMITTED: 'pending',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  OPEN: 'open',
  PARTIAL: 'partial',
  RECEIVED: 'approved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  POSTED: 'approved',
  VOIDED: 'cancelled',
  PAID: 'closed',
  UNPAID: 'open',
};

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant, label, className }) => {
  const resolvedVariant = variant ?? STATUS_MAP[status.toUpperCase()] ?? 'info';
  const display = label ?? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        VARIANT_CLASSES[resolvedVariant],
        className
      )}
    >
      {display}
    </span>
  );
};
