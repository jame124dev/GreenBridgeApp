import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
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
  getDraftItemCounts,
  listAllDraftItems,
  type DraftItem,
} from '@/services/drafts/draftItemsApi';
import { formatBand, formatMoney, summariseItems, parseBand } from '@/features/v2/scan/valuationSummary';
import { buildValuationView } from '@/features/v2/scan/valuationView';
import { haptics } from '@/lib/haptics';
import { openDetectedItem } from '@/features/v2/scan/openDetectedItem';
import { toast } from 'sonner-native';
import { CONDITION_LABELS, type ConditionKey } from '@/features/scanner/constants';

function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
}

/**
 * `thumbnail_object` means two things now, so it cannot go straight to
 * `gcsUrlForAnalyze`. A resumed SERVER draft stores a GCS object name; a fresh
 * scan on the LOCAL lane stores the photo's own `file://` URI. Piping the
 * latter through the GCS resolver produces
 * `/gcs/serve?path=file%3A%2F%2F…` — a request that cannot succeed, drawn as a
 * broken tile. `draftItemThumbUri` passes an already-addressable URI through
 * untouched and resolves only bare object names.
 */
const thumbUri = draftItemThumbUri;

function specLine(item: DraftItem): string | undefined {
  const cond = item.condition?.[0] as ConditionKey | undefined;
  const parts = [
    item.brand,
    item.model,
    item.year,
    cond ? CONDITION_LABELS[cond] : undefined,
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(' · ') : undefined;
}

export default function V2Valuation() {
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

  const [openingId, setOpeningId] = useState<number | null>(null);

  const handlePress = useCallback(async (itemId: number) => {
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

  const handleContinue = useCallback(() => {
    haptics.tap();
    router.push({ pathname: '/v2/scan/submit', params: { draftId } } as never);
  }, [draftId]);

  if (!draftId) {
    return (
      <Screen tabBar={false}>
        <EmptyState
          title={t('mobile.scanv2.items.noDraftTitle', { defaultValue: 'No draft selected' })}
          body={t('mobile.scanv2.items.noDraftBody', { defaultValue: 'Please select a valid draft to view valuations.' })}
          actionLabel={t('mobile.scanv2.items.backHome', { defaultValue: 'Back to Home' })}
          onAction={() => router.replace('/v2')}
        />
      </Screen>
    );
  }

  const valuation = summariseItems(rows);
  const view = buildValuationView(rows);

  return (
    <Screen
      tabBar={false}
      footer={
        rows.length > 0 ? (
          <View style={styles.footer}>
            <PrimaryAction
              label={t('mobile.scanv2.valuation.continue', { defaultValue: 'Continue to Review' })}
              onPress={handleContinue}
              icon={<ArrowRight size={icon.xl} color={c.onAccent} strokeWidth={2} />}
            />
            <QuietAction
              label={t('mobile.scanv2.valuation.backToItems', { defaultValue: 'Back to Detected Items' })}
              onPress={() => router.push({ pathname: '/v2/scan/items', params: { draftId } } as never)}
            />
          </View>
        ) : undefined
      }
    >
      <SectionHeader title={t('mobile.scanv2.valuation.title', { defaultValue: 'Valuation & Suggested Path' })} />
      <Text variant="body" color="inkMuted" style={styles.lede}>
        {t('mobile.scanv2.valuation.lede', { defaultValue: 'Review our pricing estimates and recommended recovery paths for your accepted equipment.' })}
      </Text>

      {rows.length > 0 ? (
        <View style={styles.totals}>
          <Text variant="eyebrow" color="inkMuted">
            {t('mobile.scanv2.valuation.totalsHeadline', { count: rows.length, defaultValue: 'VALUATION TOTALS · {{count}} ACCEPTED' })}
          </Text>

          {valuation.mixedCurrency ? (
            <>
              <Text variant="body" color="inkMuted" style={styles.totalLine}>
                {t('mobile.scanv2.items.mixedCurrency')}
              </Text>
              {view.subtotals?.map((s) => (
                <Text key={s.currency || 'none'} variant="bodyMedium" style={styles.totalLine}>
                  {s.currency
                    ? t('mobile.scanv2.items.subtotal', { total: s.total, count: s.count })
                    : t('mobile.scanv2.items.noCurrency', { count: s.count })}
                </Text>
              ))}
            </>
          ) : (
            <>
              {valuation.askingTotal !== null ? (
                <Text variant="h2" style={styles.totalLine}>
                  {formatMoney(valuation.askingTotal, valuation.currency)}
                </Text>
              ) : null}
              {valuation.fmv ? (
                <Text variant="caption" color="inkMuted" style={styles.totalLine}>
                  {t('mobile.scanv2.items.marketEstimate', {
                    band: formatBand(valuation.fmv, valuation.currency),
                  })}
                </Text>
              ) : null}
              {valuation.scrap ? (
                <Text variant="caption" color="inkMuted" style={styles.totalLine}>
                  {t('mobile.scanv2.items.scrapFloor', {
                    band: formatBand(valuation.scrap, valuation.currency),
                  })}
                </Text>
              ) : null}
            </>
          )}
        </View>
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
        <SectionNote>{t('mobile.scanv2.valuation.emptyBody', { defaultValue: 'No accepted items to value.' })}</SectionNote>
      ) : (
        rows.map((item, i) => {
          const fmvBand = parseBand(item.fmv_used);
          const usedVal = fmvBand ? formatBand(fmvBand, item.currency) : '';
          const scrapBandObj = parseBand(item.scrap_value);
          const scrapVal = scrapBandObj ? formatBand(scrapBandObj, item.currency) : '';
          const hasFmv = !!usedVal;

          return (
            <React.Fragment key={item.id}>
              {i > 0 ? <Hairline /> : null}
              <Row
                title={item.title ?? `Item ${item.seq + 1}`}
                titleLines={2}
                subtitle={
                  hasFmv
                    ? t('mobile.scanv2.valuation.productVal', { val: usedVal, defaultValue: 'Est: {{val}}' })
                    : scrapVal
                    ? t('mobile.scanv2.valuation.scrapVal', { val: scrapVal, defaultValue: 'Scrap Floor: {{val}}' })
                    : t('mobile.scanv2.detected.noEstimate')
                }
                meta={specLine(item)}
                onPress={() => handlePress(item.id)}
                leading={<RowThumb uri={thumbUri(item)} />}
                trailing={
                  <RowTrailing
                    chevron={openingId !== item.id}
                    value={openingId === item.id ? 'Opening…' : hasFmv ? 'Product' : 'Scrap'}
                    chip={hasFmv ? 'PRODUCT' : 'SCRAP'}
                  />
                }
              />
            </React.Fragment>
          );
        })
      )}

      <View style={styles.gap} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { paddingHorizontal: GUTTER, marginTop: space.md },
  totals: {
    paddingHorizontal: GUTTER,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    gap: space.xs,
  },
  totalLine: { marginTop: space.xs },
  gap: { height: SECTION_GAP },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    paddingBottom: space['3xl'],
    gap: space.xs,
  },
  centred: { textAlign: 'center', marginTop: space.xs },
});
