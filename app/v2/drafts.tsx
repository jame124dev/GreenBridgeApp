/**
 * My drafts — the "See all" behind 6a Home's DRAFTS section.
 *
 * Displays active drafts in the modern card design adapted from
 * `seller-bid-card.tsx` (left thumbnail with multi-item badge, flow label,
 * age chip, two-line title, and stats caption with tactile press feedback).
 *
 * DATA — `useListDrafts` is the same query Home uses, on the same key.
 *
 * RESUME — Tapping a card triggers `useResumeDraft` to jump into the editor.
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
import { useListDrafts } from '@/services/drafts/draftHooks';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import { openMultiItemDraft } from '@/features/v2/scan/openMultiItemDraft';
import { v2ResumeRoute } from '@/features/v2/scan/v2ResumeRoute';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import type { DraftSummary } from '@/services/drafts/draftApi';
import { startV2Scan, startV2TypeDetails } from '@/features/v2/scan/startV2Scan';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';
import { DraftCard } from '@/features/v2/drafts/draft-card';

export default function V2Drafts() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const reserve = useTabBarReserve();
  const isGuest = useIsGuest();
  const { unreadCount } = useLabNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const drafts = useListDrafts({ enabled: !isGuest, retry: 0 });
  const { resume, resumingId } = useResumeDraft(v2ResumeRoute, openMultiItemDraft);

  const items = (drafts.data?.drafts ?? []).filter((d) => d.status === 'active');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await drafts.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [drafts]);

  const onDraft = (d: DraftSummary) => {
    if (resumingId) return;
    requireAuth('draft', () => void resume(d.id));
  };

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
    if (drafts.isLoading) {
      return <SectionNote>{t('mobile.scanv2.drafts.loading')}</SectionNote>;
    }
    if (drafts.isError) {
      const status = (drafts.error as { response?: { status?: number } } | undefined)?.response
        ?.status;

      if (status === 401 || status === 403) {
        return (
          <EmptyState
            title={t('mobile.scanv2.common.sessionEndedTitle')}
            body={t('mobile.scanv2.drafts.sessionEndedBody')}
            actionLabel={t('mobile.scanv2.common.signIn')}
            onAction={() => {
              haptics.tap();
              requireAuth('draft', () => void drafts.refetch());
            }}
          />
        );
      }

      return (
        <SectionNote>{t('mobile.scanv2.drafts.loadError')}</SectionNote>
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title={t('mobile.scanv2.drafts.emptyTitle')}
          body={t('mobile.scanv2.drafts.emptyBody')}
          actionLabel={t('mobile.scanv2.common.scanAnItem')}
          onAction={() => {
            haptics.impact();
            startV2Scan();
          }}
          secondaryLabel={t('mobile.scanv2.common.typeDetails')}
          onSecondary={() => {
            haptics.tap();
            startV2TypeDetails();
          }}
        />
      );
    }
    return null;
  })();

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Text variant="display">{t('mobile.scanv2.drafts.title')}</Text>
        <Text variant="body" color="inkMuted" style={styles.titleSub}>
          {t('mobile.scanv2.drafts.subtitle')}
        </Text>
      </View>
      {note ? (
        note
      ) : (
        <Text variant="micro" color="inkSubtle" style={styles.count}>
          {items.length === 1 ? '1 active draft' : `${items.length} active drafts`}
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
      testID="v2-drafts"
    >
      <FlashList
        data={note ? [] : items}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <DraftCard
            draft={item}
            isResuming={resumingId === item.id}
            onPress={() => onDraft(item)}
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
