// useLabNotifications — mobile port of the web useNotifications hook
// (nextjs-port/src/shared/hooks/useNotifications.ts), trimmed to what the lab
// header needs. Hits the SAME backend: GET notifications/{userId} and
// PUT notifications/read via the shared greenbidz axios client (baseURL already
// carries /api/v1 + auth + x-platform). Fetches only UNREAD rows (like the web),
// so the list == the unread set; markRead removes rows locally + server-side.
//
// Live-updates like the web: joins the buyer_/seller_ socket rooms and listens
// for `notification` / `notification_created` (the SAME events the web bell uses
// — nextjs-port useNotifications.ts). No push/FCM involved; the backend emits
// straight to the user's room, so the bell badge updates instantly. Also fetches
// on mount / focus as before.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';

import { greenbidz } from '@/api/greenbidzClient';
import { getSiteType } from '@/services/scanner/buildFormData';
import { getLabSocket, joinRooms } from '@/features/lab/messages/socket';
import { useAuth } from '@/stores/authStore';
import { routeForType } from './notificationNav';
import { NotificationToast } from './NotificationToast';
import type { AppNotification } from './notificationTypes';

// Toast dedupe across hook instances (bell + open centre can both be mounted) so
// one inbound notification shows at most one toast. Bounded to avoid unbounded growth.
const toastedIds = new Set<number>();
function rememberToasted(id: number) {
  toastedIds.add(id);
  if (toastedIds.size > 200) toastedIds.clear();
}

/** Best-effort extract of a notification row from a socket payload (shape varies:
 *  the row itself, or `{ notification: row }`). */
function readPayload(payload: unknown): Partial<AppNotification> | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const row = (p.notification ?? p) as Record<string, unknown>;
  if (typeof row !== 'object' || row == null) return null;
  return row as Partial<AppNotification>;
}

export function useLabNotifications() {
  const userId = useAuth((s) => s.profile?.id);
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const siteType = getSiteType();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = items.filter((n) => !n.isRead).length;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Platform-scoped first; if empty, retry without platform (web parity).
      let res = await greenbidz.get(`/notifications/${userId}`, {
        params: { unread: true, platform: siteType },
      });
      let list: AppNotification[] = res?.data?.notifications ?? [];
      if (list.length === 0 && siteType) {
        res = await greenbidz.get(`/notifications/${userId}`, { params: { unread: true } });
        list = res?.data?.notifications ?? [];
      }
      setItems(list);
    } catch {
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [userId, siteType]);

  useEffect(() => {
    if (userId) void fetchNotifications();
  }, [userId, fetchNotifications]);

  // Debounced refetch — a burst of socket events collapses into one GET (the
  // fetch is authoritative for the unread set), mirroring the web's 300ms.
  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchNotifications(), 300);
  }, [fetchNotifications]);

  // Live channel: join the user's rooms + listen for backend-emitted events.
  // No push/FCM — the bell updates the moment the backend creates a notification.
  useEffect(() => {
    if (!userId) return;
    const socket = getLabSocket();

    const join = () => {
      // Dual-role: listen on both rooms; one bell shows all (web parity).
      joinRooms(userId, 'buyer');
      joinRooms(userId, 'seller');
    };

    const onEvent = (payload: unknown) => {
      scheduleRefetch();
      const row = readPayload(payload);
      const id = typeof row?.notification_id === 'number' ? row.notification_id : undefined;
      if (id == null || toastedIds.has(id)) return;
      rememberToasted(id);
      const type = typeof row?.type === 'string' ? row.type : '';
      const route = routeForType(type);
      const toastId = `notif:${id}`;
      toast.custom(
        <NotificationToast
          toastId={toastId}
          title={row?.title || 'New notification'}
          message={row?.message || undefined}
          type={type}
          onView={route ? () => router.push(route as never) : undefined}
        />,
        { id: toastId, duration: 8000 },
      );
    };

    socket.on('connect', join);
    if (socket.connected) join();
    socket.on('notification', onEvent);
    socket.on('notification_created', onEvent);

    return () => {
      socket.off('connect', join);
      socket.off('notification', onEvent);
      socket.off('notification_created', onEvent);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, scheduleRefetch, router]);

  const markRead = useCallback(
    async (ids: number[]) => {
      if (!ids.length) return;
      // Optimistic: drop locally (list is the unread set), then persist.
      setItems((prev) => prev.filter((n) => !ids.includes(n.notification_id)));
      try {
        await greenbidz.put('/notifications/read', { ids, platform: siteType });
      } catch {
        // Non-fatal — a later refetch reconciles.
      }
    },
    [siteType],
  );

  const markAllAsRead = useCallback(async () => {
    const ids = items.filter((n) => !n.isRead).map((n) => n.notification_id);
    if (ids.length) await markRead(ids);
  }, [items, markRead]);

  return {
    items,
    unreadCount,
    badgeLabel,
    loading,
    error,
    open,
    setOpen,
    fetchNotifications,
    markRead,
    markAllAsRead,
  };
}
