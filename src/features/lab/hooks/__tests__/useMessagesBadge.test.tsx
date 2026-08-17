/**
 * The Chat tab rendered `badgeCounts.deals = 0` with a comment claiming there was
 * no live source, so a buyer with unread seller replies saw a completely quiet
 * tab bar. These lock in the properties that made the fix worth doing, none of
 * which had any test cover on the Messages surface:
 *
 *   1. the count is the signed-in buyer's own unread total (0 when signed out),
 *   2. it is derived from a source the SERVER ACTUALLY SENDS. The first version
 *      summed `row.unreadCount` from `GET /chat/buyer/:id/sellers`, a field that
 *      endpoint has never returned (it builds each row as
 *      `{ ...seller, batch_id, lastMessageAt }`), so the badge was structurally
 *      always 0 — and the tests passed only because they mocked a wire shape the
 *      server does not produce. `inbox payload shape` below uses the REAL row
 *      shape and asserts the count still lands, via the unread notification
 *      ledger; `unreadResolved` guards the header's "All caught up" claim,
 *      3. a BLOCKED seller cannot nag from the tab bar (Guideline 1.2 parity with
 *      the inbox, which hides them), and an orphaned row (deleted counterparty,
 *      no `ID`) never reaches the list at all — it used to crash the whole tab,
 *   4. the badge and the inbox share ONE React Query cache entry per query — the
 *      badge must not double-fetch the inbox on every tab.
 *
 * Plus the inbox ORDERING contract: newest first regardless of server order,
 * with missing/unparseable dates sorted last instead of crashing or floating to
 * the top as if they had just arrived.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// MMKV is a Nitro native module and cannot load under Jest (authStore + the
// block list both import it).
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, unknown>();
  return {
    mmkv: {
      set: (k: string, v: unknown) => store.set(k, v),
      getString: (k: string) => store.get(k) as string | undefined,
      getBoolean: (k: string) => store.get(k) as boolean | undefined,
      getNumber: (k: string) => store.get(k) as number | undefined,
      remove: (k: string) => store.delete(k),
    },
  };
});

// The shared chat socket opens a real socket.io connection; stub exactly the
// surface useConversations touches. (socket.ts itself is covered by its own
// suite — do not reshape it from here.)
jest.mock('@/features/lab/messages/socket', () => {
  const socket = { connected: true, on: jest.fn(), off: jest.fn(), emit: jest.fn() };
  return { getLabSocket: () => socket, joinRooms: jest.fn(), useSocketConnected: () => true };
});

jest.mock('@/features/lab/messages/chatApi', () => ({
  listBuyerConversations: jest.fn(),
  fetchChatUnreadCounts: jest.fn(),
  conversationUnreadKey: (batchId: unknown, sellerId: unknown) => `${batchId ?? ''}:${sellerId ?? ''}`,
  MOBILE_CHAT_ROLE: 'buyer',
}));

import {
  fetchChatUnreadCounts,
  listBuyerConversations,
  type ConversationRow,
} from '@/features/lab/messages/chatApi';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { mmkv } from '@/lib/mmkv';
import { useAuth } from '@/stores/authStore';
import { __resetBlockCache, blockUser } from '@/features/lab/messages/blockList';
import { useConversations } from '@/features/lab/messages/useConversations';
import { useUnreadMessagesCount } from '../useMessagesBadge';

const mockList = listBuyerConversations as jest.MockedFunction<typeof listBuyerConversations>;
const mockUnread = fetchChatUnreadCounts as jest.MockedFunction<typeof fetchChatUnreadCounts>;

const row = (over: Partial<ConversationRow>): ConversationRow =>
  ({ ID: 1, batch_id: 100, ...over }) as ConversationRow;

/**
 * A row EXACTLY as Node builds it — `{ ...sellerMap[seller_id], batch_id,
 * lastMessageAt }` and nothing more. No `unreadCount`, no `lastMessage`, no
 * `batch_title`. Anything that only works against a richer shape is not working.
 */
const wireRow = (
  ID: number,
  batch_id: number,
  lastMessageAt: string | null = '2026-08-17T09:00:00Z',
): ConversationRow =>
  ({
    ID,
    user_login: `seller${ID}`,
    display_name: `Seller ${ID}`,
    user_email: `s${ID}@example.com`,
    batch_id,
    lastMessageAt,
  }) as ConversationRow;

const noUnread = { total: 0, byConversation: {} as Record<string, number> };

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client }, children);

const signIn = () =>
  useAuth.getState().setProfile({ id: 7, email: 'a@b.com', name: 'A', role: 'buyer', company: null });

// Shared by both describes. The block list PERSISTS to (mocked) storage, so
// clearing only its in-memory cache would leak a blocked id into later tests —
// the stored value has to go too.
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.getState().reset();
  mmkv.remove('chat.blockedUserIds');
  __resetBlockCache();
  mockUnread.mockResolvedValue(noUnread);
  // gcTime 0 so no settled query holds Jest open.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});

afterEach(() => {
  client.clear();
});

describe('useUnreadMessagesCount', () => {
  it('is 0 when signed out — and never fetches the inbox or the unread ledger', async () => {
    mockList.mockResolvedValue([row({ ID: 1, unreadCount: 4 })]);
    mockUnread.mockResolvedValue({ total: 4, byConversation: { '100:1': 4 } });

    const { result } = renderHook(() => useUnreadMessagesCount(), { wrapper });

    // Nothing optimistic on the first frame either: the pill must not flash.
    expect(result.current).toBe(0);
    await waitFor(() => expect(mockList).not.toHaveBeenCalled());
    expect(mockUnread).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });

  it('counts unread from the notification ledger against the REAL inbox payload shape', async () => {
    signIn();
    // Exactly what the server sends — no unreadCount anywhere on the wire.
    mockList.mockResolvedValue([wireRow(11, 100), wireRow(22, 200), wireRow(33, 300)]);
    mockUnread.mockResolvedValue({
      total: 5,
      byConversation: { '100:11': 2, '200:22': 3, '900:99': 7 /* another platform */ },
    });

    const { result } = renderHook(() => useConversations(), { wrapper });

    // 2 + 3 for the two conversations we can see; the unmatched ledger entry is
    // NOT added, because the badge must equal the sum of the visible rows.
    await waitFor(() => expect(result.current.totalUnread).toBe(5));
    const byId = Object.fromEntries(result.current.conversations.map((c) => [c.ID, c.unreadCount]));
    expect(byId).toEqual({ 11: 2, 22: 3, 33: 0 });
  });

  it('does not claim the buyer is caught up until the unread source has answered', async () => {
    signIn();
    mockList.mockResolvedValue([wireRow(11, 100)]);
    let release: ((v: typeof noUnread) => void) | undefined;
    mockUnread.mockReturnValue(new Promise((r) => { release = r; }));

    const { result } = renderHook(() => useConversations(), { wrapper });

    // Rows are in, unread is not: 0 here means "unknown", so the header may not
    // print "All caught up".
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(result.current.totalUnread).toBe(0);
    expect(result.current.unreadResolved).toBe(false);

    release!(noUnread);
    await waitFor(() => expect(result.current.unreadResolved).toBe(true));
  });

  it('drops an orphaned row (deleted counterparty, no ID) instead of rendering it', async () => {
    signIn();
    mockList.mockResolvedValue([
      wireRow(11, 100),
      // Node spreads `sellerMap[seller_id]`, which is undefined once the seller's
      // user row is gone: the row arrives with a batch and nothing else. It used
      // to crash the whole Messages tab on the avatar gradient.
      { batch_id: 555, lastMessageAt: '2026-08-17T10:00:00Z' } as ConversationRow,
    ]);

    const { result } = renderHook(() => useConversations(), { wrapper });

    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(result.current.conversations[0].ID).toBe(11);
  });

  it('prefers a server-sent unreadCount when a deploy ever provides one', async () => {
    signIn();
    mockList.mockResolvedValue([
      row({ ID: 1, batch_id: 100, unreadCount: 2 }),
      row({ ID: 2, batch_id: 200, unreadCount: 3 }),
      row({ ID: 3, batch_id: 300 }), // undefined
      row({ ID: 4, batch_id: 400, unreadCount: -5 }), // never subtracts
    ]);

    const { result } = renderHook(() => useUnreadMessagesCount(), { wrapper });

    await waitFor(() => expect(result.current).toBe(5));
  });

  it('does not count a BLOCKED seller — the inbox hides them, so must the pill', async () => {
    signIn();
    blockUser(2);
    mockList.mockResolvedValue([
      row({ ID: 1, batch_id: 100, unreadCount: 1 }),
      row({ ID: 2, batch_id: 200, unreadCount: 9 }),
    ]);

    const { result } = renderHook(() => useUnreadMessagesCount(), { wrapper });

    await waitFor(() => expect(result.current).toBe(1));
  });

  it('shares one cache entry with the inbox — mounting both fetches once', async () => {
    signIn();
    mockList.mockResolvedValue([wireRow(1, 100)]);
    mockUnread.mockResolvedValue({ total: 2, byConversation: { '100:1': 2 } });

    const { result } = renderHook(
      () => ({ badge: useUnreadMessagesCount(), inbox: useConversations() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.badge).toBe(2));
    expect(result.current.inbox.totalUnread).toBe(2);
    expect(client.getQueryData(labKeys.conversations())).toHaveLength(1);
    // Same queryKeys ⇒ React Query dedupes: one request each, not one per consumer.
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockUnread).toHaveBeenCalledTimes(1);
  });
});

describe('useConversations ordering', () => {
  it('puts the newest conversation first whatever order the server returned, and never lets a missing/invalid date jump the queue', async () => {
    signIn();
    mockList.mockResolvedValue([
      row({ ID: 1, batch_id: 100, lastMessageAt: '2026-08-01T10:00:00Z' }),
      row({ ID: 2, batch_id: 200, lastMessageAt: null }),
      row({ ID: 3, batch_id: 300, lastMessageAt: '2026-08-17T09:00:00Z' }),
      row({ ID: 4, batch_id: 400, lastMessageAt: 'not-a-date' }),
      row({ ID: 5, batch_id: 500, lastMessageAt: '2026-08-10T08:00:00Z' }),
    ]);

    const { result } = renderHook(() => useConversations(), { wrapper });

    await waitFor(() => expect(result.current.conversations).toHaveLength(5));
    expect(result.current.conversations.map((c) => c.ID)).toEqual([3, 5, 1, 2, 4]);
  });
});
