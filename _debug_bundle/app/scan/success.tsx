import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, Stack } from '@/components/ui';
import { CONDITION_LABELS, type ConditionKey } from '@/features/scanner/constants';
import { invalidateRecentSubmissions } from '@/features/scanner/invalidateRecentSubmissions';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';
import { colors, fonts, fontSize, letterSpacing, lineHeight, radius, shadows, spacing } from '@/theme';

type Snapshot = {
  photos: number;
  condition: string;
  price: string;
};

export default function SuccessScreen() {
  const { t } = useTranslation();
  const { batchPk, batchNumber, itemCount } = useLocalSearchParams<{
    batchPk?: string;
    batchNumber?: string;
    itemCount?: string;
  }>();
  const count = itemCount ? Number(itemCount) : 1;
  const displayNumber = batchNumber ?? batchPk;
  const pk = batchPk ? Number(batchPk) : NaN;
  const reset = useScanDraft((s) => s.reset);

  // Capture the draft summary BEFORE reset wipes it. Lazy init runs once on
  // first render and is read-only thereafter.
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
    <Screen contentContainerStyle={styles.scroll}>
      <View style={styles.checkWrap}>
        <CheckCircle2 color={colors.primary} size={96} strokeWidth={2} />
      </View>
      <Text style={styles.title}>{t('mobile.success.heading')}</Text>
      <Text style={styles.caption}>{t('mobile.success.caption')}</Text>

      <Card style={styles.summaryCard}>
        <Card.Body style={styles.summaryBody}>
          <Stack gap="none">
            {displayNumber ? (
              <SummaryRow
                label={t('mobile.success.rowBatch')}
                value={String(displayNumber)}
                accent
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

      <Stack gap="xl" style={styles.actions}>
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
    <View style={[styles.summaryRow, last && styles.summaryRowLast]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[styles.summaryValue, accent && styles.summaryValueAccent]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  checkWrap: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['5xl'],
  },
  title: { fontFamily: fonts.heading, fontSize: fontSize['8xl'], color: colors.foreground },
  caption: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xl,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    lineHeight: lineHeight.relaxed,
  },
  summaryCard: { width: '100%', marginTop: spacing['7xl'], ...shadows.sm },
  summaryBody: { padding: spacing['3xl'], gap: 0, letterSpacing: letterSpacing.none },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    letterSpacing: letterSpacing.capsTight,
  },
  summaryValue: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    color: colors.foreground,
    flexShrink: 1,
    marginLeft: spacing.xl,
    textAlign: 'right',
  },
  summaryValueAccent: { color: colors.primary, borderRadius: radius.xs },
  actions: { width: '100%', marginTop: spacing['7xl'] },
});
