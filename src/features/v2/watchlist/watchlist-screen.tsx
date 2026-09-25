/**
 * COPIED from the Obytes template and adjusted in place.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/feed-screen.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * Their shape, kept: a `FlashList` with a memoised `renderItem`, a
 * `keyExtractor`, a `ListEmptyComponent`, and an early return for the error
 * state so the list is never asked to render a failure.
 *
 * | Theirs | Ours | Why |
 * |---|---|---|
 * | `usePosts()` | `WATCHLIST_FIXTURE` | PHASE 1 is UI only; phase 2 swaps this one line (`Docs/Dashboard/buyer/watchlist/phase-2-api.md`) |
 * | single column | `numColumns={2}` | the web is a 2–4 column card grid and the record is image-led; one tile per row would show one and a half saved items per screen |
 * | `keyExtractor` by index | by `card.id` | an index key re-uses a recycled tile's `failed` image state when the list changes |
 * | `<EmptyList isLoading>` | our `EmptyState` | theirs is a spinner-or-nothing; an empty state must carry the action that FILLS it |
 * | `<Text>Error Loading data</Text>` | `SectionNote tone="danger"` | same early return, a message that says what to do next |
 * | `FocusAwareStatusBar` | — | `Screen` already owns the status bar per scheme |
 * | `className="flex-1"` | `styles.fill` | NativeWind classes fail `v2Adherence` |
 *
 * ── WHAT THE WEB DOES THAT WE DELIBERATELY DO NOT ──
 *
 * **Numbered pagination.** `BuyerWatchlist.tsx` slices 12 per page and draws
 * prev/next chevrons, because the endpoint returns everything at once. That is
 * the web working around a desktop layout; a phone list scrolls. Porting the
 * chevrons would be porting the constraint rather than the behaviour. The
 * payload size is still a real phase-2 question — see `WEB_PAGE_SIZE` in
 * `./types.ts`.
 *
 * **`window.addEventListener('wishlist-changed')`** (`BuyerWatchlist.tsx:44`)
 * — there is no `window` here. It is how the web refetches after a heart is
 * toggled elsewhere on the page, and its mobile equivalent is
 * `invalidateQueries`, which belongs in phase 2 with the mutation. Copying it
 * verbatim COMPILES and silently never fires, which is why the plan calls it
 * out by line number.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';

import { EmptyState, SectionNote, Text, useTabBarReserve } from '@/features/v2/ui';
import { GUTTER, space } from '@/theme/v2';

import { WatchTile } from './watch-tile';
import { useWatchlist } from './useWatchlist';
import type { WishCard } from './types';

export function WatchlistScreen() {
  const bottom = useTabBarReserve({ tabBar: false });

  /** PHASE 2 — the real endpoint. Mapping happens in the query, not here. */
  const { data, isPending, isError, refetch, isRefetching } = useWatchlist();
  const cards: WishCard[] = data ?? [];

  const renderItem = useCallback(
    ({ item }: { item: WishCard }) => <WatchTile card={item} />,
    [],
  );

  if (isError) {
    return (
      <View style={styles.fill}>
        <SectionNote tone="danger" actionLabel="Try again" onAction={() => refetch()}>
          Your watchlist did not load.
        </SectionNote>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/*
        The count is the only thing worth saying above the grid, and the web
        says it too ("N saved items"). It is NOT a subtitle explaining what a
        watchlist is — that was deleted from the bids header for the same
        reason. Hidden when empty, because `EmptyState` already says so.
      */}
      {isPending || cards.length > 0 ? (
        <Text variant="micro" color="inkSubtle" style={styles.count}>
          {isPending
            ? 'Loading your watchlist…'
            : cards.length === 1
              ? '1 saved item'
              : `${cards.length} saved items`}
        </Text>
      ) : null}

      <FlashList
        data={cards}
        renderItem={renderItem}
        numColumns={2}
        keyExtractor={(card) => String(card.id)}
        contentContainerStyle={{ paddingBottom: bottom + space['8xl'] }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          /* Nothing while the first load is in flight — an empty state that
             flashes and then fills is a lie about the data. */
          isPending ? null : (
            <EmptyState
              title="Nothing saved yet"
              body="Tap the bookmark on any lot to keep an eye on it. Saved items show up here."
              actionLabel="Browse equipment"
              onAction={() => router.push('/v2/browse')}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `GUTTER - space.sm`, not `GUTTER`. Every tile carries `space.sm` of
   * horizontal margin so the two columns are separated; subtracting it here
   * puts the OUTER edges back on the screen gutter. The two numbers are a
   * pair — see the note on `card` in `watch-tile.tsx`.
   */
  fill: { flex: 1, paddingHorizontal: GUTTER - space.sm },
  count: { marginTop: space.md, marginBottom: space.lg, marginHorizontal: space.sm },
});
