// useConversations — the buyer↔seller Messages inbox hook. REST-loads the
// conversation list (`GET /chat/buyer/:id/sellers`) and keeps it live over the
// shared socket: re-emits `joinRooms` on (re)connect, refetches on
// `new_conversation_buyer`, and bumps ordering on any inbound `chat_message`.
// Mirrors the web `BuyerAllChatList` socket wiring.
//
// It also OWNS three things the screens must not each re-derive: the newest-first
// ordering (the wire order is not guaranteed), the per-row unread count, and
// `totalUnread` (the inbox header and the Chat tab badge must never show
// different numbers).
//
// ── WHERE UNREAD ACTUALLY COMES FROM ───────────────────────────────────────
// NOT from the inbox rows. Node's `getSellerListForBuyer` returns
// `{ ...seller, batch_id, lastMessageAt }` and nothing else, so summing
// `row.unreadCount` was structurally always 0: the Chat tab pill could never
// appear, the row's unread cues were dead code, and the header confidently said
// "All caught up" over a thread the seller had just replied to.
//
// The count that DOES exist is the notification ledger — a seller reply creates a
// `type: 'chat'` row carrying batch_id + seller_id, and opening the thread clears
// exactly those rows (`markConversationRead` → PUT /notifications/read_by_batch).
// So this hook joins the two: rows from the inbox, counts from
// `fetchChatUnreadCounts`, merged per conversation. `row.unreadCount` still wins
// when a deploy ever does send it, so the backend can take the job back without
// a client change.
//
// `unreadResolved` is exported so screens can tell "zero unread" from "we do not
// know yet" — the header may only claim "All caught up" in the first case.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/stores/authStore';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { getLabSocket, joinRooms } from './socket';
import { isBlocked, subscribeBlocked } from './blockList';
import {
  conversationUnreadKey,
  fetchChatUnreadCounts,
  listBuyerConversations,
  MOBILE_CHAT_ROLE,
  type ChatRole,
  type ConversationRow,
} from './chatApi';

export interface UseConversationsResult {
  /** Visible rows, blocked users removed, NEWEST FIRST (see `recencyOf`), each
   *  carrying a resolved `unreadCount`. */
  conversations: ConversationRow[];
  /**
   * Unread messages across every VISIBLE conversation. Exposed from the hook
   * (rather than recomputed per screen) so the inbox header and the Chat tab
   * badge read the exact same number from the exact same cache entry — two
   * independent sums would eventually disagree.
   */
  totalUnread: number;
  /** True once the unread source has actually answered. `totalUnread === 0`
   *  means "nothing unread" only while this is true; otherwise it means
   *  "not known yet" and no screen may claim the buyer is caught up. */
  unreadResolved: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
  isEmpty: boolean;
  /** Resolves when BOTH reads have settled, so a pull-to-refresh spinner can be
   *  driven by the user's own gesture instead of by any background fetch. */
  refetch: () => Promise<void>;
}

/**
 * Sort key for inbox ordering: `lastMessageAt` as epoch ms.
 *
 * Missing / unparseable dates return -Infinity so those rows sort LAST instead
 * of being treated as "now" and jumping to the top. Callers must compare for
 * equality first — `-Infinity - -Infinity` is NaN, and a NaN comparator result
 * leaves the order implementation-defined.
 */
function recencyOf(row: ConversationRow): number {
  const raw = row.lastMessageAt;
  if (!raw) return Number.NEGATIVE_INFINITY;
  const ts = Date.parse(String(raw));
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
}

/**
 * A row we can actually open.
 *
 * The backend builds each row by spreading `sellerMap[c.seller_id]`, which is
 * `undefined` when the counterparty's user row is gone (deleted account — a real
 * orphan path here). That row arrives with NO `ID`: it crashed the avatar
 * gradient (`Math.abs(undefined + batch) % 5` → `AVATAR_GRADIENTS[NaN]` →
 * spreading undefined), collided in `keyExtractor`, and routed the thread to
 * `sellerId: "undefined"`. There is no counterparty to message, so it is not a
 * conversation — drop it here rather than rendering a row that can only fail.
 */
function isOpenable(row: ConversationRow): boolean {
  return Number.isFinite(Number(row?.ID)) && Number(row?.ID) > 0;
}

export function useConversations(): UseConversationsResult {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id;
  // Always 'buyer' — see MOBILE_CHAT_ROLE. Deriving this from profile.role
  // sent sender_role:'seller' for seller accounts and the server dropped
  // the message.
  const role: ChatRole = MOBILE_CHAT_ROLE;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: labKeys.conversations(),
    queryFn: () => listBuyerConversations(userId as number),
    enabled: userId != null,
  });

  // Unread lives on its own key so the badge and the inbox share ONE fetch of
  // it, and so a failing notification read can never blank the conversation list.
  const unreadQuery = useQuery({
    queryKey: labKeys.chatUnread(),
    queryFn: () => fetchChatUnreadCounts(userId as number),
    enabled: userId != null,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (userId == null) return;
    const s = getLabSocket();
    // Identify now + on every (re)connect so the server keeps routing our rooms.
    joinRooms(userId, role);
    const onConnect = () => joinRooms(userId, role);
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: labKeys.conversations() });
      void qc.invalidateQueries({ queryKey: labKeys.chatUnread() });
    };
    s.on('connect', onConnect);
    s.on('new_conversation_buyer', refresh);
    s.on('new_conversation_seller', refresh);
    s.on('chat_message', refresh); // bump last-message ordering / unread
    // The read/unread ledger moves on `notification` too (a seller reply creates
    // one; read_by_batch emits one back), so the badge must follow it.
    s.on('notification', refresh);
    return () => {
      s.off('connect', onConnect);
      s.off('new_conversation_buyer', refresh);
      s.off('new_conversation_seller', refresh);
      s.off('chat_message', refresh);
      s.off('notification', refresh);
    };
  }, [userId, role, qc]);

  // Guideline 1.2: a blocked user must disappear from the inbox, not merely be
  // unable to message. Re-runs when the persisted block list changes.
  const [blockedTick, setBlockedTick] = useState(0);
  useEffect(() => subscribeBlocked(() => setBlockedTick((n) => n + 1)), []);
  const rows = query.data ?? [];
  const unread = unreadQuery.data;
  const conversations = useMemo(
    () =>
      // `.filter` already returns a fresh array, so sorting it in place cannot
      // mutate the React Query cache entry. Ordering is DEFENSIVE: the server
      // has returned rows in insertion order on some deploys, which put a
      // months-old thread above a message that arrived a minute ago.
      rows
        .filter((r) => isOpenable(r) && !isBlocked(r.ID))
        .map((r) => {
          const own = Number(r.unreadCount);
          const resolved = Number.isFinite(own)
            ? Math.max(0, own)
            : (unread?.byConversation[conversationUnreadKey(r.batch_id, r.ID)] ?? 0);
          // Same object shape as the wire row + a resolved count, so the row
          // component keeps reading one field and does not learn where it came from.
          return resolved === r.unreadCount ? r : { ...r, unreadCount: resolved };
        })
        .sort((a, b) => {
          const at = recencyOf(a);
          const bt = recencyOf(b);
          return at === bt ? 0 : bt - at; // equality first — see recencyOf
        }),
    [rows, unread, blockedTick],
  );
  const totalUnread = useMemo(
    () => conversations.reduce((sum, r) => sum + Math.max(0, Number(r.unreadCount) || 0), 0),
    [conversations],
  );
  // Stable identity: this is handed to RefreshControl.onRefresh and to error
  // recovery actions, so a fresh closure per render defeats every memo downstream.
  const refetch = useCallback(async () => {
    await Promise.all([query.refetch(), unreadQuery.refetch()]);
  }, [query.refetch, unreadQuery.refetch]);
  return {
    conversations,
    totalUnread,
    unreadResolved: unreadQuery.isSuccess,
    isLoading: query.isLoading && userId != null,
    isRefetching: query.isRefetching,
    isError: query.isError,
    isEmpty: query.isSuccess && conversations.length === 0,
    refetch,
  };
}
