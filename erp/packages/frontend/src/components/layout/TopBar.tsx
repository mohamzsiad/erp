import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, ChevronDown, LogOut, User, CheckCheck } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import {
  useUnreadCount,
  useNotifications,
  useMarkAllRead,
  useMarkRead,
  useNotificationSocket,
} from '../../api/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';

const NOTIF_ICONS: Record<string, string> = {
  APPROVAL_REQUIRED: '🔔',
  APPROVED: '✅',
  REJECTED: '❌',
  OVERDUE_PAYMENT: '⚠️',
  LOW_STOCK: '📦',
  INFO: 'ℹ️',
};

const TopBar: React.FC = () => {
  const toggleSidebar    = useUiStore((s) => s.toggleSidebar);
  const closeAllTabs     = useUiStore((s) => s.closeAllTabs);
  const user             = useAuthStore((s) => s.user);
  const clearAuth        = useAuthStore((s) => s.clearAuth);
  const navigate         = useNavigate();
  const qc               = useQueryClient();

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [bellOpen,  setBellOpen]  = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Data
  const { data: unreadData } = useUnreadCount();
  const { data: notifData }  = useNotifications(1, 10);
  const markRead    = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notifData?.notifications ?? [];

  // WebSocket for real-time push
  const connectWs = useNotificationSocket((msg) => {
    if (msg.type === 'notification' || msg.type === 'unread_count') {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  useEffect(() => {
    const cleanup = connectWs();
    return cleanup;
  }, []); // eslint-disable-line

  // Close bell dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    closeAllTabs();
    navigate('/login', { replace: true });
  };

  const handleNotifClick = (n: any) => {
    if (!n.isRead) markRead.mutate(n.id);
    setBellOpen(false);
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

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-3 shrink-0 z-10">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <span className="text-gray-700 font-semibold text-sm hidden sm:block">CloudERP</span>

      <div className="flex-1" />

      {/* Notification Bell */}
      <div ref={bellRef} className="relative">
        <button
          onClick={() => setBellOpen((v) => !v)}
          className="relative p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {bellOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-30 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-sm font-semibold text-gray-800">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                    >
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => { setBellOpen(false); navigate('/notifications'); }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    See all
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={clsx(
                        'w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                        !n.isRead && 'bg-blue-50/50'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0 mt-0.5">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className={clsx('text-xs font-medium text-gray-800 truncate', !n.isRead && 'font-semibold')}>
                              {n.title}
                            </p>
                            {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-[#1F4E79] flex items-center justify-center text-white text-xs font-bold uppercase">
            {user?.firstName?.charAt(0) ?? 'U'}
          </div>
          <span className="text-sm text-gray-700 hidden sm:block max-w-[120px] truncate">
            {user ? `${user.firstName} ${user.lastName}` : 'User'}
          </span>
          <ChevronDown size={13} className="text-gray-400" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {user ? `${user.firstName} ${user.lastName}` : ''}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => { setMenuOpen(false); navigate('/notifications'); }}
              >
                <Bell size={14} />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => { setMenuOpen(false); }}
              >
                <User size={14} />
                Profile
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => { setMenuOpen(false); handleLogout(); }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default TopBar;
