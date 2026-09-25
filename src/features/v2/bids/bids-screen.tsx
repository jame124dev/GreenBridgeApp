/**
 * COPIED from the Obytes template and adjusted in place.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/feed-screen.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * Their shape, kept: a `FlashList` with a memoised `renderItem`, a
 * `keyExtractor`, a `ListEmptyComponent`, and an early return for the error
 * state so the list is never asked to render a failure. What was adjusted:
 *
 * | Theirs | Ours | Why |
 * |---|---|---|
 * | `usePosts()` | `BID_FIXTURE` | PHASE 1 is UI only; phase 2 swaps this one line for the real query (`Docs/Dashboard/buyer/my-bids/phase-2-api.md`) |
 * | `keyExtractor` by index | by `buyer_bid_id ?? batch_id` | an index key re-uses a recycled row's state when the list re-sorts, and this list re-sorts on every filter change |
 * | `<EmptyList isLoading>` | our `EmptyState` | theirs is a spinner-or-nothing; `UX_DESIGN_RULES.md` wants an empty state that carries the action which would FILL it |
 * | `<Text>Error Loading data</Text>` | `SectionNote tone="danger"` | same early return, but a message that says what to do next |
 * | `FocusAwareStatusBar` | — | `Screen` already owns the status bar per scheme |
 * | `className="flex-1"` | `styles.fill` | NativeWind classes fail `v2Adherence` |
 *
 * Their feed has no filters, so the tab bar came from a SECOND repo:
 * `./material-tab-bar.tsx`, copied from react-native-collapsible-tab-view
 * (MIT). See its header for what changed.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';

import { EmptyState, SectionNote, Text, useTabBarReserve, type TabItem } from '@/features/v2/ui';
import { GUTTER, MIN_TOUCH, space } from '@/theme/v2';

import { BidCard } from './bid-card';
import { MaterialTabBar } from './material-tab-bar';
import { useBuyerBids } from './useBuyerBids';
import { BID_FILTERS, type BidFilter, type BuyerBidItem } from './types';

export function BidsScreen({ header }: { header?: React.ReactNode }) {
  const [filter, setFilter] = useState<BidFilter>('all');
  const [tabsWidth, setTabsWidth] = useState(0);
  const bottom = useTabBarReserve({ tabBar: false });

  /**
   * PHASE 2 — the real endpoint. The template's early error return is now
   * load-bearing rather than a placeholder.
   */
  const { data, isPending, isError, refetch, isRefetching } = useBuyerBids();
  const rowsIn: BuyerBidItem[] = data ?? [];

  const tabs: readonly TabItem<BidFilter>[] = BID_FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
  }));

  /**
   * Filtered in the client ONLY because there is no server yet. Phase 2 sends
   * `status` as a query param — `statusParam()` in `./types` is already the
   * mapping — because filtering a page is not filtering a list.
   */
  const rows = useMemo(
    () =>
      filter === 'all'
        ? rowsIn
        : rowsIn.filter((b) => (b.status ?? '').toLowerCase() === filter),
    [rowsIn, filter],
  );

  const renderItem = useCallback(
    ({ item }: { item: BuyerBidItem }) => <BidCard {...item} />,
    [],
  );

  if (isError) {
    return (
      <View style={styles.fill}>
        {/* Says what to do next, and gives the control that does it. */}
        <SectionNote tone="danger" actionLabel="Try again" onAction={() => refetch()}>
          Your bids did not load.
        </SectionNote>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {header}

      {/*
        Tabs sit at the top of the screen now, not under a title block — see
        the route's docblock for why ~500px of header went.

        The width is MEASURED, not `windowWidth - 2 * GUTTER`. The tab bar lays
        its items out against it, so a hardcoded arithmetic version silently
        stops being right the moment this container's padding changes.
      */}
      <View style={styles.tabsSlot} onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}>
        {tabsWidth > 0 && (
          <MaterialTabBar
            items={tabs}
            value={filter}
            onChange={setFilter}
            width={tabsWidth}
          />
        )}
      </View>

      {/*
        Explanatory, not a spinner — `UX_DESIGN_RULES.md`. The count is the
        useful fact once loaded; while loading, say what is being fetched.
        `isRefetching` is deliberately NOT a third state: a background refresh
        that rewrites the header makes the screen twitch on every focus.
      */}
      <Text variant="micro" color="inkSubtle" style={styles.notice}>
        {isPending
          ? 'Loading your bids…'
          : rows.length === 1
            ? '1 bid'
            : `${rows.length} bids`}
      </Text>

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(b) => String(b.buyer_bid_id ?? b.batch_id)}
        contentContainerStyle={{ paddingBottom: bottom + space['8xl'] }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          /* Nothing while the first load is in flight — an empty state that
             appears for a second and then fills is a lie about the data. */
          isPending ? null : (
            <EmptyState
              title={emptyTitle(filter)}
              body={emptyBody(filter)}
              actionLabel="Browse equipment"
              onAction={() => router.push('/v2/browse')}
            />
          )
        }
      />
    </View>
  );
}

/**
 * The empty state changes with the filter: "you have never bid" and "you have
 * no losing bids" are different facts and only one of them is bad news.
 */
function emptyTitle(f: BidFilter): string {
  if (f === 'accepted') return 'Nothing won yet';
  if (f === 'rejected') return 'No lost bids';
  if (f === 'pending') return 'No bids in play';
  return 'You have not bid yet';
}

function emptyBody(f: BidFilter): string {
  if (f === 'accepted') return 'Bids you win will appear here, with what to do next.';
  if (f === 'rejected') return 'Bids that did not win will be listed here.';
  if (f === 'pending') return 'Bids still open will show here, with the current top bid.';
  return 'Find equipment in the marketplace and place your first bid.';
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: GUTTER },
  /** Reserves the bar's height before the measure lands, so nothing jumps. */
  tabsSlot: { marginTop: space.md, height: MIN_TOUCH },
  notice: { marginTop: space.lg, marginBottom: space.lg },
});
