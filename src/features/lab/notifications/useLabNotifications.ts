// useLabNotifications — mobile port of the web useNotifications hook
// (nextjs-port/src/shared/hooks/useNotifications.ts), trimmed to what the lab
// header needs. Hits the SAME backend: GET notifications/{userId} and
// PUT notifications/read via the shared greenbidz axios client (baseURL already
// carries /api/v1 + auth + x-platform). Fetches only UNREAD rows (like the web),
// so the list == the unread set; markRead removes rows locally + server-side.
//
// v1 scope: fetch on mount / on open / on screen focus. (The web also live-
// updates via socket + buyer/seller events — a follow-up; not wired here.)
import { useCallback, useEffect, useState } from 'react';

import { greenbidz } from '@/api/greenbidzClient';
import { getSiteType } from '@/services/scanner/buildFormData';
import { useAuth } from '@/stores/authStore';
import type { AppNotification } from './notificationTypes';

export function useLabNotifications() {
  const userId = useAuth((s) => s.profile?.id);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const siteType = getSiteType();

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
