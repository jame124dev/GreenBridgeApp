/**
 * My listings — the "See all" behind 6a Home's LIVE LISTINGS section.
 *
 * Displays published batches in the modern card design adapted from
 * `seller-bid-card.tsx` (left thumbnail with multi-item badge, batch reference
 * number, status chip, two-line title, and commercial summary line with
 * tactile press feedback).
 *
 * DATA — `useRecentSubmissions` is the query Home already uses, so arriving
 * here reads the cache.
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import {
  BrandBar,
  EmptyState,
  Screen,
  SectionNote,
  Text,
  useTabBarReserve,
} from '@/features/v2/ui';
import { GUTTER, space, useV2Colors } from '@/theme/v2';
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { startV2Scan } from '@/features/v2/scan/startV2Scan';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';
import { ListingCard } from '@/features/v2/listings/listing-card';

const PAGE = 50;

export default function V2Listings() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const reserve = useTabBarReserve();
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

  const note = (() => {
    if (listings.isLoading) return <SectionNote>{t('mobile.scanv2.listings.loading')}</SectionNote>;
    if (listings.isError) {
      const status = (listings.error as { response?: { status?: number } } | undefined)?.response
        ?.status;

      if (status === 401 || status === 403) {
        return (
          <EmptyState
            title={t('mobile.scanv2.common.sessionEndedTitle')}
            body={t('mobile.scanv2.listings.sessionEndedBody')}
            actionLabel={t('mobile.scanv2.common.signIn')}
            onAction={() => {
              haptics.tap();
              requireAuth('draft', () => void listings.refetch());
            }}
          />
        );
      }

      return <SectionNote>{t('mobile.scanv2.listings.loadError')}</SectionNote>;
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title={t('mobile.scanv2.listings.emptyTitle')}
          body={t('mobile.scanv2.listings.emptyBody')}
          actionLabel={t('mobile.scanv2.common.scanAnItem')}
          onAction={() => {
            haptics.impact();
            startV2Scan();
          }}
        />
      );
    }
    return null;
  })();

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Text variant="display">{t('mobile.scanv2.listings.title')}</Text>
        <Text variant="body" color="inkMuted" style={styles.titleSub}>
          {t('mobile.scanv2.listings.subtitle')}
        </Text>
      </View>
      {note ? (
        note
      ) : (
        <Text variant="micro" color="inkSubtle" style={styles.count}>
          {items.length === 1 ? '1 listing' : `${items.length} listings`}
        </Text>
      )}
    </View>
  );

  return (
    <Screen
      header={header}
      headerFlush
      scroll={false}
      contentStyle={styles.fill}
      testID="v2-listings"
    >
      <FlashList
        data={note ? [] : items}
        keyExtractor={(b) => String(b.batchPk)}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={() => {
              haptics.tap();
              router.push(routes.v2ListingDetail(item.batchPk));
            }}
          />
        )}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingBottom: reserve + space['8xl'],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerBlock: {
    paddingTop: space['5xl'],
    paddingBottom: space.lg,
  },
  titleRow: {
    marginBottom: space.lg,
  },
  titleSub: {
    marginTop: space.sm,
    maxWidth: 300,
  },
  count: {
    marginTop: space.sm,
    marginBottom: space.lg,
  },
});
