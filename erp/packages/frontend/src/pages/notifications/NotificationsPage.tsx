import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';
import { useNotifications, useMarkRead, useMarkAllRead } from '../../api/notifications';

const NOTIF_ICONS: Record<string, string> = {
  APPROVAL_REQUIRED: '🔔',
  APPROVED: '✅',
  REJECTED: '❌',
  OVERDUE_PAYMENT: '⚠️',
  LOW_STOCK: '📦',
  INFO: 'ℹ️',
};

const TYPE_LABELS: Record<string, string> = {
  APPROVAL_REQUIRED: 'Approval Required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OVERDUE_PAYMENT: 'Overdue Payment',
  LOW_STOCK: 'Low Stock',
  INFO: 'Info',
};

const TYPE_COLORS: Record<string, string> = {
  APPROVAL_REQUIRED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  OVERDUE_PAYMENT: 'bg-orange-100 text-orange-800',
  LOW_STOCK: 'bg-purple-100 text-purple-800',
  INFO: 'bg-blue-100 text-blue-800',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('all');

  const { data, isFetching, refetch } = useNotifications(page, 20);
  const markRead    = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const pagination    = data?.pagination;

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications.filter(n => n.type === filter);

  const handleClick = (n: any) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.docType && n.docId) {
      const paths: Record<string, string> = {
        MRL: `/procurement/mrl/${n.docId}`,
        PRL: `/procurement/prl/${n.docId}`,
        PO:  `/procurement/po/${n.docId}`,
        AP_INVOICE: `/finance/ap/invoices/${n.docId}`,
        GRN: `/inventory/grn/${n.docId}`,
      };
      if (paths[n.docType]) navigate(paths[n.docType]);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79] flex items-center gap-2">
            <Bell size={22} /> Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            {isFetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-gray-400 shrink-0" />
        {['all', 'unread', 'APPROVAL_REQUIRED', 'APPROVED', 'REJECTED', 'OVERDUE_PAYMENT', 'LOW_STOCK'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              filter === f
                ? 'bg-[#1F4E79] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : (TYPE_LABELS[f] ?? f)}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {isFetching && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
            <Bell size={32} />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={clsx(
                'w-full text-left bg-white border rounded-lg px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all',
                n.isRead ? 'border-gray-200' : 'border-blue-200 bg-blue-50/40'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={clsx('text-sm text-gray-900 truncate', !n.isRead && 'font-semibold')}>
                        {n.title}
                      </p>
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-600')}>
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                      <span className="text-xs text-gray-400">
                        {format(new Date(n.createdAt), 'dd MMM HH:mm')}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
