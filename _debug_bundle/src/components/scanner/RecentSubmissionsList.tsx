import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { Image as ImagePlaceholder, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage, Badge, HStack } from '@/components/ui';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { classifyStatus, type StatusTone } from '@/features/scanner/batchStatus';
import { routes } from '@/lib/routes';
import type { SellerBatch } from '@/types/batch';
import { colors, fonts, fontSize, letterSpacing, radius, spacing } from '@/theme';

// Home "RECENT UPLOADS" row — colored edge · thumbnail with photo-count badge ·
// title + ITM code · status badge + optional ✨ AI badge · price chip. Compact
// layout; History tab has its own richer row.

function statusLabel(tone: StatusTone, t: (k: string) => string): string {
  switch (tone) {
    case 'live':
      return t('mobile.status.live');
    case 'pending':
      return t('mobile.status.pending');
    case 'sold':
      return t('mobile.status.sold');
    case 'review':
      return t('mobile.status.review');
    case 'inspect':
      return t('mobile.status.inspect');
    case 'inactive':
      return t('mobile.status.inactive');
    default:
      return t('mobile.status.submitted');
  }
}

function pickTitle(item: SellerBatch, lang: string): string {
  const i = item.titleI18n;
  if (lang === 'zh') return i?.zh || i?.en || item.title || '';
  if (lang === 'ja') return i?.ja || i?.en || item.title || '';
  if (lang === 'th') return i?.th || i?.en || item.title || '';
  return i?.en || item.title || '';
}

function itemCode(batchId: number): string {
  return `ITM-${String(batchId).padStart(6, '0')}`;
}

function BatchRow({ item }: { item: SellerBatch }) {
  const { t, i18n } = useTranslation();
  const tone = classifyStatus(item);
  const title = pickTitle(item, i18n.language) || item.category || `Batch #${item.batchId}`;
  const count = item.itemsCount ?? 0;
  // Backend doesn't yet flag AI-assisted listings or surface price on the
  // seller list — slots are wired so they light up the moment those fields ship.
  const aiAssisted = (item as { aiAssisted?: boolean }).aiAssisted;
  const priceLabel = (item as { priceLabel?: string }).priceLabel;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(routes.listingDetail(item.batchPk))}
    >
      <View style={[styles.edge, { backgroundColor: edgeColors[tone] }]} />

      <View style={styles.thumbWrap}>
        {item.thumbnailUrl ? (
          <AppImage source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbFallback}>
            <ImagePlaceholder color={colors.textSubtle} size={18} />
          </View>
        )}
        {count > 0 && (
          <View style={styles.thumbBadge}>
            <Text style={styles.thumbBadgeText}>{count}</Text>
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowCode} numberOfLines={1}>
          {itemCode(item.batchId)}
        </Text>
        <HStack gap="sm" wrap style={styles.pillRow}>
          <Badge variant={tone} label={statusLabel(tone, t)} size="sm" />
          {aiAssisted && (
            <Badge
              variant="ai"
              label="AI"
              size="sm"
              leftIcon={<Sparkles color={colors.warningText} size={10} />}
            />
          )}
        </HStack>
      </View>

      {priceLabel ? (
        <Text style={styles.price} numberOfLines={1}>
          {priceLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

type Props = {
  limit?: number;
  title?: string;
  emptyHint?: string;
  /** Pass the parent's query to avoid a duplicate fetch on the home dashboard. */
  query?: UseQueryResult<SellerBatch[]>;
};

export function RecentSubmissionsList({
  limit = 10,
  title,
  emptyHint = 'Your listed batches will appear here.',
  query: externalQuery,
}: Props) {
  const { t } = useTranslation();
  const internalQuery = useRecentSubmissions(limit, { enabled: !externalQuery });
  const { data, isLoading, isError, refetch } = externalQuery ?? internalQuery;

  const headerCount = data?.length ?? 0;
  const sectionTitle = title ?? t('mobile.home.recentUploads');

  if (isLoading) {
    return (
      <View style={styles.section}>
        <SectionHeader title={sectionTitle} />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.section}>
        <SectionHeader title={sectionTitle} />
        <Pressable onPress={() => refetch()}>
          <Text style={styles.retry}>{t('mobile.common.couldNotLoad')}</Text>
        </Pressable>
      </View>
    );
  }

  if (!data?.length) {
    return (
      <View style={styles.section}>
        <SectionHeader title={sectionTitle} />
        <Text style={styles.empty}>{emptyHint}</Text>
      </View>
    );
  }

  // Plain map (no FlashList) — this list lives inside the home ScrollView, where
  // FlashList would clip to a single row since it can't measure its own height
  // inside a parent scroll view. 10 items doesn't need virtualization anyway.
  return (
    <View style={styles.section}>
      <SectionHeader
        title={sectionTitle}
        countLabel={t('mobile.home.itemsCount', { count: headerCount })}
      />
      <View style={styles.listWrap}>
        {data.map((item) => (
          <BatchRow key={item.batchPk} item={item} />
        ))}
      </View>
    </View>
  );
}

function SectionHeader({ title, countLabel }: { title: string; countLabel?: string }) {
  return (
    <HStack align="center" justify="space-between" style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {countLabel ? (
        <View style={styles.sectionCountPill}>
          <Text style={styles.sectionCountPillText}>{countLabel}</Text>
        </View>
      ) : null}
    </HStack>
  );
}

// 3 px colored left rail on each row — adjacent to the Badge but separate
// (the rail outlines the whole card, not the pill).
const edgeColors: Record<StatusTone, string> = {
  live: colors.success,
  pending: colors.warning,
  sold: '#16a34a',
  review: colors.warning,
  inspect: colors.inspect,
  inactive: colors.textSubtle,
  submitted: colors.info,
};

const styles = StyleSheet.create({
  section: { marginTop: spacing['7xl'] },
  sectionHeader: { marginBottom: spacing.lg },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    letterSpacing: letterSpacing.caps,
  },
  sectionCountPill: {
    backgroundColor: '#dcfce7',
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 3,
  },
  sectionCountPillText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.capsLoose,
    color: colors.successText,
  },
  listWrap: { minHeight: 120 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingRight: spacing.xl,
    paddingLeft: 0,
    marginBottom: spacing.lg,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  edge: { width: 3, alignSelf: 'stretch' },
  thumbWrap: { width: 48, height: 48, marginLeft: 9 },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.muted },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.foreground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  thumbBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.surface },

  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.foreground },
  rowCode: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    letterSpacing: 0.3,
  },
  pillRow: { marginTop: 2 },
  price: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.inkSlate },

  empty: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.mutedForeground },
  retry: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    color: colors.primary,
    marginTop: spacing.md,
  },
});
