import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image as ImagePlaceholder, Inbox, SearchX } from 'lucide-react-native';

import { AppImage, Badge, EmptyState, HStack } from '@/components/ui';
import { classifyStatus, type StatusTone } from '@/features/scanner/batchStatus';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { relativeDate } from '@/lib/dates';
import { routes } from '@/lib/routes';
import type { SellerBatch } from '@/types/batch';
import { colors, fonts, fontSize, letterSpacing, radius, spacing } from '@/theme';

// History tab — 4-stat header, filter chips, image rows with status badge +
// colored left edge. Stats / counts are derived client-side from the loaded
// page (no extra API call).

type Filter = 'all' | 'live' | 'pending' | 'sold';

function statusLabel(tone: StatusTone, t: (k: string) => string): string {
  switch (tone) {
    case 'live':
      return t('mobile.status.live');
    case 'pending':
      return t('mobile.status.pending');
    case 'sold':
      return t('mobile.status.sold');
    case 'review':
      // History uses the longer "IN REVIEW" wording (vs. RecentSubmissionsList's
      // shorter "REVIEW") to read better in this list context.
      return 'IN REVIEW';
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
  if (lang.startsWith('zh')) return i?.zh || i?.en || item.title || '';
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
  const sub = `${itemCode(item.batchId)}  ·  ${relativeDate(item.postDate)}`;
  const count = item.itemsCount ?? 0;

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
            <ImagePlaceholder color={colors.textSubtle} size={20} />
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
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
        <HStack gap="sm" wrap style={styles.pillRow}>
          <Badge variant={tone} label={statusLabel(tone, t)} size="sm" dot />
          {item.approvalStatus === 'pending' && tone !== 'pending' && (
            <Badge variant="pending" label={t('mobile.status.pending')} size="sm" />
          )}
        </HStack>
      </View>
    </Pressable>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tint ? { color: tint } : undefined]}>{value}</Text>
    </View>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
      <View style={[styles.filterChipCount, active && styles.filterChipCountActive]}>
        <Text style={[styles.filterChipCountText, active && styles.filterChipCountTextActive]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HistoryTab() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const query = useRecentSubmissions(30);
  const data = query.data ?? [];

  const counts = useMemo(() => {
    let live = 0,
      pending = 0,
      sold = 0;
    for (const b of data) {
      const tone = classifyStatus(b);
      if (tone === 'live') live++;
      else if (tone === 'pending') pending++;
      else if (tone === 'sold') sold++;
      if (b.approvalStatus === 'pending' && tone !== 'pending') pending++;
    }
    return { total: data.length, live, pending, sold };
  }, [data]);

  const filtered = useMemo(() => {
    if (filter === 'all') return data;
    return data.filter((b) => {
      const tone = classifyStatus(b);
      if (filter === 'pending') return tone === 'pending' || b.approvalStatus === 'pending';
      return tone === filter;
    });
  }, [data, filter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.heading}>{t('mobile.history.heading')}</Text>
        <Text style={styles.subtitle}>{t('mobile.history.subtitle')}</Text>

        <View style={styles.statsRow}>
          <StatCard label={t('mobile.history.total')} value={counts.total} />
          <StatCard
            label={t('mobile.status.live')}
            value={counts.live}
            tint={colors.successText}
          />
          <StatCard
            label={t('mobile.status.pending')}
            value={counts.pending}
            tint={colors.warningText}
          />
          <StatCard
            label={t('mobile.status.sold')}
            value={counts.sold}
            tint="#166534"
          />
        </View>

        <View style={styles.filterRow}>
          <FilterChip
            label={t('mobile.history.filterAll')}
            count={counts.total}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterChip
            label={t('mobile.history.filterLive')}
            count={counts.live}
            active={filter === 'live'}
            onPress={() => setFilter('live')}
          />
          <FilterChip
            label={t('mobile.history.filterPending')}
            count={counts.pending}
            active={filter === 'pending'}
            onPress={() => setFilter('pending')}
          />
          <FilterChip
            label={t('mobile.history.filterSold')}
            count={counts.sold}
            active={filter === 'sold'}
            onPress={() => setFilter('sold')}
          />
        </View>

        <View style={styles.listWrap}>
          {query.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['6xl'] }} />
          ) : query.isError ? (
            <EmptyState
              icon={<SearchX color={colors.warningText} size={28} />}
              iconBg={colors.warningBg}
              title={t('mobile.common.couldNotLoad')}
              actionLabel={t('mobile.common.retry')}
              onAction={() => query.refetch()}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Inbox color={colors.textSubtle} size={28} />}
              title={
                filter === 'all'
                  ? t('mobile.history.emptyHint')
                  : t('mobile.history.emptyFilter')
              }
              loose
            />
          ) : (
            <FlashList
              data={filtered}
              keyExtractor={(item) => String(item.batchPk)}
              renderItem={({ item }) => <BatchRow item={item} />}
              refreshing={query.isRefetching}
              onRefresh={query.refetch}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// 3 px colored left rail — separate concern from <Badge>.
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing['3xl'], paddingTop: spacing.md },
  heading: { fontFamily: fonts.heading, fontSize: fontSize['8xl'], color: colors.foreground },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    marginBottom: spacing['3xl'],
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing['2xl'] },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.inkSlate,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' },
    }),
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: colors.textSubtle,
    letterSpacing: letterSpacing.capsTight,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: fontSize['5xl'],
    color: colors.inkSlate,
    marginTop: 2,
  },

  // Filters
  filterRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.base,
    color: colors.text,
  },
  filterChipTextActive: { color: colors.white },
  filterChipCount: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    minWidth: 20,
    alignItems: 'center',
  },
  filterChipCountActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  filterChipCountText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  filterChipCountTextActive: { color: colors.white },

  listWrap: { flex: 1 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    paddingRight: spacing.xl,
    paddingLeft: 0,
    marginBottom: spacing.lg,
    gap: spacing.xl,
    overflow: 'hidden',
  },
  edge: { width: 3, alignSelf: 'stretch' },
  thumbWrap: { width: 56, height: 56, marginLeft: 9 },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.muted },
  thumbFallback: {
    width: 56,
    height: 56,
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
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.foreground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  thumbBadgeText: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: colors.surface },

  rowBody: { flex: 1, gap: spacing.xs },
  rowTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.foreground },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSubtle },
  pillRow: { marginTop: spacing.xs },
});
