// Notification wire shape — mirrors the web `AppNotification`
// (nextjs-port/src/shared/hooks/useNotifications.ts). Same backend rows, so the
// mobile hook can hit the identical `notifications/*` endpoints.
export interface AppNotification {
  notification_id: number;
  type: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  url?: string | null;
  batch_id?: number | null;
  buyer_id?: number | null;
  seller_id?: number | null;
  created_at?: string;
  createdAt?: string;
}
