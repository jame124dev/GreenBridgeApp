/**
 * COPIED from the Obytes template and adjusted in place — the list shell only.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/feed-screen.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * Same shape as every other list on this dashboard — see `bids/bids-screen.tsx`
 * for the line-by-line diff against Obytes, not repeated here.
 *
 * ⚠️ NO TAB ROW. Unlike `bids/` (status tabs) or `requests/` (type + status),
 * `SellerAuctionBidsPanel` — the real, live source (see `../types.ts` for why
 * that is NOT `SellerMyBids.tsx`, the file the plan named) — has no filter of
 * its own, just a flat paginated list. Adding tabs here would be inventing UI
 * the source does not have.
 *
 * ⚠️ FILTERED TO BATCHES WITH BID ACTIVITY, matching the web exactly
 * (`SellerBidDashboard.tsx:59-62`, `hasBidActivity()` here): "a batch nobody
 * bid on has none, so it doesn't belong in this list." A seller's OTHER
 * listings — the ones with zero bids — belong to a listings screen, not this
 * one; this dashboard has none built yet, so a listing with no bids is
 * currently only reachable from `/v2/listings`.
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';

import { EmptyState, SectionNote, Text, useTabBarReserve } from '@/features/v2/ui';
import { GUTTER, space } from '@/theme/v2';

import { SellerBidCard } from './seller-bid-card';
import { SELLER_BID_FIXTURE } from './__fixtures__/seller-bids';
import { hasBidActivity, type SellerBidBatch } from './types';

export function SellerBidsScreen() {
  const bottom = useTabBarReserve({ tabBar: false });

  // PHASE 1: no query, so no error state to hit yet.
  const isError = false;
  const allBatches: readonly SellerBidBatch[] = SELLER_BID_FIXTURE;

  const rows = useMemo(() => allBatches.filter(hasBidActivity), [allBatches]);

  const renderItem = useCallback(
    ({ item }: { item: SellerBidBatch }) => <SellerBidCard {...item} />,
    [],
  );

  if (isError) {
    return (
      <View style={styles.fill}>
        <SectionNote tone="danger">
          Your bids did not load. Pull to try again.
        </SectionNote>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Text variant="micro" color="inkSubtle" style={styles.count}>
        {rows.length === 1 ? '1 listing with bids' : `${rows.length} listings with bids`}
        {'  ·  Sample data — not connected'}
      </Text>

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(b) => String(b.batch_id)}
        contentContainerStyle={{ paddingBottom: bottom + space['8xl'] }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No bids yet"
            body="Once buyers start bidding on your listings, they will show up here."
            actionLabel="View my listings"
            onAction={() => router.push('/v2/listings')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: GUTTER },
  count: { marginTop: space.lg, marginBottom: space.lg },
});
