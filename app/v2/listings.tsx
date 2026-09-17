/**
 * My listings — the "See all" behind 6a Home's LIVE LISTINGS section.
 *
 * ⚠️ NOT IN THE CANVAS, for the same reason as `drafts.tsx`: 6a–6f and 7a–7e do
 * not include a listings list. Nothing is invented here — it is Home's LIVE
 * LISTINGS section without the two-row cap, on the same primitives and the same
 * wording helpers (`features/v2/listings/presentation.ts`).
 *
 *     [G] GREENBIDZ                                   EN   bell•
 *     My listings
 *     Everything you have published, and what it is doing.
 *
 *     [img]  KS Orbital Shaking Incubator OSI 500              ›
 *            In review
 *     ───────────────────────────────────────────────────────────
 *     [img]  ANEST IWATA SmartAir NitroLink Nitrogen Gen…       ›
 *            In review
 *
 * ── WHY THIS EXISTS: a measured defect, not a preference ──
 *
 * Home's "See all" pointed at `routes.labListings` = `/(lab)/(tabs)/listings`,
 * which is inside the OLD tab group. Measured on device 2026-09-17: the tab bar
 * there reads "Chat" with `99+` / `4` badges — v2's has neither. So a seller two
 * taps into v2 was silently handed the old app, and once inside that tab group
 * there is no visible way back to v2.
 *
 * That is the SAME defect already fixed once on this screen — the promo banner
 * used to do it, and `SellingPane` records the user's words: *"it goes into the
 * previous version while using it"*. Fixing it there and leaving it here would
 * have been fixing the symptom.
 *
 * DATA — read real, write later. `useRecentSubmissions` is the query Home
 * already uses, so arriving here reads the cache.
 *
 * ⚠️ EDIT IS DEFERRED. The old screen's whole reason for existing is
 * `MyListingsEditList` — an Edit action per listing. That is a write, and v2
 * defers writes; it also needs an edit surface that is not drawn.
 * `TODO(v2-writes)`. This screen is read + open-detail only.
 */
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ImageIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BrandBar,
  EmptyState,
  Hairline,
  Row,
  RowThumb,
  RowTrailing,
  Screen,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { GUTTER, control, icon, space, useV2Colors } from '@/theme/v2';
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { listingSubtitle, listingTitle, photoUri } from '@/features/v2/listings/presentation';
import { startV2Scan } from '@/features/v2/scan/startV2Scan';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';

/**
 * How many to ask for. The endpoint is paged; this is the page size, not a cap
 * on what the seller owns — `onEndReached` is NOT wired because the hook does
 * not expose a cursor. A seller with more than this many listings sees the most
 * recent page. `TODO(v2-paging)` — needs an infinite-query hook first, and
 * inventing one here would fork the source Home reads from.
 */
const PAGE = 50;

export default function V2Listings() {
  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  const isGuest = useIsGuest();
  const { unreadCount } = useLabNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const listings = useRecentSubmissions(PAGE, { enabled: !isGuest });
  const items = listings.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await listings.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [listings]);

  const header = (
    <BrandBar
      unread={unreadCount}
      onNotifications={() => {
        haptics.tap();
        requireAuth('notifications', () => router.push(routes.labNotifications));
      }}
    />
  );

  const title = (
    <View style={styles.titleRow}>
      <Text variant="display">My listings</Text>
      <Text variant="body" color="inkMuted" style={styles.titleSub}>
        Everything you have published, and what it is doing.
      </Text>
    </View>
  );

  const note = (() => {
    if (listings.isLoading) return <SectionNote>Fetching what you already have live…</SectionNote>;
    if (listings.isError) {
      return <SectionNote>Your listings did not load. Pull down to try again.</SectionNote>;
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title="Nothing live yet"
          body="Anything you publish shows up here with its offers, so you can see what is moving."
          actionLabel="Scan an item"
          onAction={() => {
            haptics.impact();
            startV2Scan();
          }}
        />
      );
    }
    return null;
  })();

  return (
    <Screen header={header} headerFlush scroll={false} testID="v2-listings">
      <FlatList
        data={note ? [] : items}
        keyExtractor={(b) => String(b.batchPk)}
        ListHeaderComponent={
          <>
            {title}
            {note}
          </>
        }
        contentContainerStyle={{ paddingBottom: control.tabBar + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />
        }
        ItemSeparatorComponent={Hairline}
        renderItem={({ item }) => (
          <Row
            title={listingTitle(item)}
            subtitle={listingSubtitle(item)}
            leading={
              <RowThumb uri={photoUri(item.thumbnailUrl)}>
                <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
              </RowThumb>
            }
            trailing={<RowTrailing />}
            onPress={() => {
              haptics.tap();
              router.push(routes.v2ListingDetail(item.batchPk));
            }}
            testID={`v2-listing-${item.batchPk}`}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: GUTTER, paddingTop: space['5xl'], paddingBottom: space['6xl'] },
  titleSub: { marginTop: space.lg, maxWidth: 300 },
});
