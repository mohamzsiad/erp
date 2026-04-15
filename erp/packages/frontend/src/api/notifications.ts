import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { useAuthStore } from '../store/authStore';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  docType?: string;
  docId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ── Queries ────────────────────────────────────────────────────────────────

export function useNotifications(page = 1, limit = 20) {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications', { params: { page, limit } });
      return data;
    },
    refetchInterval: 60_000, // poll every minute as fallback
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/unread-count');
      return data;
    },
    refetchInterval: 30_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.put(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.put('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ── WebSocket hook ─────────────────────────────────────────────────────────

export function useNotificationSocket(onMessage: (msg: any) => void) {
  const token = useAuthStore.getState().accessToken;

  const connect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/notifications/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Authenticate by sending token (if needed) or just stay connected
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          onMessage(data);
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        // Reconnect after 5s
        setTimeout(connect, 5000);
      };

      // Keep alive ping every 30s
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      ws.onerror = () => {
        clearInterval(pingInterval);
      };

      return () => {
        clearInterval(pingInterval);
        ws.close();
      };
    } catch {
      return () => {};
    }
  };

  return connect;
}
