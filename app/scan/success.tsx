import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, Stack, Text } from '@/components/ui';
import { CONDITION_LABELS, type ConditionKey } from '@/features/scanner/constants';
import { invalidateRecentSubmissions } from '@/features/scanner/invalidateRecentSubmissions';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';
import { shadows } from '@/theme/shadows';

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
  const { batchPk, batchNumber, itemCount, groupId } = useLocalSearchParams<{
    batchPk?: string;
    batchNumber?: string;
    itemCount?: string;
    groupId?: string;
  }>();
  const count = itemCount ? Number(itemCount) : 1;
  const displayNumber = batchNumber ?? batchPk;
  const pk = batchPk ? Number(batchPk) : NaN;
  const displayGroupId = groupId ? Number(groupId) : null;
  const reset = useScanDraft((s) => s.reset);

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
      <Text variant="hero">{t('mobile.success.heading')}</Text>
      <Text variant="bodyMd" tone="tertiary" className="text-center mt-sm px-sm leading-relaxed">
        {t('mobile.success.caption')}
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
                <SummaryRow label={t('mobile.success.rowPrice')} value={snapshot.price} />
              </>
            ) : null}
            {count > 1 ? (
              <SummaryRow
                label={t('mobile.success.rowItems')}
                value={t('mobile.success.itemsSubmittedTogether', { count })}
                last
              />
            ) : null}
          </Stack>
        </Card.Body>
      </Card>

      <View className="w-full mt-7">
        <Stack gap="xl">
          <Button
            label={t('mobile.success.captureNext')}
            onPress={() => router.replace(routes.scanHome)}
            fullWidth
          />
          {Number.isFinite(pk) && pk > 0 ? (
            <Button
              label={t('mobile.success.viewBatchSummary')}
              onPress={() => router.push(routes.listingDetail(pk))}
              variant="secondary"
              fullWidth
            />
          ) : null}
        </Stack>
      </View>
    </Screen>
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
