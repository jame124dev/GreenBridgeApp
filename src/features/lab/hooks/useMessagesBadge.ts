// useMessagesBadge — the LIVE count behind the Chat tab's pill.
//
// Replaces `badgeCounts.deals = 0` in FrostedTabBar: the bar hardcoded a zero
// with a comment saying there was no live source, so a buyer with three unread
// seller replies saw a completely quiet tab bar.
//
// Definition: unread messages summed across the buyer's VISIBLE conversations.
// "Visible" matters — `useConversations` drops blocked users (Guideline 1.2), so
// a blocked seller can no longer nag from the tab bar either.
//
// WHERE THE NUMBER COMES FROM: not from the inbox rows. `GET /chat/buyer/:id/
// sellers` has no unread field on any deploy, so the first version of this hook —
// summing `row.unreadCount` — was structurally always 0 and the pill could never
// appear. `useConversations` now resolves each row's count from the unread
// `type: 'chat'` notification ledger (the same rows the thread clears when it
// opens) and this hook reads that. See useConversations' header for the join.
//
// Cost: no second sum and no per-consumer fetch. It calls the same
// `useConversations()` the inbox screen calls, and React Query dedupes both of
// its queries by key — whichever surface mounts first fills the cache entries and
// the other reads them. Because the tab bar mounts with the (tabs) group, the
// count is right on a cold start instead of only after the user has opened Chat
// once, and the hook's socket wiring keeps it live while the buyer is on Home.
import { useConversations } from '@/features/lab/messages/useConversations';

/**
 * Unread-message count for the signed-in buyer.
 *
 * Returns `0` while loading, when signed out (the underlying query is
 * `enabled: userId != null`, so nothing fetches and there are no rows) and on
 * error — and `TabBadge` renders nothing at `0`, so the pill simply never
 * appears rather than flashing a placeholder or a meaningless "0".
 */
export function useUnreadMessagesCount(): number {
  return useConversations().totalUnread;
}
