/**
 * 6e — Messages. The buyer↔seller conversation INBOX.
 *
 * ⚠️ THE CANVAS MIS-LABELS THIS SCREEN. `docs/v2-design/screens/6e.html` is
 * titled "Chat", but what it DRAWS is the messages inbox: thread rows with a
 * counterparty, a lot number, a last-message preview, a relative stamp and an
 * unread dot. The AI assistant is a different screen and is already built at
 * `app/v2/chat.tsx`. This file is the drawing.
 *
 *     GREENBIDZ                                        EN  🔔•
 *     Messages
 *     2 threads are waiting on you.
 *     ─────────────────────────────────────────────────────────
 *     All 12        Unread 2
 *     ─────────────────────────────────────────────────────────
 *     [AK]  Waters Alliance e2695                     6d
 *           Can you ship to Karachi by the 12th?       •
 *     ─────────────────────────────────────────────────────────
 *     [SC]  Ak test                                    2d
 *           Lot #5402
 *
 *     5 empty threads hidden                     Show all
 *
 * DATA — read real, write later (skill § Data).
 *   `useConversations()` → GET /chat/buyer/:id/sellers  (the inbox rows)
 *                        + GET /notifications/:id       (the unread ledger)
 * kept live over the shared chat socket by the hook itself.
 *
 * NOTHING HERE WRITES. No send, no mark-read, no block. Tapping a row hands off
 * to the SHIPPED thread screen `/(lab)/deal/[id]`, which owns its own reads and
 * writes (it marks its own notifications read on open — that is its existing
 * behaviour, not something this screen does).
 *
 * ── Six things worth knowing before editing ──────────────────────────────
 *
 * 1. THE "BUYING / SELLING" TABS ARE NOT BUILT, AND CANNOT BE. The only inbox
 *    endpoint in the app is `GET /chat/buyer/:id/sellers`, and `MOBILE_CHAT_ROLE`
 *    is pinned to `buyer` for a documented reason (deriving it from the profile
 *    silently dropped every message an approved seller sent). So every thread
 *    reachable here is one where this user is the BUYER, by construction: a
 *    "Selling" tab could only ever be empty and "Buying" would just repeat
 *    "All". Chrome for a state that cannot exist is the exact failure the skill
 *    calls out, so the strip is `All` + `Unread`. The drawn per-row "· buying ·"
 *    token went with it — a word that is identical on every row carries no
 *    information.
 *
 * 2. "5 EMPTY THREADS HIDDEN" IS REAL, and it is derived the same way the
 *    shipped inbox derives it: a thread is EMPTY only when it has no preview
 *    text, no `lastMessageAt` AND nothing unread. `GET /chat/buyer/:id/sellers`
 *    returns `{...seller, batch_id, lastMessageAt}` — no message text — so the
 *    absence of BOTH a preview and a timestamp is the only honest proof that
 *    nobody ever wrote in it. Those rows fold away behind the footer line.
 *
 * 3. THE FOLD REFUSES TO SWALLOW THE SCREEN. If every thread is empty (a deploy
 *    that stops sending `lastMessageAt` would do exactly that) there is nothing
 *    above the fold, so the fold does not appear and every row renders. An
 *    inbox that hides its entire contents behind a footnote is worse than an
 *    inbox with no fold.
 *
 * 4. THE ROW TITLE ADAPTS TO WHAT THE WIRE ACTUALLY SENT. The drawing titles
 *    each row with the lot ("Waters Alliance e2695"), but the inbox endpoint
 *    does not join the listing in on current deploys — titling every row
 *    "Lot #5402" would be a screen full of numbers. So the title is the lot
 *    when we have it and the counterparty when we do not, and whichever one is
 *    left over goes in the sub-line. Never both, never a placeholder.
 *
 * 5. UNREAD CARRIES TWO CUES, NOT ONE: the accent dot (a SHAPE, so it survives
 *    greyscale and colour blindness) and a heavier title. `rowTitle` (500) vs
 *    `row` (400) is the type scale's version of the drawn 600/500 pair — there
 *    is no 600 row title in the scale, and the distinction is what matters.
 *
 * 6. GUESTS ARE FORKED AT THE DOOR (`MessagesGuest`), not early-returned inside
 *    the authed component: its hooks open the chat socket and fire
 *    authenticated queries, and the hook count must not change when a guest
 *    signs in. `requireAuth('message', …)` is the CORRECT gate here — buyer↔
 *    seller messaging is account-based (a seller has to know who is writing),
 *    unlike browse, search and the AI assistant, which stay open. The sign-in
 *    sheet itself is mounted once in `app/v2/_layout.tsx`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { RTVFlatList } from 'reanimated-tab-view';
import { Redirect, useRouter } from 'expo-router';

import {
  GUTTER,
  SECTION_GAP,
  space,
  useV2Colors,
} from '@/theme/v2';
import {
  BrandBar,
  EmptyState,
  Hairline,
  QuietAction,
  Row,
  RowThumb,
  Screen,
  SectionHeader,
  SectionNote,
  Tabs,
  Text,
  useTabBarReserve,
  type TabItem,
} from '@/features/v2/ui';
import { haptics } from '@/lib/haptics';
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { routes } from '@/lib/routes';
import { useConversations } from '@/features/lab/messages/useConversations';
import { useSocketStatus } from '@/features/lab/messages/socket';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import type { ConversationRow } from '@/features/lab/messages/chatApi';

/* ── Real-data copy ──────────────────────────────────────────────────────── */

/** The wire row is loose (`[k: string]: unknown`), so every field is coerced. */
function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** "AK" — the counterparty's monogram, for the 46pt leading tile.
 *
 *  NOT the drawn photo placeholder: the inbox endpoint carries no image for
 *  either the lot or the seller, on any deploy, so an image glyph would promise
 *  a picture that is never coming — twelve times down one screen. The monogram
 *  is the one identifying mark the data actually holds, and it makes the rows
 *  scannable instead of identical. */
function monogramOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** A relative age in two forms: `6d` for the row, "6 days ago" for the screen
 *  reader. A stamp is announced character by character otherwise ("six dee"),
 *  and the row is a single accessible element, so it has to carry both. */
type Age = { short: string; spoken: string };

function agePair(n: number, suffix: string, unit: string): Age {
  return { short: `${n}${suffix}`, spoken: `${n} ${unit}${n === 1 ? '' : 's'} ago` };
}

function ageOf(iso?: string | null, now: number = Date.now()): Age | null {
  if (!iso) return null;
  const then = Date.parse(String(iso));
  if (Number.isNaN(then)) return null;
  const mins = Math.max(0, Math.floor((now - then) / 60_000));
  if (mins < 1) return { short: 'now', spoken: 'just now' };
  if (mins < 60) return agePair(mins, 'm', 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return agePair(hours, 'h', 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return agePair(days, 'd', 'day');
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return agePair(weeks, 'w', 'week');
  return agePair(Math.floor(weeks / 52), 'y', 'year');
}

/** One row, resolved from the wire once so the render is pure. */
type Thread = {
  key: string;
  /** Params for the shipped thread screen. */
  sellerId: number;
  batchId: number;
  who: string;
  listing: string;
  title: string;
  subtitle: string;
  monogram: string;
  age: Age | null;
  unread: number;
  /** Nobody has ever written in this thread — see note 2 in the header. */
  empty: boolean;
  /** The whole row, spoken. */
  label: string;
};

function toThread(row: ConversationRow, index: number): Thread {
  const who = text(row.display_name) || text(row.user_email) || 'Seller';
  const listing = text(row.batch_title) || text(row.product_name);
  const preview = text(row.lastMessage);
  const lot = `Lot #${row.batch_id}`;
  // The lot is the subject of the conversation where we know it; otherwise the
  // person is. Whichever is left over becomes the sub-line. See note 4.
  const title = listing || who;
  const meta = listing ? `${who} · ${lot}` : lot;
  const unread = Math.max(0, Number(row.unreadCount) || 0);
  const age = ageOf(row.lastMessageAt);
  // `lastMessageAt == null`, not `age === null`: an unparseable date still
  // proves a message exists, and must not fold the thread away as empty.
  const empty = preview === '' && row.lastMessageAt == null && unread === 0;
  const subtitle = preview || meta;

  return {
    // `${ID}-${batch_id}` IS NOT UNIQUE. Real data has two conversations
    // between the same pair about the same lot, and React then warns
    // "Encountered two children with the same key, `574-5480`" — which is not
    // cosmetic: non-unique keys let React duplicate or omit rows and lose the
    // wrong one's state on any update. Found on a 190-thread account; a guest
    // and a short fixture both look fine.
    // `conversation_id` is the real identity but is OPTIONAL on the wire, so
    // the index is the fallback. It is stable here because the list is
    // rendered straight from the fetched order and never sorted in place.
    key: row.conversation_id != null ? `c${row.conversation_id}` : `${row.ID}-${row.batch_id}-${index}`,
    sellerId: Number(row.ID),
    batchId: Number(row.batch_id),
    who,
    listing,
    title,
    subtitle,
    monogram: monogramOf(who),
    age,
    unread,
    empty,
    label: [
      title,
      subtitle,
      age ? `Last message ${age.spoken}` : 'No messages yet',
      unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join('. '),
  };
}

/* ── Header ──────────────────────────────────────────────────────────────── */

function MessagesHeader({ bellUnread, subline }: { bellUnread: number; subline: string }) {
  const router = useRouter();
  return (
    <View>
      <BrandBar
        unread={bellUnread}
        // The notification centre is account-based, so a guest meets the
        // sign-in prompt rather than an empty screen.
        onNotifications={() => {
          haptics.tap();
          requireAuth('notifications', () => router.push(routes.labNotifications));
        }}
      />
      <Text variant="display">Messages</Text>
      <Text variant="body" color="inkMuted" style={styles.subline}>
        {subline}
      </Text>
    </View>
  );
}

/* ── The row ─────────────────────────────────────────────────────────────── */

/**
 * KIT GAP — a list row whose trailing stamp sits on the TITLE's baseline.
 *
 * `Row` centres its `trailing` cluster against the whole row, which puts a
 * timestamp between the title and the preview instead of beside the title —
 * every messaging inbox ever built aligns those two. Everything else here is
 * the kit's row: `RowThumb` for the leading tile, `Text` variants, the same
 * 24pt gutter / 14pt gap / 16pt vertical rhythm, and
 * `usePressFeedback({scale:false})` so a full-bleed row dims rather than
 * shrinking.
 */
/**
 * One conversation.
 *
 * The kit's `Row` draws all of it now — `stamp` puts the age on the title's
 * baseline and `marker` reserves the unread dot's slot whether or not the dot
 * is drawn. This was a local component until `Row` grew those two props; the
 * only thing it still owns is the monogram tile, because there is no seller
 * photograph anywhere in this payload.
 *
 * `marker={unread}` and never `marker={undefined}`: the slot has to be
 * reserved on read rows too, or the timestamp column goes ragged. See `Row`.
 */
function ThreadRow({ thread, onPress }: { thread: Thread; onPress: (t: Thread) => void }) {
  const unread = thread.unread > 0;

  return (
    <Row
      title={thread.title}
      subtitle={thread.subtitle}
      stamp={thread.age ? thread.age.short : ''}
      marker={unread}
      // Unread rows carry the weight; read rows drop to the navigation variant
      // and a dimmer preview, so the difference is visible without a badge.
      titleVariant={unread ? 'rowTitle' : 'row'}
      subtitleTone={unread ? 'muted' : 'subtle'}
      leading={
        <RowThumb>
          <Text variant="rowTitle" color="inkMuted">
            {thread.monogram}
          </Text>
        </RowThumb>
      }
      onPress={() => onPress(thread)}
      accessibilityLabel={thread.label}
      accessibilityHint="Opens the conversation"
      testID="v2-thread-row"
    />
  );
}

/* ── The list model ──────────────────────────────────────────────────────── */

type Filter = 'all' | 'unread';

type ListItem =
  | { kind: 'thread'; key: string; thread: Thread }
  | { kind: 'divider'; key: string }
  | { kind: 'eyebrow'; key: string; label: string }
  | { kind: 'gap'; key: string };

/* ── Screen ──────────────────────────────────────────────────────────────── */

/**
 * The real screen, now mounted as ONE PANE of `RootTabsPager` (2026-09-25).
 * `FlatList` swapped for `RTVFlatList` and `hideOwnTabBar` added — see the
 * matching notes in `browse.tsx` and `matches.tsx`.
 */
function MessagesAuthed() {
  const c = useV2Colors();
  const router = useRouter();
  const bottomReserve = useTabBarReserve();

  const [filter, setFilter] = useState<Filter>('all');
  const [showEmpty, setShowEmpty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { conversations, unreadResolved, isLoading, isError, refetch } = useConversations();
  const socket = useSocketStatus();
  // The bell is the notification centre, not this inbox — so it reads the same
  // count every other v2 screen's bell reads.
  const { unreadCount: bellUnread } = useLabNotifications();

  const threads = useMemo(() => conversations.map(toThread), [conversations]);
  // `Array.prototype.map` passes (value, index) — `toThread` takes both.
  const active = useMemo(() => threads.filter((t) => !t.empty), [threads]);
  const empties = useMemo(() => threads.filter((t) => t.empty), [threads]);
  const unreadThreads = useMemo(() => active.filter((t) => t.unread > 0), [active]);

  // The fold only exists when there is something left above it — see note 3.
  const foldable = empties.length > 0 && active.length > 0;
  const emptiesVisible = !foldable || showEmpty;

  const tabs = useMemo<TabItem<Filter>[]>(
    () => [
      { value: 'all', label: 'All', count: threads.length },
      // No count until the unread ledger has actually answered: "Unread 0" is
      // a claim, and the hook exports `unreadResolved` precisely because this
      // app has already told a buyer they were caught up seconds after a reply.
      {
        value: 'unread',
        label: 'Unread',
        count: unreadResolved ? unreadThreads.length : undefined,
      },
    ],
    [threads.length, unreadResolved, unreadThreads.length],
  );

  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    let prevWasThread = false;
    const pushThread = (thread: Thread) => {
      // A rule BETWEEN rows only — never under an eyebrow, where it would read
      // as a section break rather than a row divider.
      if (prevWasThread) out.push({ kind: 'divider', key: `div-${thread.key}` });
      out.push({ kind: 'thread', key: thread.key, thread });
      prevWasThread = true;
    };

    if (filter === 'unread') {
      unreadThreads.forEach(pushThread);
      return out;
    }

    active.forEach(pushThread);

    if (emptiesVisible && empties.length > 0) {
      if (out.length > 0) {
        out.push({ kind: 'gap', key: 'gap-empty' });
        // Chrome for a state that now exists: these rows ARE a group, and the
        // eyebrow says which.
        out.push({ kind: 'eyebrow', key: 'eyebrow-empty', label: 'No messages yet' });
        prevWasThread = false;
      }
      empties.forEach(pushThread);
    }

    return out;
  }, [filter, active, empties, emptiesVisible, unreadThreads]);

  const openThread = useCallback(
    (thread: Thread) => {
      haptics.tap();
      // The shipped thread screen. Params per its own header contract: `id` is
      // the BATCH id, `sellerId` the counterparty, `name` the header title,
      // `listingTitle` optional context for the pinned listing card.
      router.push({
        pathname: '/(lab)/deal/[id]',
        params: {
          id: String(thread.batchId),
          sellerId: String(thread.sellerId),
          name: thread.who,
          listingTitle: thread.listing,
        },
      });
    },
    [router],
  );

  const selectFilter = useCallback(
    (next: Filter) => {
      if (next === filter) return;
      haptics.tap();
      setFilter(next);
    },
    [filter],
  );

  const toggleEmpty = useCallback(() => {
    haptics.tap();
    setShowEmpty((v) => !v);
  }, []);

  const onPullRefresh = useCallback(() => {
    // Driven by the gesture, NOT by react-query's `isRefetching`: this hook
    // invalidates on every inbound socket message, so binding the spinner to
    // the query would drop the screen into "refreshing" whenever anybody wrote
    // to any thread.
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const goBrowse = useCallback(() => {
    haptics.tap();
    router.navigate('/v2/browse');
  }, [router]);

  /**
   * The one live status line on the screen, in the order a buyer needs it.
   * Every branch has to be something we can substantiate.
   */
  const subline = useMemo(() => {
    if (isLoading) return 'Checking for new messages…';
    if (isError) {
      return threads.length > 0
        ? 'That refresh did not go through — pull down to try again.'
        : 'We could not reach your conversations.';
    }
    // Only `offline` means we OBSERVED a failure; `connecting` is the normal
    // sub-second handshake and must not accuse the network.
    if (socket === 'offline') return 'Reconnecting — new messages may be missing.';
    if (threads.length === 0) return 'Ask a seller about a lot and the thread lives here.';
    if (!unreadResolved) {
      return threads.length === 1
        ? '1 conversation with a seller.'
        : `${threads.length} conversations with sellers.`;
    }
    if (unreadThreads.length > 0) {
      return unreadThreads.length === 1
        ? '1 thread is waiting on you.'
        : `${unreadThreads.length} threads are waiting on you.`;
    }
    return 'Nothing is waiting on you.';
  }, [isLoading, isError, socket, threads.length, unreadResolved, unreadThreads.length]);

  const listStyle = useMemo(
    () => ({
      paddingTop: space['4xl'],
      // `Screen` renders the tab bar as a flex sibling below this list, so the
      // reserve is whatever `useTabBarReserve` says — never a hardcoded number.
      paddingBottom: bottomReserve + space['6xl'],
    }),
    [bottomReserve],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      switch (item.kind) {
        case 'thread':
          return <ThreadRow thread={item.thread} onPress={openThread} />;
        case 'divider':
          return <Hairline />;
        case 'eyebrow':
          return <SectionHeader title={item.label} />;
        case 'gap':
          return <View style={styles.groupGap} />;
      }
    },
    [openThread],
  );

  /** The drawn footer line — a real affordance over a real count. */
  const listFooter =
    filter === 'all' && foldable ? (
      <View style={styles.footer}>
        <Text variant="caption" color="inkSubtle" style={styles.footerText}>
          {showEmpty
            ? `${empties.length} empty thread${empties.length === 1 ? '' : 's'} shown`
            : `${empties.length} empty thread${empties.length === 1 ? '' : 's'} hidden`}
        </Text>
        <QuietAction
          label={showEmpty ? 'Hide' : 'Show all'}
          onPress={toggleEmpty}
          tone="accent"
          variant="captionMedium"
          accessibilityLabel={
            showEmpty
              ? `Hide the ${empties.length} threads with no messages`
              : `Show the ${empties.length} threads with no messages`
          }
        />
      </View>
    ) : null;

  let body: React.ReactNode;

  if (isLoading) {
    body = (
      <View style={styles.stateWrap}>
        <ActivityIndicator size="small" color={c.accent} />
        <Text variant="body" color="inkMuted">
          Loading your conversations with sellers…
        </Text>
      </View>
    );
  } else if (isError && threads.length === 0) {
    body = (
      <EmptyState
        title="We could not load your messages"
        body="The connection dropped on the way. Nothing is lost — your conversations are on the server; this is only the list of them."
        actionLabel="Try again"
        onAction={refetch}
      />
    );
  } else if (threads.length === 0) {
    body = (
      <EmptyState
        title="No conversations yet"
        body="When you ask a seller about a lot — shipping, condition, what it comes with — the thread appears here and stays here."
        // The action that would FILL this screen: you need a lot to ask about.
        actionLabel="Browse lots"
        onAction={goBrowse}
      />
    );
  } else {
    body = (
      <>
        <View style={styles.tabsWrap}>
          <Tabs items={tabs} value={filter} onChange={selectFilter} rule gutter />
        </View>
        <RTVFlatList
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={renderItem}
          // `flex:1` is load-bearing: as a sibling of the tab strip in a column
          // this list would size to its content and overflow the screen instead
          // of scrolling.
          style={styles.fill}
          contentContainerStyle={listStyle}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: bottomReserve }}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            <SectionNote>
              {filter === 'unread'
                ? 'Nothing unread. Switch to All for every conversation you have.'
                : 'No conversations to show.'}
            </SectionNote>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          testID="v2-messages-list"
        />
      </>
    );
  }

  return (
    <Screen
      scroll={false}
      contentStyle={styles.fill}
      hideOwnTabBar
      header={<MessagesHeader bellUnread={bellUnread} subline={subline} />}
      testID="v2-messages"
    >
      {body}
    </Screen>
  );
}

/**
 * What a guest sees. An invitation, not an error — and the screen still says
 * what messaging is FOR before it asks for anything.
 *
 * A sibling component rather than an early return: see note 6 in the header.
 */
function MessagesGuest() {
  const router = useRouter();

  const onSignIn = useCallback(() => {
    haptics.tap();
    // Buyer↔seller messaging IS account-based (Guideline 5.1.1(v) allows this
    // gate; browse, search and the assistant must stay open).
    requireAuth('message', () => {
      // Unreachable while this fork renders — a signed-in person is in
      // MessagesAuthed, which is where their threads are.
    });
  }, []);

  const onBrowse = useCallback(() => {
    haptics.tap();
    router.navigate('/v2/browse');
  }, [router]);

  return (
    <Screen
      scroll={false}
      contentStyle={styles.fill}
      hideOwnTabBar
      header={
        <MessagesHeader bellUnread={0} subline="Sign in to pick up a conversation with a seller." />
      }
      testID="v2-messages-guest"
    >
      <EmptyState
        title="Your conversations live here"
        body="Ask a seller about shipping, condition or what a lot comes with, and the whole thread stays in one place. You only need an account so the seller knows who is writing."
        actionLabel="Sign in to message sellers"
        onAction={onSignIn}
        secondaryLabel="Browse lots"
        onSecondary={onBrowse}
      />
    </Screen>
  );
}

export function MessagesScreen() {
  const isGuest = useIsGuest();
  return isGuest ? <MessagesGuest /> : <MessagesAuthed />;
}

/** The route. `RootTabsPager` (mounted at `/v2`) hosts the real screen; this
 *  keeps `/v2/messages` deep links and the tab bar's old `href` alive. */
export default function V2MessagesRedirect() {
  return <Redirect href="/v2?tab=messages" />;
}

const styles = StyleSheet.create({
  /** `Screen` measures its body with `width:100%` and no flex; a FlatList
   *  inside that collapses to zero height without this. */
  fill: { flex: 1 },

  // Header
  subline: { marginTop: space.md },

  // Tabs
  tabsWrap: { paddingTop: space['5xl'] },

  // List
  groupGap: { height: SECTION_GAP },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2xl'],
    paddingHorizontal: GUTTER,
    paddingTop: space.lg,
  },
  footerText: { flex: 1, minWidth: 0 },

  // Loading
  stateWrap: {
    // Top-aligned, not centred: centring in a flex:1 column under a short
    // header leaves a void that reads as a broken layout, not a waiting one.
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: SECTION_GAP,
    paddingHorizontal: GUTTER,
    gap: space.lg,
  },
});
