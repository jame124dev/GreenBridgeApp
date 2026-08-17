// chatApi.ts — buyer↔seller Messages data layer: REST reads over the shared
// `greenbidz` axios client (baseURL already includes `/api/v1`, auth + x-platform
// attached by the interceptor) + socket emitters over the shared chat socket.
// 1:1 with the web `101lab-2/src/pages/chat/BuyerAllChatList.tsx` calls so the
// two clients can't drift.
//
//   REST  GET  /chat/buyer/:buyerId/sellers            → inbox (conversation list)
//   REST  GET  /chat/conversation/:id/messages         → thread (paginated)
//   REST  GET  /notifications/:userId?unread=true       → per-conversation unread
//   REST  PUT  /notifications/read_by_batch             → mark a thread read
//   SOCK  emit joinChat        → ack { conversation_id } (open/create a conversation)
//   SOCK  emit chat_message    → send (server echoes back via the `chat_message` event)
//   SOCK  emit notification_read
import { greenbidz } from '@/api/greenbidzClient';
import { getExpoExtra } from '@/lib/env';
import { getLabSocket } from './socket';

/** Marketplace scope — mirrors the web `platform=SITE_TYPE` query param + the
 *  greenbidz client's `x-platform` header (both are the same value). */
const PLATFORM = (getExpoExtra().SITE_TYPE as string | undefined) ?? 'LabGreenbidz';

export type ChatRole = 'buyer' | 'seller';

/* ── Wire shapes (loose — Node varies across deploys; read defensively) ────── */

/** A conversation row in the buyer inbox (`sellerList.data[i]`). */
export interface ConversationRow {
  /** The counterparty (seller) user id. */
  ID: number;
  batch_id: number;
  display_name?: string | null;
  user_email?: string | null;
  /** Listing title, when the backend joins it in. */
  batch_title?: string | null;
  product_name?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
  [k: string]: unknown;
}

/** A single chat message (`messages[i]`). */
export interface ChatMessageRow {
  message_id?: number | string;
  conversation_id?: number | string;
  batch_id?: number | string;
  message?: string | null;
  text?: string | null;
  sender_id?: number | string;
  receiver_id?: number | string;
  sender_role?: string;
  sender_name?: string | null;
  created_at?: string | null;
}

export interface MessagesPage {
  messages: ChatMessageRow[];
  hasMore: boolean;
}

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ── REST reads ────────────────────────────────────────────────────────────── */

/** Resolve a listing's seller (user id + display name) from its batch id.
 *  Used when a "Contact seller" entry point (WTB matches / wants) knows the
 *  batch but NOT the seller — the WTB match snapshot doesn't carry seller_id, so
 *  we look it up here rather than opening the Messages inbox as a fallback. The
 *  batch endpoint returns `data.batch.seller_id` + `data.sellerData`. */
export async function fetchBatchSeller(
  batchId: number,
): Promise<{ sellerId: number | null; sellerName: string | null }> {
  const res = await greenbidz.get(`/batch/${batchId}/products`, {
    params: { platform: PLATFORM, marketplace: 'all' },
    timeout: 30_000,
  });
  const data = (res.data?.data ?? {}) as Record<string, unknown>;
  const batch = (data.batch ?? {}) as Record<string, unknown>;
  const sellerData = (data.sellerData ?? {}) as Record<string, unknown>;
  const rawId = batch.seller_id ?? sellerData.ID ?? sellerData.id;
  const sellerId = rawId != null && Number.isFinite(Number(rawId)) ? Number(rawId) : null;
  const name =
    (sellerData.display_name as string) ||
    (sellerData.user_nicename as string) ||
    (sellerData.user_login as string) ||
    null;
  return { sellerId, sellerName: name };
}

/** The buyer's inbox: every seller they have a conversation with (per batch). */
export async function listBuyerConversations(buyerId: number | string): Promise<ConversationRow[]> {
  const res = await greenbidz.get(`/chat/buyer/${buyerId}/sellers`, { params: { platform: PLATFORM } });
  return asArray<ConversationRow>(res.data?.sellerList?.data);
}

/* ── Unread counts ─────────────────────────────────────────────────────────── */

/**
 * Per-conversation unread counts, keyed by `${batchId}:${sellerId}`.
 *
 * WHY THIS EXISTS: the inbox endpoint does NOT carry unread counts. Node's
 * `getSellerListForBuyer` builds each row as
 * `{ ...sellerMap[c.seller_id], batch_id, lastMessageAt }` — there is no
 * `unreadCount` field on any deploy, so anything summing `row.unreadCount` is
 * structurally always 0 (a tab badge that can never appear, and an "All caught
 * up" line the app cannot substantiate).
 *
 * The count that DOES exist is the notification ledger: when a seller replies,
 * Node creates a `type: 'chat'` notification for the buyer carrying `batch_id` +
 * `seller_id` (socket/socket.js `sendNotification`), and the thread's own
 * `markConversationRead` → `PUT /notifications/read_by_batch` clears exactly
 * those rows for that (batch, seller). So "unread chat notifications grouped by
 * (batch, seller)" IS the per-conversation unread count, already maintained by
 * the same read/unread lifecycle the thread drives.
 */
export interface ChatUnreadCounts {
  total: number;
  byConversation: Record<string, number>;
}

/** The grouping key for `ChatUnreadCounts.byConversation`. */
export function conversationUnreadKey(
  batchId: number | string | null | undefined,
  sellerId: number | string | null | undefined,
): string {
  return `${batchId ?? ''}:${sellerId ?? ''}`;
}

interface UnreadNotificationRow {
  type?: string | null;
  batch_id?: number | string | null;
  seller_id?: number | string | null;
  isRead?: boolean;
}

/** Unread buyer↔seller chat notifications for this user, grouped per conversation.
 *  Platform-scoped first, then unscoped if that comes back empty — the same
 *  two-step the notification bell uses (older rows predate `platform`). */
export async function fetchChatUnreadCounts(userId: number | string): Promise<ChatUnreadCounts> {
  const read = async (params: Record<string, unknown>) => {
    const res = await greenbidz.get(`/notifications/${userId}`, { params });
    return asArray<UnreadNotificationRow>(res.data?.notifications);
  };
  let rows = await read({ unread: true, platform: PLATFORM });
  if (rows.length === 0) rows = await read({ unread: true });

  const byConversation: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    // `type` is 'chat' for a seller→buyer message. 'Admin Chat' rows belong to
    // the admin user id, never to a buyer, but exclude them by name anyway.
    if ((row.type ?? '').toString().trim().toLowerCase() !== 'chat') continue;
    if (row.isRead === true) continue;
    if (row.batch_id == null || row.seller_id == null) continue;
    const key = conversationUnreadKey(row.batch_id, row.seller_id);
    byConversation[key] = (byConversation[key] ?? 0) + 1;
    total += 1;
  }
  return { total, byConversation };
}

/** One conversation's messages, newest-last. `beforeMessageId` pages older. */
export async function getConversationMessages(
  conversationId: number | string,
  opts?: { limit?: number; beforeMessageId?: number | string },
): Promise<MessagesPage> {
  const res = await greenbidz.get(`/chat/conversation/${conversationId}/messages`, {
    params: {
      platform: PLATFORM,
      limit: opts?.limit ?? 20,
      ...(opts?.beforeMessageId != null ? { beforeMessageId: opts.beforeMessageId } : {}),
    },
  });
  return {
    messages: asArray<ChatMessageRow>(res.data?.messages),
    hasMore: Boolean(res.data?.hasMore),
  };
}

/** Mark a thread's notifications read (fires the socket read event too). */
export async function markConversationRead(args: {
  batchId: number;
  buyerId: number | string;
  sellerId: number;
  role: ChatRole;
}): Promise<void> {
  const { batchId, buyerId, sellerId, role } = args;
  try {
    await greenbidz.put('/notifications/read_by_batch', {
      batchId,
      buyerId: Number(buyerId),
      sellerId,
      role,
      platform: PLATFORM,
    });
    getLabSocket().emit('notification_read', { sellerId, buyerId: Number(buyerId), batchId });
  } catch {
    /* non-fatal — the thread still opens */
  }
}

/* ── Socket emitters ───────────────────────────────────────────────────────── */

/** Open (or create) the conversation for (user, other-party, batch). Resolves the
 *  server `conversation_id` via the ack callback. Mirrors the web `joinChat`. */
/**
 * The role this app occupies in every Messages conversation: BUYER.
 *
 * Do NOT derive this from `profile.role`. The only inbox endpoint that exists is
 * `GET /chat/buyer/:id/sellers`, so every conversation reachable from the Chat
 * tab is one where this user is the buyer — by construction. Deriving the role
 * from the profile instead sent `sender_role: 'seller'` for any account that is
 * an approved seller (the common case: this app's home screen is "What are you
 * selling?"). The server uses `sender_role` to decide which side of the
 * conversation to write, so the emit was accepted and then dropped: the composer
 * cleared, no bubble appeared, and reopening the thread showed nothing. That was
 * the "send message doesn't work" report, verified on device.
 *
 * If a seller-side inbox is ever added it must pass its own role explicitly
 * rather than reintroducing a profile-derived guess.
 */
export const MOBILE_CHAT_ROLE: ChatRole = 'buyer';

export const JOIN_CHAT_TIMEOUT_MS = 12_000;

export function openConversation(args: {
  batchId: number;
  userId: number | string;
  role: ChatRole;
  otherPartyId: number;
}): Promise<string> {
  const { batchId, userId, role, otherPartyId } = args;
  const socket = getLabSocket();
  // Identify before joining. `joinRooms` is otherwise only emitted by
  // useConversations / the notifications hook, so opening a thread without the
  // inbox mounted could leave the socket connected but anonymous.
  socket.emit('joinRooms', { user_id: String(userId), role });
  return new Promise((resolve, reject) => {
    // MUST be `.timeout(...)`. A bare `emit` with an ack callback and no timeout
    // NEVER settles when the socket is down: socket.io silently buffers the
    // event and the callback is simply never invoked. That left the thread stuck
    // on its loading spinner with a permanently disabled composer and no error
    // — the "send does nothing" report. A rejection here surfaces the real error
    // state, which has a Retry.
    socket.timeout(JOIN_CHAT_TIMEOUT_MS).emit(
      'joinChat',
      {
        batch_id: `batch-${batchId}`,
        user_id: String(userId),
        role,
        other_party_id: otherPartyId,
        platform: PLATFORM,
      },
      (
        timeoutErr: Error | null,
        res: { conversation_id?: string; error?: string } | undefined,
      ) => {
        if (timeoutErr) {
          reject(new Error('joinChat timed out — chat server unreachable'));
          return;
        }
        if (!res || res.error || res.conversation_id == null) {
          reject(new Error(res?.error ?? 'joinChat failed'));
          return;
        }
        resolve(String(res.conversation_id));
      },
    );
  });
}

/**
 * Send a message on an open conversation. The server echoes it back on the
 * `chat_message` event (so the sender's thread reconciles the optimistic bubble).
 *
 * Returns `false` when the socket is NOT connected and nothing was emitted.
 * Callers must honour that: socket.io buffers a non-volatile emit made while
 * disconnected and flushes it on the next connect with no expiry, which produced
 * a bubble that failed, then a delivery 90 seconds later, then the same message
 * on screen twice. The outbox in `useChatThread` owns the queue instead, so
 * "when to send" is a decision this app makes and can reconcile.
 *
 * `client_msg_id` is FORWARD-COMPAT ONLY: today's Node handler builds its echo
 * from `savedMessage.toJSON()` and does not reflect unknown fields back, so
 * reconciliation cannot key on it yet (see useChatThread's server-truth
 * reconcile). Once the backend echoes it, claiming an echo becomes exact.
 */
export function sendChatMessage(args: {
  conversationId: string | number;
  batchId: number;
  senderId: number | string;
  receiverId: number;
  senderRole: ChatRole;
  message: string;
  clientMsgId?: string;
}): boolean {
  const { conversationId, batchId, senderId, receiverId, senderRole, message, clientMsgId } = args;
  const socket = getLabSocket();
  if (!socket.connected) return false;
  socket.emit('chat_message', {
    conversation_id: conversationId,
    batch_id: `batch-${batchId}`,
    sender_id: String(senderId),
    receiver_id: receiverId,
    sender_role: senderRole,
    message,
    platform: PLATFORM,
    ...(clientMsgId ? { client_msg_id: clientMsgId } : {}),
  });
  return true;
}
