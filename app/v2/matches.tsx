/**
 * 6d — Matches ("My wants").
 *
 * The buyer's saved wants, each one a HEADING with its matches as rows beneath
 * it — not a card. Paused wants sit muted at the bottom. That inversion is the
 * whole point of the drawing: `docs/v2-design/screens/6d.html`.
 *
 *     My wants                                            (+)
 *     ─────────────────────────────────────────────────────────
 *     All 3      Active 1      Paused 2
 *     ─────────────────────────────────────────────────────────
 *     Shimadzu LC-20
 *     Under $12,000 · Europe · Instant
 *
 *     2 MATCHES
 *     [img]  Shimadzu LC-20AD pump set          92%  ›
 *            $9,400 · Netherlands · Refurbished
 *
 *     PAUSED
 *            Agilent 1260 Infinity                   Resume
 *            Saved Aug 4, 2026 · no matches
 *
 * DATA — read real, write later (skill § Data).
 *   `useWants()`            → GET /wtb            (the saved wants)
 *   `useQueries(wantMatches)` → GET /wtb/{id}/matches per want
 * The per-want queries use the SAME keys as `useMatchesBadgeCount` and the old
 * My-Wants screen (`labKeys.wantMatches(id)`), so whichever surface mounts
 * first fills the cache and this one costs no extra round-trips.
 *
 * Writes — resume/pause/create — are NOT wired. `useWantMutations` stays out of
 * this file on purpose; every control that would mutate carries a
 * `TODO(v2-writes)`.
 *
 * ── Four things worth knowing before editing ─────────────────────────────
 *
 * 1. `Screen` is given `scroll={false}` + `contentStyle={styles.fill}`. Without
 *    the `flex:1` the measure wrapper sizes to its content and a `FlatList`
 *    inside it collapses to zero height. The list then owns its own bottom
 *    reserve: `control.tabBar + insets.bottom` — never a hardcoded number.
 *
 * 2. The eyebrow says "2 MATCHES", not "2 NEW MATCHES" as drawn.
 *    `listWantMatches` carries no seen/unseen marker anywhere, so "new" cannot
 *    be derived — saying it would report a months-old match set as if it had
 *    just arrived, which is the exact bug `useMatchesBadge` was written to fix.
 *
 * 3. Guests are forked at the door (`MatchesGuest`), not early-returned inside
 *    the authed component: its hooks fire authenticated queries, and a guest
 *    signing in would change the hook count mid-life. The sign-in sheet itself
 *    is mounted once in `app/v2/_layout.tsx`, not here.
 *
 * 4. The kit gaps this screen first invented locally — `BrandBar`, `FilterTabs`,
 *    `MatchScore`, `PausedWantRow` — have been reconciled into
 *    `src/features/v2/ui/` as `BrandBar`, `Tabs`, `Chip`/`RowTrailing` and
 *    `Row tone="muted"`, and this file composes them. `AddButton` is the one
 *    local piece left: the kit has no round icon-only action.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
// `router` (the global) as well as the hook: `WantsHeader` is a plain
// component outside the authed tree, so it has no `useRouter()` of its own.
import { router, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Plus } from 'lucide-react-native';

import {
  GUTTER,
  SECTION_GAP,
  control,
  icon,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';
import {
  BrandBar,
  EmptyState,
  Hairline,
  QuietAction,
  Row,
  RowThumb,
  RowTrailing,
  Screen,
  SectionHeader,
  SectionNote,
  Tabs,
  Text,
  type TabItem,
  MaterialFill,
} from '@/features/v2/ui';
import { WTB_ENABLED } from '@/lib/flags';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { listWantMatches, type WtbListItem, type WtbMatch } from '@/features/lab/data/wtbApi';
import { useWants } from '@/features/lab/hooks/useWants';
import { useWantStatus } from '@/features/lab/hooks/useWantStatus';
import { priceLabel } from '@/features/lab/data/matchesFromApi';
import { countryLabel } from '@/features/lab/chat/cardKit';
import {
  formatWantDate,
  frequencyLabel,
  isActiveStatus,
  matchToProductVM,
  sortMatchesStrongest,
  statusLabel,
} from '@/features/lab/wants/data/wantsView';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The drawn measure of the header's supporting line — it stops short of the
 *  add button rather than wrapping under it. Pictorial, not a spacing step. */
const HEADER_SUB_MEASURE = 230;
/** A match at or above this relevance is worth colouring. Below it the badge
 *  stays neutral: the palette has one action colour and no warm mid-tier. */
const STRONG_MATCH = 80;

/* ── Header ──────────────────────────────────────────────────────────────── */

/** KIT GAP — the round accent action that sits beside a display title. Same
 *  shape on 6d (add a want) as 6b. Not `PrimaryAction`: no label, 46pt round. */
function AddButton({ onPress }: { onPress: () => void }) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Add a want"
      style={[styles.add, { backgroundColor: c.accent }, animatedStyle]}
    >
      <MaterialFill role="accent" ink="onAccent" radius={radius.pill} />
      <Plus size={icon['2xl']} color={c.onAccent} strokeWidth={2} />
    </AnimatedPressable>
  );
}

function WantsHeader({ dot, onAdd }: { dot: boolean; onAdd?: () => void }) {
  return (
    <View>
      <BrandBar
        unread={dot}
        // Notifications are account-based, so a guest gets the sign-in prompt
        // rather than an empty screen.
        // Was an EMPTY callback — signed in, the bell did nothing at all.
        // `index.tsx` already had the right answer; there is no reason for two
        // bells in one app to disagree about whether notifications open.
        // TODO(v2-nav): repoint at a v2 notifications surface if one is drawn.
        onNotifications={() =>
          requireAuth('notifications', () => router.push(routes.labNotifications))
        }
      />
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text variant="display">My wants</Text>
          <Text variant="body" color="inkMuted" style={styles.titleSub}>
            We watch new listings and tell you the moment one fits.
          </Text>
        </View>
        {onAdd ? <AddButton onPress={onAdd} /> : null}
      </View>
    </View>
  );
}

/* ── Filters ─────────────────────────────────────────────────────────────── */

type WantFilter = 'all' | 'active' | 'paused';
const FILTERS: WantFilter[] = ['all', 'active', 'paused'];
const FILTER_LABEL: Record<WantFilter, string> = {
  all: 'All',
  active: 'Active',
  paused: 'Paused',
};

/* ── The list model ──────────────────────────────────────────────────────── */

type ListItem =
  | { kind: 'wantHeader'; key: string; want: WtbListItem }
  | { kind: 'eyebrow'; key: string; label: string }
  | { kind: 'match'; key: string; match: WtbMatch }
  | { kind: 'note'; key: string; text: string }
  | { kind: 'divider'; key: string }
  | { kind: 'gap'; key: string }
  | { kind: 'paused'; key: string; want: WtbListItem; matchCount: number | null };

/**
 * Anything that is not alerting belongs in the muted section at the bottom.
 *
 * Deliberately `!active` rather than `=== 'paused'`: the API's status set is
 * active / paused / fulfilled / expired / deleted, so a strict paused test
 * would let a fulfilled or expired want count toward "All 3" and then render
 * nowhere — a want that silently vanishes from the buyer's own list. Rows that
 * are dormant for a reason other than pausing say so in their sub-line.
 */
const isDormant = (w: WtbListItem) => !isActiveStatus(w.status);
const isPausedExactly = (w: WtbListItem) => (w.status ?? '').toLowerCase() === 'paused';

/** The line under a want's title: what it is watching for. Composed from
 *  whatever the want actually carries — a real want often has only some of it. */
function wantCriteria(want: WtbListItem): string {
  const bits: string[] = [];
  const max = Number(want.max_price);
  if (Number.isFinite(max) && max > 0) bits.push(`Under ${priceLabel(max, want.price_currency)}`);
  const where = countryLabel(want.country_wanted);
  if (where) bits.push(where);
  const what = (want.category_name ?? '').trim() || (want.keywords ?? []).filter(Boolean)[0];
  if (what) bits.push(String(what));
  bits.push(frequencyLabel(want.notify_frequency));
  return bits.join(' · ');
}

/** The sub-line of a dormant want: why it is here, when it was saved, and what
 *  it found while it was still watching. */
function pausedSubtitle(want: WtbListItem, matchCount: number | null): string {
  const saved = formatWantDate(want.created_at);
  const matches =
    matchCount == null
      ? ''
      : matchCount === 0
        ? 'no matches'
        : `${matchCount} match${matchCount === 1 ? '' : 'es'} while active`;
  // A want can be dormant for a reason other than pausing (fulfilled, expired).
  // Say which, rather than letting the section imply everything here was paused.
  const why = isPausedExactly(want) ? '' : statusLabel(want.status);
  return [why, saved ? `Saved ${saved}` : '', matches].filter(Boolean).join(' · ');
}

/* ── Screen ──────────────────────────────────────────────────────────────── */

function MatchesAuthed() {
  const c = useV2Colors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<WantFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { wants, isLoading, isError, refetch } = useWants();

  // One query per want, on the SAME keys the tab badge and the old My Wants
  // screen use — so this reads the cache rather than re-fetching it.
  const matchQueries = useQueries({
    queries: wants.map((w) => ({
      queryKey: labKeys.wantMatches(w.id),
      queryFn: () => listWantMatches(w.id),
      enabled: WTB_ENABLED,
    })),
  });

  const byWant = useMemo(() => {
    const m = new Map<number, { rows: WtbMatch[]; loading: boolean }>();
    wants.forEach((w, i) => {
      const q = matchQueries[i];
      m.set(w.id, { rows: q?.data ?? [], loading: q?.isLoading ?? false });
    });
    return m;
  }, [wants, matchQueries]);

  const counts = useMemo<Record<WantFilter, number>>(
    () => ({
      all: wants.length,
      active: wants.filter((w) => isActiveStatus(w.status)).length,
      paused: wants.filter(isDormant).length,
    }),
    [wants],
  );

  // The count belongs IN the tab label, as drawn: the tab answers "is there
  // anything in here?" before it is tapped.
  const filterTabs = useMemo<TabItem<WantFilter>[]>(
    () => FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f], count: counts[f] })),
    [counts],
  );

  // The bell's dot means "there is something for you", which here is a match.
  const anyMatch = useMemo(
    () => matchQueries.some((q) => (q.data?.length ?? 0) > 0),
    [matchQueries],
  );

  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    const showActive = filter !== 'paused';
    const showPaused = filter !== 'active';

    if (showActive) {
      const active = wants.filter((w) => isActiveStatus(w.status));
      active.forEach((want, i) => {
        if (i > 0) out.push({ kind: 'gap', key: `gap-${want.id}` });
        out.push({ kind: 'wantHeader', key: `want-${want.id}`, want });

        const entry = byWant.get(want.id);
        const rows = sortMatchesStrongest(entry?.rows ?? []);

        if (entry?.loading) {
          out.push({ kind: 'note', key: `loading-${want.id}`, text: 'Looking for matches…' });
        } else if (rows.length === 0) {
          out.push({
            kind: 'note',
            key: `none-${want.id}`,
            text: "No matches yet. We'll tell you the moment one arrives.",
          });
        } else {
          out.push({
            kind: 'eyebrow',
            key: `eyebrow-${want.id}`,
            // "matches", not "new matches" — see the header comment.
            label: `${rows.length} match${rows.length === 1 ? '' : 'es'}`,
          });
          rows.forEach((m, j) => {
            const key = `match-${want.id}-${m.product_id}-${m.id}`;
            if (j > 0) out.push({ kind: 'divider', key: `div-${key}` });
            out.push({ kind: 'match', key, match: m });
          });
        }
      });
    }

    const paused = wants.filter(isDormant);
    if (showPaused && paused.length > 0) {
      if (out.length > 0) out.push({ kind: 'gap', key: 'gap-paused' });
      out.push({ kind: 'eyebrow', key: 'eyebrow-paused', label: 'Paused' });
      paused.forEach((want) => {
        const entry = byWant.get(want.id);
        out.push({ kind: 'divider', key: `div-paused-${want.id}` });
        out.push({
          kind: 'paused',
          key: `paused-${want.id}`,
          want,
          matchCount: entry?.loading ? null : (entry?.rows.length ?? 0),
        });
      });
    }

    return out;
  }, [wants, byWant, filter]);

  const openMatch = useCallback(
    (matchId: string) => {
      // The existing match-detail route. `matchId` = `${wtb_id}:${product_id}`.
      router.push(`/(lab)/match/${matchId}`);
    },
    [router],
  );

  const onAdd = useCallback(() => {
    haptics.tap();
    /*
     * ⚠️ THIS USED TO BE `requireAuth('want', () => {})` — an EMPTY callback.
     * Signed in, the "+" fired a haptic and did nothing at all: not even the
     * `defer()` sentence the review screens use, just silence. Found by
     * pressing it on a real account.
     *
     * The v2 want composer is still undrawn, but a working path already exists
     * and v2 already uses it: Home's Buying pane hands "Type it" to the SHIPPED
     * My Wants screen, which owns the sheet that actually creates a want. Two
     * controls that mean "add a want" should not disagree about whether that
     * is possible, so this one goes to the same place.
     *
     * TODO(v2-nav): repoint at the v2 composer when it is drawn.
     */
    requireAuth('want', () => router.push('/(lab)/(tabs)/matches'));
  }, [router]);

  const goBrowse = useCallback(() => {
    haptics.tap();
    router.navigate('/v2/browse');
  }, [router]);

  const wantStatus = useWantStatus();

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: labKeys.wants() }),
        // Prefix key → every per-want match query in one call. Refreshing the
        // want list alone would leave every match row stale behind a spinner.
        qc.invalidateQueries({ queryKey: labKeys.wantMatchesAll() }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const selectFilter = useCallback(
    (next: WantFilter) => {
      if (next === filter) return;
      haptics.tap();
      setFilter(next);
    },
    [filter],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      switch (item.kind) {
        case 'wantHeader': {
          const criteria = wantCriteria(item.want);
          return (
            <View style={styles.wantHeader}>
              <Text variant="h3" numberOfLines={2}>
                {item.want.title}
              </Text>
              {criteria ? (
                <Text variant="caption" color="inkSubtle" numberOfLines={2} style={styles.wantSub}>
                  {criteria}
                </Text>
              ) : null}
            </View>
          );
        }

        case 'eyebrow':
          return <SectionHeader title={item.label} />;

        case 'match': {
          const vm = matchToProductVM(item.match);
          const sub = [vm.priceText, vm.country, vm.condition].filter(Boolean).join(' · ');
          const score = vm.pct != null ? `${vm.pct}%` : undefined;
          return (
            <Row
              title={vm.name}
              subtitle={sub}
              onPress={() => openMatch(vm.matchId)}
              leading={
                <RowThumb uri={vm.image}>
                  <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.75} />
                </RowThumb>
              }
              trailing={
                <RowTrailing
                  chip={score}
                  chipTone={vm.pct != null && vm.pct >= STRONG_MATCH ? 'accent' : 'neutral'}
                />
              }
              // The relevance chip lives inside the row, so it is never
              // announced on its own — it has to be in the label.
              accessibilityLabel={
                score ? [vm.name, sub, `${score} match`].filter(Boolean).join('. ') : undefined
              }
            />
          );
        }

        case 'note':
          return <SectionNote>{item.text}</SectionNote>;

        case 'divider':
          return <Hairline />;

        case 'gap':
          return <View style={styles.groupGap} />;

        case 'paused':
          return (
            <Row
              title={item.want.title}
              subtitle={pausedSubtitle(item.want, item.matchCount) || undefined}
              tone="muted"
              trailing={
                <QuietAction
                  label="Resume"
                  // Named, not bare "Resume": a list of paused wants would
                  // otherwise announce the same word for every row.
                  accessibilityLabel={`Resume watching for ${item.want.title}`}
                  onPress={() => {
                    haptics.tap();
                    wantStatus.mutate({ id: item.want.id, status: 'active' });
                  }}
                  disabled={wantStatus.isPending}
                  tone="accent"
                  variant="captionMedium"
                />
              }
            />
          );
      }
    },
    [c.inkDisabled, openMatch],
  );

  const listStyle = useMemo(
    () => ({
      paddingTop: space['6xl'],
      // The tab bar plus the gesture bar. Never a hardcoded number.
      paddingBottom: control.tabBar + insets.bottom + space['6xl'],
    }),
    [insets.bottom],
  );

  const hasWants = wants.length > 0;
  const showAdd = WTB_ENABLED && !isError && (hasWants || isLoading);

  let body: React.ReactNode;

  if (!WTB_ENABLED) {
    body = (
      <EmptyState
        title="Wants are switched off"
        body="Saved wants and their matches are not available in this build. Everything else — browsing, search and the assistant — still works."
        // Nothing here can be un-switched-off by the person reading it, so the
        // action is the thing they CAN still do rather than a dead apology.
        actionLabel="Browse lots"
        onAction={goBrowse}
      />
    );
  } else if (isLoading) {
    body = (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={c.accent} />
        <Text variant="body" color="inkMuted" style={styles.loadingNote}>
          Checking your saved wants for new matches…
        </Text>
      </View>
    );
  } else if (isError) {
    body = (
      <EmptyState
        title="We could not load your wants"
        body="The connection dropped on the way. Your saved wants are safe — this is only the list of them."
        actionLabel="Try again"
        onAction={refetch}
      />
    );
  } else if (!hasWants) {
    body = (
      <EmptyState
        title="Nothing saved yet"
        body="Tell us the machine you are after — the model, a budget, where you would take it — and we will watch every new listing for you."
        actionLabel="Add a want"
        onAction={onAdd}
        secondaryLabel="Browse lots"
        onSecondary={goBrowse}
      />
    );
  } else {
    body = (
      <>
        <View style={styles.tabsWrap}>
          <Tabs items={filterTabs} value={filter} onChange={selectFilter} rule gutter />
        </View>
        <FlatList
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={renderItem}
          // `flex:1` is load-bearing: as a sibling of the tab strip in a column
          // this list would otherwise size to its content and overflow the
          // screen instead of scrolling.
          style={styles.fill}
          contentContainerStyle={listStyle}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: control.tabBar + insets.bottom }}
          ListEmptyComponent={
            <SectionNote>
              {filter === 'paused'
                ? 'Nothing paused. Every want you have saved is watching for you.'
                : 'Nothing active. Resume a paused want to start hearing about matches again.'}
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
        />
      </>
    );
  }

  return (
    <Screen
      scroll={false}
      contentStyle={styles.fill}
      header={<WantsHeader dot={anyMatch} onAdd={showAdd ? onAdd : undefined} />}
      testID="v2-matches"
    >
      {body}
    </Screen>
  );
}

/**
 * What a guest sees. An invitation, not an error: the screen keeps its own
 * header and says what a want does before it asks for anything. The CTA runs
 * through `requireAuth`, which opens the one sign-in prompt in the app.
 *
 * A sibling component rather than an early return — `MatchesAuthed`'s hooks
 * fire authenticated queries, and the hook count must not change when a guest
 * signs in. Same shape as the shipped `(lab)` tabs.
 */
function MatchesGuest() {
  const router = useRouter();

  const onStart = useCallback(() => {
    haptics.tap();
    requireAuth('want', () => {
      // Unreachable while this fork is rendered — a signed-in person is in
      // MatchesAuthed. TODO(v2-writes): open the composer once it exists.
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
      header={<WantsHeader dot={false} />}
      testID="v2-matches-guest"
    >
      <EmptyState
        title="Tell us what you are looking for"
        body="Save the machine you need and we will check every new listing against it — the model, the budget, the country. You only need an account so we know who to tell."
        actionLabel="Sign in to save a want"
        onAction={onStart}
        secondaryLabel="Browse lots"
        onSecondary={onBrowse}
      />
    </Screen>
  );
}

export default function V2Matches() {
  const isGuest = useIsGuest();
  return isGuest ? <MatchesGuest /> : <MatchesAuthed />;
}

const styles = StyleSheet.create({
  /** `Screen` measures its body with `width:100%` and no flex; a FlatList
   *  inside that collapses to zero height without this. */
  fill: { flex: 1 },

  // Header
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space['3xl'],
  },
  titleCol: { flex: 1, minWidth: 0 },
  titleSub: { marginTop: space.md, maxWidth: HEADER_SUB_MEASURE },
  add: {
    overflow: 'hidden',
    width: control.thumb,
    height: control.thumb,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Tabs
  tabsWrap: { paddingTop: space['5xl'] },

  // List
  wantHeader: { paddingHorizontal: GUTTER, paddingBottom: space['4xl'] },
  wantSub: { marginTop: space.sm },
  groupGap: { height: SECTION_GAP },

  // Loading / empty / error / guest
  /** Only the LOADING state is drawn locally now — a spinner and a line, which
   *  is not an empty state and must not offer an action. Everything else on
   *  this screen goes through the kit's `EmptyState`: this file used to draw
   *  its own, and on a device the two sat side by side in the tab bar with
   *  different button widths and different vertical rhythm. */
  loadingWrap: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: SECTION_GAP,
    paddingHorizontal: GUTTER,
    gap: space.lg,
  },
  loadingNote: { maxWidth: HEADER_SUB_MEASURE * 2 },
});
