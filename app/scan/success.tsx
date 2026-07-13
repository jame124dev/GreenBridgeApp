import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, Stack, Text } from '@/components/ui';
import { CONDITION_LABELS, type ConditionKey } from '@/features/scanner/constants';
import { invalidateRecentSubmissions } from '@/features/scanner/invalidateRecentSubmissions';
import { routes } from '@/lib/routes';
import { IS_CUSTOMER } from '@/lib/flags';
import { useScanDraft } from '@/stores/scanDraftStore';
import { brand, colors } from '@/constants/theme';
import { shadows } from '@/theme/shadows';

type SuccessItem = { title: string; batchPk: number; batchNumber?: number };

type Snapshot = {
  photos: number;
  condition: string;
  price: string;
};

/**
 * S6.2.b1 — StyleSheet block removed. The `Card` primitive accepts a `style`
 * prop for the `shadows.sm` elevation (no className equivalent for shadow
 * tokens), and the `Card.Body` keeps its `style={{ padding: 16, gap: 0 }}`
 * because the Body API doesn't accept className. Everything else converts
 * cleanly to NativeWind classes.
 */
export default function SuccessScreen() {
  const { t } = useTranslation();
  const { batchPk, batchNumber, itemCount, groupId, items } = useLocalSearchParams<{
    batchPk?: string;
    batchNumber?: string;
    itemCount?: string;
    groupId?: string;
    items?: string;
  }>();
  const count = itemCount ? Number(itemCount) : 1;
  const isMulti = count > 1;
  const displayNumber = batchNumber ?? batchPk;
  const pk = batchPk ? Number(batchPk) : NaN;
  const displayGroupId = groupId ? Number(groupId) : null;
  const reset = useScanDraft((s) => s.reset);

  // Parse the per-item list (multi-product submissions only). Best-effort —
  // a malformed param shouldn't crash the success screen, just fall back
  // to the single-batch layout. URL-encoded JSON.
  const itemList = useMemo<SuccessItem[]>(() => {
    if (!items) return [];
    try {
      const parsed = JSON.parse(items);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (it): it is SuccessItem =>
            typeof it?.title === 'string' && typeof it?.batchPk === 'number',
        )
        .slice(0, 50);
    } catch {
      return [];
    }
  }, [items]);
  const hasItemList = isMulti && itemList.length > 0;

  const [snapshot] = useState<Snapshot | null>(() => {
    const draft = useScanDraft.getState().current;
    if (!draft) return null;
    const conditionText = draft.condition
      .map((k) =>
        t(`mobile.detail.condition.${k}`, {
          defaultValue: CONDITION_LABELS[k as ConditionKey] ?? k,
        }),
      )
      .join(', ');
    const priceText =
      draft.priceFormat === 'offer'
        ? t('mobile.success.makeOffer')
        : draft.pricePerUnit
          ? `${draft.priceCurrency} ${draft.pricePerUnit}`
          : '—';
    return {
      photos: draft.photos?.length ?? 0,
      condition: conditionText || '—',
      price: priceText,
    };
  });

  useEffect(() => {
    reset();
    void invalidateRecentSubmissions();
  }, [reset]);

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
      <View className="w-32 h-32 rounded-full bg-brand-primary-surface items-center justify-center mb-xl">
        <CheckCircle2 color={brand.primary} size={96} strokeWidth={2} />
      </View>
      <Text variant="hero">
        {isMulti
          ? t('mobile.success.headingMulti', {
              count,
              defaultValue: '{{count}} items submitted',
            })
          : t('mobile.success.heading')}
      </Text>
      <Text variant="bodyMd" tone="tertiary" className="text-center mt-sm px-sm leading-relaxed">
        {isMulti
          ? t('mobile.success.captionMulti', {
              defaultValue:
                'Sent to GreenBidz for review. All items go live within 24h after approval.',
            })
          : t('mobile.success.caption')}
      </Text>

      <Card style={{ width: '100%', marginTop: 28, ...shadows.sm }}>
        <Card.Body style={{ padding: 16, gap: 0 }}>
          <Stack gap="none">
            {displayGroupId != null && Number.isFinite(displayGroupId) ? (
              <SummaryRow
                label={t('mobile.success.rowGroup', { defaultValue: 'GROUP #' })}
                value={String(displayGroupId)}
                accent
              />
            ) : null}
            {isMulti ? (
              // Multi-product: lead with the count (accent), then a list of
              // every batch — each row tappable to open that listing detail.
              // No more "first batch only" hint; users see and can act on all.
              <>
                <SummaryRow
                  label={t('mobile.success.rowItems')}
                  value={t('mobile.success.itemsSubmittedTogether', { count })}
                  accent
                  last={!hasItemList && !displayNumber}
                />
                {hasItemList ? (
                  <View className="pt-md">
                    {itemList.map((it, idx) => (
                      <SubmittedItemRow
                        key={`${it.batchPk}-${idx}`}
                        index={idx + 1}
                        title={it.title}
                        batchNumber={
                          it.batchNumber != null ? String(it.batchNumber) : String(it.batchPk)
                        }
                        onPress={() => router.push(routes.listingDetail(it.batchPk))}
                        last={idx === itemList.length - 1}
                      />
                    ))}
                  </View>
                ) : displayNumber ? (
                  // Defensive fallback for older client builds that don't carry
                  // the items list through the route — show the first batch
                  // hint so the page isn't bare.
                  <SummaryRow
                    label={t('mobile.success.rowFirstBatch', {
                      defaultValue: 'FIRST BATCH #',
                    })}
                    value={String(displayNumber)}
                    last
                  />
                ) : null}
              </>
            ) : (
              // Single-product: the legacy layout.
              <>
                {displayNumber ? (
                  <SummaryRow
                    label={t('mobile.success.rowBatch')}
                    value={String(displayNumber)}
                    accent={displayGroupId == null}
                  />
                ) : null}
                {snapshot ? (
                  <>
                    <SummaryRow
                      label={t('mobile.success.rowPhotos')}
                      value={String(snapshot.photos)}
                    />
                    <SummaryRow
                      label={t('mobile.success.rowCondition')}
                      value={snapshot.condition}
                    />
                    <SummaryRow
                      label={t('mobile.success.rowPrice')}
                      value={snapshot.price}
                      last
                    />
                  </>
                ) : null}
              </>
            )}
          </Stack>
        </Card.Body>
      </Card>

      <View className="w-full mt-7">
        <Stack gap="xl">
          <Button
            label={t('mobile.success.captureNext')}
            onPress={() =>
              // Lab customers reach this flow via the chat upload hand-off
              // (launchSellerScan); send them back to the lab home, not the
              // seller tab group that scanHome (/(tabs)) points at.
              router.replace(IS_CUSTOMER ? '/(lab)/(tabs)/home' : routes.scanHome)
            }
            fullWidth
          />
          {Number.isFinite(pk) && pk > 0 ? (
            <Button
              label={
                hasItemList
                  ? t('mobile.success.viewInHistory', {
                      defaultValue: 'View all in History',
                    })
                  : isMulti
                    ? t('mobile.success.viewFirstBatch', {
                        defaultValue: 'View first batch',
                      })
                    : t('mobile.success.viewBatchSummary')
              }
              onPress={() =>
                router.push(
                  hasItemList ? routes.activityHistory : routes.listingDetail(pk),
                )
              }
              variant="secondary"
              fullWidth
            />
          ) : null}
        </Stack>
      </View>
    </Screen>
  );
}

/**
 * Per-item row on the multi-product success card. Mirrors the SummaryRow
 * spacing/typography but is fully tappable with a leading numeric badge and
 * a trailing chevron — visually a "receipt line" so the success card reads
 * as "here's the N things you just submitted, tap any to open it".
 */
function SubmittedItemRow({
  index,
  title,
  batchNumber,
  onPress,
  last,
}: {
  index: number;
  title: string;
  batchNumber: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}, batch ${batchNumber}`}
      className={`flex-row items-center py-md active:opacity-70 ${
        last ? '' : 'border-b border-brand-divider'
      }`}
    >
      <View
        className="w-7 h-7 rounded-full items-center justify-center mr-md"
        style={{ backgroundColor: brand.primarySurface }}
      >
        <Text
          variant="caption"
          className="font-bold"
          style={{ color: brand.primary }}
        >
          {index}
        </Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text
          variant="bodyMd"
          className="font-semi text-neutral-900"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text variant="caption" className="text-neutral-500 mt-[2px]">
          BATCH #{batchNumber}
        </Text>
      </View>
      <ChevronRight color={colors.neutral[400]} size={18} />
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row justify-between items-center py-md ${
        last ? '' : 'border-b border-brand-divider'
      }`}
    >
      <Text
        variant="caption"
        className="font-bold text-neutral-500 tracking-wider uppercase"
      >
        {label}
      </Text>
      <Text
        variant="bodyMd"
        numberOfLines={1}
        className={`font-semi flex-shrink ml-md text-right ${
          accent ? 'text-brand-primary' : 'text-neutral-900'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
