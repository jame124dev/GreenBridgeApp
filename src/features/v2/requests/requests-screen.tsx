/**
 * COPIED from the Obytes template and adjusted in place — the list shell only.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/feed-screen.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * Same `FlashList` + memoised `renderItem` + `keyExtractor` + `ListEmptyComponent`
 * shape as `bids/bids-screen.tsx` and `inspections/inspections-screen.tsx`.
 * Not re-explained here — see either for the line-by-line diff against Obytes.
 *
 * ── TWO FILTER DIMENSIONS, NOT ONE ──
 *
 * `BuyerRequests.tsx` has TYPE tabs (All/Buy Now/Offers, `:296-320`) AND a
 * separate status dropdown (`:322-350`) that narrows further — the web's own
 * comment says why they are not the same control: "status narrows first, so
 * the tab pills count what the tab would ACTUALLY show."
 *
 * Two EXISTING kit controls, not one invented: `MaterialTabBar`
 * (`bids/material-tab-bar.tsx`, reused a third time — bold, sliding, the
 * PRIMARY filter) for type, and `Tabs` (`ui/Tabs.tsx`, quieter underline
 * strip) for the status bucket. That pairing gives the two dimensions
 * different visual weight, which is the point — type is "what kind", status
 * is "narrow further", and they should not look like the same choice twice.
 * `Tabs` has no built-in scroll and up to 7 buckets do not fit one screen
 * width, so it is wrapped in a plain horizontal `ScrollView` — the same thing
 * `MaterialTabBar`'s `scrollEnabled` path does, simpler because there is no
 * sliding indicator to track.
 *
 * ⚠️ **`availableBuckets` — only offer buckets that occur in the data.**
 * `BuyerRequests.tsx:98-105`: "no dead filter options." A phase-1 fixture
 * deliberately includes every bucket so this can be shown working; do not
 * read that as proof every bucket will always be present on real data.
 *
 * ── PHASE 1 ONLY: TWO FIXTURES MERGED CLIENT-SIDE, NOT TWO QUERIES ──
 *
 * Phase 2 replaces this with `useGetMyOrdersQuery` + `useGetUserOffersQuery`
 * run in parallel (`BuyerRequests.tsx:150-151`), with the web's partial-load
 * handling: only a fully-empty screen gets the blocking spinner, a
 * half-loaded one shows what it has plus a quiet note about what is still
 * arriving. Not built here — there is no network in phase 1.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';

import {
  EmptyState,
  SectionNote,
  Tabs,
  Text,
  useTabBarReserve,
  type TabItem,
} from '@/features/v2/ui';
import { MaterialTabBar } from '@/features/v2/bids/material-tab-bar';
import { GUTTER, MIN_TOUCH, space } from '@/theme/v2';

import { RequestCard } from './request-card';
import { ORDER_FIXTURE, OFFER_FIXTURE } from './__fixtures__/requests';
import {
  orderToRequestItem,
  offerToRequestItem,
  REQUEST_BUCKETS,
  REQUEST_TYPES,
  type RequestBucket,
  type RequestItem,
  type RequestKind,
} from './types';

type TypeFilter = 'all' | RequestKind;
type BucketFilter = 'all' | RequestBucket;

export function RequestsScreen() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all');
  const [tabsWidth, setTabsWidth] = useState(0);
  const bottom = useTabBarReserve({ tabBar: false });

  // PHASE 1: no query, so no error state to hit yet. Kept as the shape
  // phase 2 fills in — see the route file for what plugs in.
  const isError = false;

  /** `BuyerRequests.tsx:163-193` — merged and sorted by date, newest first. */
  const rows: RequestItem[] = useMemo(() => {
    const orders = ORDER_FIXTURE.map(orderToRequestItem);
    const offers = OFFER_FIXTURE.map(offerToRequestItem);
    return [...orders, ...offers].sort(
      (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
    );
  }, []);

  const typeTabs: readonly TabItem<TypeFilter>[] = REQUEST_TYPES.map((t) => ({
    value: t.value,
    label: t.label,
    count: rows.filter((r) => t.value === 'all' || r.kind === t.value).length,
  }));

  /** Status narrows first, so the type-tab counts reflect it — `:220-226`. */
  const statusFiltered = useMemo(
    () => (bucketFilter === 'all' ? rows : rows.filter((r) => r.bucket === bucketFilter)),
    [rows, bucketFilter],
  );

  const visible = useMemo(
    () =>
      typeFilter === 'all' ? statusFiltered : statusFiltered.filter((r) => r.kind === typeFilter),
    [statusFiltered, typeFilter],
  );

  /** Only the buckets present in the data — `:98-105`, "no dead filter options". */
  const bucketTabs: readonly TabItem<BucketFilter>[] = useMemo(() => {
    const present = new Set(rows.map((r) => r.bucket));
    const all: TabItem<BucketFilter> = { value: 'all', label: 'All', count: rows.length };
    const rest = REQUEST_BUCKETS.filter((b) => present.has(b.value)).map((b) => ({
      value: b.value as BucketFilter,
      label: b.label,
      count: rows.filter((r) => r.bucket === b.value).length,
    }));
    return [all, ...rest];
  }, [rows]);

  const renderItem = useCallback(
    ({ item }: { item: RequestItem }) => <RequestCard {...item} />,
    [],
  );

  if (isError) {
    return (
      <View style={styles.fill}>
        <SectionNote tone="danger">
          Your orders did not load. Pull to try again.
        </SectionNote>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/* Primary filter: what kind. Measured, not computed — see bids screen. */}
      <View style={styles.tabsSlot} onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}>
        {tabsWidth > 0 && (
          <MaterialTabBar items={typeTabs} value={typeFilter} onChange={setTypeFilter} width={tabsWidth} />
        )}
      </View>

      {/*
        Secondary filter: narrow further. Deliberately quieter than the type
        row.

        ⚠️ THE HEIGHT MUST BE ON A WRAPPING `View`, NOT ON THE `ScrollView`'S
        OWN `style`. That was the first fix tried here and it did not work —
        confirmed in the bundle (`height: _themeV.MIN_TOUCH` was really
        there) and still measured 314px on screen. `MaterialTabBar` above
        uses exactly this wrapper (`tabsSlot`); mirrored here rather than
        re-deriving it, once the ScrollView's OWN `style` prop was shown not
        to be enough.
      */}
      {bucketTabs.length > 1 ? (
        <View style={styles.bucketSlot}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bucketContent}
          >
            <Tabs items={bucketTabs} value={bucketFilter} onChange={setBucketFilter} />
          </ScrollView>
        </View>
      ) : null}

      <Text variant="micro" color="inkSubtle" style={styles.count}>
        {visible.length === 1 ? '1 request' : `${visible.length} requests`}
        {'  ·  Sample data — not connected'}
      </Text>

      <FlashList
        data={visible}
        renderItem={renderItem}
        keyExtractor={(r) => r.rowId}
        contentContainerStyle={{ paddingBottom: bottom + space['8xl'] }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title={bucketFilter !== 'all' ? 'Nothing matches this filter' : 'Nothing here yet'}
            body={
              bucketFilter !== 'all'
                ? 'Try All statuses to see everything you have bought or offered on.'
                : 'Your Buy Now purchases and offers will appear here.'
            }
            actionLabel="Browse equipment"
            onAction={() => router.push('/v2/browse')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: GUTTER },
  tabsSlot: { marginTop: space.md, height: MIN_TOUCH },
  /**
   * The wrapper that actually constrains the row — see the note at the call
   * site for why the height lives here and not on the `ScrollView` itself.
   * Without it, on web the scroll row inherits `alignItems: stretch` from the
   * flex-column ancestor (the screen's `fill` View) and stretches to fill
   * whatever vertical space is left — measured at **306–314px** instead of
   * ~44px, pushing the count line and the list down by 250px+ of dead green.
   */
  bucketSlot: { height: MIN_TOUCH, marginTop: space.lg, marginHorizontal: -GUTTER },
  bucketContent: { paddingHorizontal: GUTTER },
  count: { marginTop: space.lg, marginBottom: space.lg },
});
