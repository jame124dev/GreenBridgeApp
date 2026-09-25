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
 * | `usePosts()` | `INSPECTION_FIXTURE` | PHASE 1 is UI only (`Docs/Dashboard/buyer/inspections/phase-2-api.md`) |
 * | `keyExtractor` by index | by `batch_id` | a filtered list recycles rows |
 * | `<EmptyList isLoading>` | our `EmptyState` | an empty state must carry the action that FILLS it |
 * | `<Text>Error Loading data</Text>` | `SectionNote tone="danger"` | a message that says what to do next |
 * | `FocusAwareStatusBar` | — | `Screen` owns the status bar |
 * | `className="flex-1"` | `styles.fill` | NativeWind fails `v2Adherence` |
 *
 * The tab row is `bids/material-tab-bar.tsx` — already copied from
 * react-native-collapsible-tab-view (MIT) for the bids screen, reused rather
 * than copied a second time. It is the same control doing the same job, and a
 * second copy would be the drift the kit rules exist to prevent. If a third
 * screen wants it, it should move into `features/v2/ui/` as a KIT GAP.
 *
 * ── THE FILTER IS CLIENT-SIDE HERE AND MUST NOT STAY THAT WAY ──
 *
 * The web sends `status` to the server and resets to page 1
 * (`MyInspections.tsx:120-127`); the pagination totals come back describing
 * the FILTERED set. Filtering a fixture in the client is a phase-1 stand-in
 * only. Phase 2 sends the param — see `INSPECTIONS_LIMIT` in `./types.ts`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';

import { EmptyState, SectionNote, Text, useTabBarReserve, type TabItem } from '@/features/v2/ui';
import { MaterialTabBar } from '@/features/v2/bids/material-tab-bar';
import { GUTTER, MIN_TOUCH, space } from '@/theme/v2';

import { InspectionCard } from './inspection-card';
import { useInspections } from './useInspections';
import {
  INSPECTION_FILTERS,
  type InspectionFilter,
  type InspectionItem,
} from './types';

export function InspectionsScreen() {
  const [filter, setFilter] = useState<InspectionFilter>('all');
  const [tabsWidth, setTabsWidth] = useState(0);
  const bottom = useTabBarReserve({ tabBar: false });

  /**
   * PHASE 2 — the real endpoint, with `status` sent to the SERVER. The filter
   * is an argument, so switching tabs refetches rather than re-slicing.
   */
  const { data, isPending, isError, refetch, isRefetching } = useInspections(filter);
  const rows: readonly InspectionItem[] = data?.rows ?? [];

  const tabs: readonly TabItem<InspectionFilter>[] = INSPECTION_FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
  }));

  const renderItem = useCallback(
    ({ item }: { item: InspectionItem }) => <InspectionCard {...item} />,
    [],
  );

  if (isError) {
    return (
      <View style={styles.fill}>
        <SectionNote tone="danger" actionLabel="Try again" onAction={() => refetch()}>
          Your inspections did not load.
        </SectionNote>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/* Measured, not `windowWidth - 2*GUTTER` — see the bids screen. */}
      <View style={styles.tabsSlot} onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}>
        {tabsWidth > 0 && (
          <MaterialTabBar items={tabs} value={filter} onChange={setFilter} width={tabsWidth} />
        )}
      </View>

      {/*
        The count, as the web has it ("N inspections registered"). It is a fact
        about the list, not a subtitle explaining what an inspection is.
      */}
      {/*
        The SERVER's total, not `rows.length` — with `limit` in play those are
        different numbers, and the web shows the total too ("N inspections
        registered"). Printing the page size as if it were the total is how a
        paginated list quietly lies.
      */}
      <Text variant="micro" color="inkSubtle" style={styles.count}>
        {isPending
          ? 'Loading your inspections…'
          : (data?.total ?? rows.length) === 1
            ? '1 inspection'
            : `${data?.total ?? rows.length} inspections`}
      </Text>

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(i) => String(i.batch_id)}
        contentContainerStyle={{ paddingBottom: bottom + space['8xl'] }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          isPending ? null : (
            <EmptyState
              title={filter === 'all' ? 'No inspections yet' : 'Nothing completed yet'}
              body={
                filter === 'all'
                  ? 'Register for a site visit on a lot and it will show up here, with the date.'
                  : 'Inspections you have attended will be listed here.'
              }
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
  fill: { flex: 1, paddingHorizontal: GUTTER },
  /** Reserves the bar's height before the measure lands, so nothing jumps. */
  tabsSlot: { marginTop: space.md, height: MIN_TOUCH },
  count: { marginTop: space.lg, marginBottom: space.lg },
});
