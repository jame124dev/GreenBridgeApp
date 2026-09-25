import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

import {
  Chip,
  EmptyState,
  Hairline,
  PrimaryAction,
  QuietAction,
  Row,
  RowThumb,
  RowTrailing,
  Screen,
  SectionHeader,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { GUTTER, SECTION_GAP, icon, space } from '@/theme/v2';
import { useV2Colors } from '@/theme/v2/ThemeProvider';
import {
  draftItemThumbUri,
  listAllDraftItems,
  type DraftItem,
} from '@/services/drafts/draftItemsApi';
import { usePublishDraft } from '@/features/v2/scan/review/usePublishDraft';
import { reviewStepLabel, type ReviewStep } from '@/features/v2/scan/review/wizardState';
import { openDetectedItem } from '@/features/v2/scan/openDetectedItem';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner-native';

function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
}

/**
 * See the note in `valuation.tsx`: `thumbnail_object` is a GCS object name on a
 * resumed SERVER draft and a `file://` URI on the LOCAL lane, so it cannot go
 * straight to `gcsUrlForAnalyze` without drawing a broken tile on every
 * freshly-scanned row. `draftItemThumbUri` handles both.
 */
const thumbUri = draftItemThumbUri;

const MARKETPLACE_LABELS: Record<string, string> = {
  '101lab': '101Lab (Laboratory)',
  '101machine': '101Machine (Industrial)',
  '101it': '101IT (Electronics)',
  '101recycle': '101Recycle (Scrap/Waste)',
};

function getMarketplaceLabel(m: string | null | undefined): string {
  if (!m) return 'Unassigned Marketplace';
  return MARKETPLACE_LABELS[m.toLowerCase()] || m.toUpperCase();
}

export default function V2Submit() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ draftId?: string }>();
  const draftId = typeof params.draftId === 'string' ? params.draftId : '';
  const c = useV2Colors();

  const items = useQuery({
    queryKey: ['draftItems', draftId],
    queryFn: () => listAllDraftItems(draftId, { filter: 'all' }),
    enabled: !!draftId,
    retry: retryUnlessClientError,
  });

  const publish = usePublishDraft();
  const [openingId, setOpeningId] = useState<number | null>(null);

  const handlePressItem = useCallback(async (itemId: number) => {
    if (openingId != null) return;
    setOpeningId(itemId);
    haptics.tap();
    try {
      await openDetectedItem(draftId, itemId);
    } catch (err) {
      toast.error(t('mobile.scanv2.items.openFailed', { defaultValue: 'Could not open this item' }));
    } finally {
      setOpeningId(null);
    }
  }, [draftId, openingId, t]);

  const rows = useMemo(() => {
    const raw = items.data ?? [];
    return raw.filter((r) => r.status === 'accepted');
  }, [items.data]);

  // Group items by marketplace
  const groups = useMemo(() => {
    const map = new Map<string, DraftItem[]>();
    for (const item of rows) {
      const key = item.marketplace || 'unassigned';
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    }
    return [...map.entries()].map(([key, list]) => ({
      key,
      label: getMarketplaceLabel(key === 'unassigned' ? null : key),
      items: list,
    }));
  }, [rows]);

  const handleSubmit = useCallback(() => {
    haptics.tap();
    publish.publish();
  }, [publish]);

  const handleGoToStep = useCallback(
    async (itemIndex: number, step: ReviewStep) => {
      if (itemIndex < 0 || itemIndex >= rows.length) return;
      const targetItem = rows[itemIndex];
      if (targetItem) {
        await handlePressItem(targetItem.id);
      }
    },
    [rows, handlePressItem],
  );

  if (!draftId) {
    return (
      <Screen tabBar={false}>
        <EmptyState
          title={t('mobile.scanv2.items.noDraftTitle', { defaultValue: 'No draft selected' })}
          body={t('mobile.scanv2.items.noDraftBody', { defaultValue: 'Please select a valid draft to review.' })}
          actionLabel={t('mobile.scanv2.items.backHome', { defaultValue: 'Back to Home' })}
          onAction={() => router.replace('/v2')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      tabBar={false}
      footer={
        rows.length > 0 ? (
          <View style={styles.footer}>
            <PrimaryAction
              label={publish.isPending ? 'Submitting…' : t('mobile.scanv2.submit.publishButton', { count: rows.length, defaultValue: 'Publish {{count}} Listing(s)' })}
              onPress={handleSubmit}
              disabled={publish.isPending}
              icon={<Check size={icon.xl} color={c.onAccent} strokeWidth={2} />}
            />
            <QuietAction
              label={t('mobile.scanv2.submit.backToValuation', { defaultValue: 'Back to Valuation' })}
              onPress={() => router.push({ pathname: '/v2/scan/valuation', params: { draftId } } as never)}
              disabled={publish.isPending}
            />
          </View>
        ) : undefined
      }
    >
      <SectionHeader title={t('mobile.scanv2.submit.title', { defaultValue: 'Review & Submit' })} />
      <Text variant="body" color="inkMuted" style={styles.lede}>
        {t('mobile.scanv2.submit.lede', { defaultValue: 'These listings are ready to publish. Please review and confirm their destinations before publishing.' })}
      </Text>

      {/* Blocked or Error notices */}
      {publish.blocked ? (
        <SectionNote
          tone="danger"
          actionLabel={`Go to ${reviewStepLabel(publish.blocked.step)}`}
          onAction={() => handleGoToStep(publish.blocked!.itemIndex, publish.blocked!.step)}
        >
          {publish.blocked.itemTotal > 1
            ? `Item ${publish.blocked.itemIndex + 1} of ${publish.blocked.itemTotal} is not ready — ${publish.blocked.needs.toLowerCase()}.`
            : `${publish.blocked.needs}.`}
        </SectionNote>
      ) : publish.error ? (
        <SectionNote tone="danger" actionLabel="Dismiss" onAction={publish.clear}>
          {publish.error}
        </SectionNote>
      ) : null}

      <View style={styles.gap} />

      {items.isLoading ? (
        <SectionNote>{t('mobile.scanv2.items.loading')}</SectionNote>
      ) : items.isError ? (
        <SectionNote
          tone="danger"
          actionLabel={t('mobile.scanv2.items.tryAgain')}
          onAction={() => void items.refetch()}
        >
          {t('mobile.scanv2.items.loadError')}
        </SectionNote>
      ) : rows.length === 0 ? (
        <SectionNote>{t('mobile.scanv2.valuation.emptyBody', { defaultValue: 'No accepted items to publish.' })}</SectionNote>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <SectionHeader title={group.label} tone="muted" />
            <View style={styles.groupList}>
              {group.items.map((item, i) => (
                <React.Fragment key={item.id}>
                  {i > 0 ? <Hairline /> : null}
                  <Row
                    title={item.title ?? `Item ${item.seq + 1}`}
                    titleLines={1}
                    subtitle={item.brand ? `${item.brand} · ${item.model}` : undefined}
                    onPress={() => handlePressItem(item.id)}
                    leading={<RowThumb uri={thumbUri(item)} />}
                    trailing={
                      <RowTrailing
                        chevron={openingId !== item.id}
                        value={openingId === item.id ? 'Opening…' : undefined}
                      />
                    }
                  />
                </React.Fragment>
              ))}
            </View>
            <View style={styles.gap} />
          </View>
        ))
      )}

      <View style={styles.gap} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { paddingHorizontal: GUTTER, marginTop: space.md },
  group: { marginTop: space.md },
  groupList: { gap: space.xs },
  gap: { height: SECTION_GAP },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    paddingBottom: space['3xl'],
    gap: space.xs,
  },
});
