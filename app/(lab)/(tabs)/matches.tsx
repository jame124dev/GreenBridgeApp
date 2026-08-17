// (lab) My Wants — the buyer's saved-search dashboard (the mobile equivalent of
// the web `101lab-2/src/pages/buyer/MyWants.tsx`, elevated to the redesign
// mockup's first phone). Replaces the old flat "AI Match Center" feed: wants are
// GROUPED, each surfacing its BEST match visually (WantCard), plus full
// management (pause/resume, notify frequency, edit, delete) and a "New want" flow.
//
// The header now leads with a summary strip (active wants · new matches · top
// fit) and an All / Active / Paused segmented filter. Match aggregates are read
// from the SAME React Query cache the WantCards populate (`labKeys.wantMatches`
// via `useQueries`) — no extra network round-trips.
//
// Data: `useWants` (GET /wtb) → a WantCard per want, each loading its matches via
// `useWantMatches` (GET /wtb/{id}/matches). Flag-gated on WTB_ENABLED — with the
// flag OFF nothing fetches and the screen shows an "unavailable" note.
//
// Tab bar SHOWS here. A matched product's "View details" opens the Match Detail
// screen (stack route `/(lab)/match/<wtb_id:product_id>`); "View all N" on a
// WantCard opens the per-want All-matches screen (`/(lab)/want/<id>`).
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Sparkles } from 'lucide-react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import { LabScreenBg, useTabBarHeight } from '@/features/lab/components';
import { brand, fonts, greenDarkest, greenMedium, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { WTB_ENABLED } from '@/lib/flags';
import { useWants } from '@/features/lab/hooks/useWants';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { listWantMatches } from '@/features/lab/data/wtbApi';
import { isActiveStatus, relevancePercent } from '@/features/lab/wants/data/wantsView';
import { WantCard } from '@/features/lab/wants/components/WantCard';
import { AddWantSheet } from '@/features/lab/wants/components/AddWantSheet';

// Screen ink comes from the shared lab palette rather than screen-local hex, so
// this surface can never drift from the redesigned Messages/inbox screens.
// `lab.ink` IS the former local #10201A; `lab.inkSub` (#5E6E66) is a shade
// darker than the former #6B7A72, which also lifts the secondary text contrast.
const NEUTRALS = { title: lab.ink, sub: lab.inkSub } as const;
// Prototype screen gutter (NOT on the 4px scale) — mirrors the feed + detail.
const LAB_GUTTER = 22;

type WantFilter = 'all' | 'active' | 'paused';
const FILTER_KEYS: WantFilter[] = ['all', 'active', 'paused'];

const isPausedStatus = (status?: string | null) => (status ?? '').toLowerCase() === 'paused';

export default function LabMyWants() {
  const router = useRouter();
  // Live FrostedTabBar height (66 + bottom inset) instead of a hardcoded 96 +
  // inset: the magic number over-reserved ~30px of dead scroll space under the
  // last WantCard AND was a second copy of the bar's geometry that would silently
  // desync if the bar changed. Matches listings.tsx / account.tsx / home.tsx.
  const tabBarHeight = useTabBarHeight();
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<WantFilter>('all');

  const { wants, isLoading, isError, isEmpty, refetch } = useWants();

  // Pull-to-refresh has to refresh the MATCHES too, not just the wants list.
  // `useWants().refetch` only refetches `labKeys.wants()`; every want's matches
  // live in separate `labKeys.wantMatches(id)` queries, so the old
  // `onRefresh={refetch}` returned a fresh want list while the summary strip and
  // all the WantCards still showed the matches from before the pull.
  //
  // `refreshing` is a LOCAL pull flag, not react-query's `isRefetching`: that
  // flag is true for BACKGROUND refetches as well, so the control used to spin
  // by itself when a query invalidated with nobody pulling.
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: labKeys.wants() }),
        // Prefix key → matches EVERY wantMatches(id) entry in one call.
        qc.invalidateQueries({ queryKey: labKeys.wantMatchesAll() }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  // Aggregate matches across every want — reads straight from the SAME cache the
  // WantCards fill (`labKeys.wantMatches`), so this adds no network round-trips.
  const matchQueries = useQueries({
    queries: wants.map((w) => ({
      queryKey: labKeys.wantMatches(w.id),
      queryFn: () => listWantMatches(w.id),
      enabled: WTB_ENABLED,
    })),
  });

  const summary = useMemo(() => {
    const activeWants = wants.filter((w) => isActiveStatus(w.status)).length;
    // TOTAL matched products, which is all this data supports: `listWantMatches`
    // returns the current match set with no seen/unseen marker anywhere, so a
    // "new" count cannot be derived. The stat is therefore labelled "Matches" —
    // it used to say "New matches", which meant a buyer whose 3 wants each held
    // 5 month-old matches read "15 New matches" on every single visit.
    let totalMatches = 0;
    let topFit: number | null = null;
    for (const q of matchQueries) {
      const rows = q.data ?? [];
      totalMatches += rows.length;
      for (const m of rows) {
        const pct = relevancePercent(m);
        if (pct != null && (topFit == null || pct > topFit)) topFit = pct;
      }
    }
    const matchesLoading = matchQueries.some((q) => q.isLoading);
    return { activeWants, totalMatches, topFit, matchesLoading };
  }, [wants, matchQueries]);

  // Per-filter counts, so the segmented control says what is behind each option
  // instead of making the user tap to find out (and land on an empty list).
  const filterCounts = useMemo(
    () => ({
      all: wants.length,
      active: wants.filter((w) => isActiveStatus(w.status)).length,
      paused: wants.filter((w) => isPausedStatus(w.status)).length,
    }),
    [wants],
  );

  const filteredWants = useMemo(() => {
    if (filter === 'active') return wants.filter((w) => isActiveStatus(w.status));
    if (filter === 'paused') return wants.filter((w) => isPausedStatus(w.status));
    return wants;
  }, [wants, filter]);

  const openMatch = (matchId: string) => {
    // Stack-level dynamic route (outside (tabs)); `matchId` = `${wtb_id}:${product_id}`.
    router.push(`/(lab)/match/${matchId}`);
  };

  const openAdd = () => {
    haptics.tap();
    setAddOpen(true);
  };

  const selectFilter = (next: WantFilter) => {
    if (next === filter) return;
    haptics.tap();
    setFilter(next);
  };

  const hasWants = !isEmpty && wants.length > 0;

  return (
    <LabScreenBg>
    <Screen
      scroll
      padded={false}
      edges={['top']}
      keyboardAware={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onPullRefresh}
          tintColor={greenDarkest}
          colors={[greenDarkest]}
        />
      }
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: LAB_GUTTER,
        paddingBottom: tabBarHeight + spacing['2xl'],
      }}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(250)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Sparkles size={18} color={brand.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('mobile.labWants.title')}</Text>
            <Text style={styles.subtitle}>{t('mobile.labWants.subtitle')}</Text>
          </View>
        </View>
        {WTB_ENABLED ? (
          <Pressable onPress={openAdd} style={styles.newBtn} accessibilityRole="button" accessibilityLabel={t('mobile.labWants.newWantA11y')}>
            <Plus size={15} color="#fff" strokeWidth={2.4} />
            <Text style={styles.newText}>{t('mobile.labWants.newBtn')}</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      {!WTB_ENABLED ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t('mobile.labWants.unavailable')}</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={brand.primary} />
          <Text style={styles.centeredText}>{t('mobile.labWants.loading')}</Text>
        </View>
      ) : isError ? (
        <EmptyState
          title={t('mobile.labWants.errorTitle')}
          description={t('mobile.labWants.errorDesc')}
          actionLabel={t('mobile.labWants.retry')}
          onAction={refetch}
        />
      ) : !hasWants ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Search size={26} color={brand.primary} strokeWidth={2} />
          </View>
          <Text style={styles.emptyText}>
            {t('mobile.labWants.emptyText')}
          </Text>
          <Pressable onPress={openAdd} style={styles.emptyBtn} accessibilityRole="button" accessibilityLabel={t('mobile.labWants.addWant')}>
            <Plus size={15} color="#fff" strokeWidth={2.4} />
            <Text style={styles.newText}>{t('mobile.labWants.addWant')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Summary strip — reads before any scrolling */}
          <Animated.View entering={FadeIn.duration(250)} style={styles.summary}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{summary.activeWants}</Text>
              <Text style={styles.statLabel}>{t('mobile.labWants.statActiveWants')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: greenMedium }]}>
                {summary.matchesLoading ? '—' : summary.totalMatches}
              </Text>
              <Text style={styles.statLabel}>{t('mobile.labWants.statMatches')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>
                {summary.matchesLoading || summary.topFit == null ? (
                  '—'
                ) : (
                  <>
                    {summary.topFit}
                    <Text style={styles.statPct}>%</Text>
                  </>
                )}
              </Text>
              <Text style={styles.statLabel}>{t('mobile.labWants.statTopFit')}</Text>
            </View>
          </Animated.View>

          {/* All / Active / Paused segmented filter */}
          <View style={styles.seg}>
            {FILTER_KEYS.map((key) => {
              const on = key === filter;
              const label = t(`mobile.labWants.filters.${key}`);
              const count = filterCounts[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => selectFilter(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  // Count spoken as well as shown — a screen-reader user gets the
                  // same "is there anything in here?" answer a sighted user does.
                  accessibilityLabel={`${t('mobile.labWants.filterA11y', { filter: label })}, ${count}`}
                  style={[styles.segBtn, on && styles.segBtnOn]}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
                  <Text style={[styles.segCount, on && styles.segCountOn]}>{count}</Text>
                </Pressable>
              );
            })}
          </View>

          {filteredWants.length === 0 ? (
            <View style={styles.filterEmpty}>
              <Text style={styles.filterEmptyText}>
                {t(`mobile.labWants.filterEmpty.${filter}`)}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filteredWants.map((w, i) => (
                <WantCard key={w.id} want={w} index={i} onOpenMatch={openMatch} />
              ))}
            </View>
          )}
        </>
      )}

      <AddWantSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </Screen>
    </LabScreenBg>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flex: 1 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: brand.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontFamily: fonts.headingBold, fontSize: 22, lineHeight: 26, color: NEUTRALS.title },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: NEUTRALS.sub, marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: greenDarkest,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 44,
    flexShrink: 0,
  },
  newText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },

  // Summary strip
  summary: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: lab.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  statNum: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    lineHeight: 20,
    color: NEUTRALS.title,
    fontVariant: ['tabular-nums'],
  },
  statPct: { fontFamily: fonts.headingBold, fontSize: 12, color: NEUTRALS.title },
  statLabel: {
    fontFamily: fonts.label,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: lab.inkMeta,
    marginTop: 5,
  },

  // Segmented filter
  seg: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: lab.pillBg,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 44,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  segBtnOn: {
    backgroundColor: brand.surface,
    shadowColor: '#0E3B2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  segText: { fontFamily: fonts.bold, fontSize: 12.5, color: NEUTRALS.sub },
  segTextOn: { color: brand.primary },
  // The count is deliberately quieter than the label: it is an answer to "how
  // many", not a second thing to read. Tabular figures so 1→10 doesn't reflow.
  segCount: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: lab.inkMeta,
    fontVariant: ['tabular-nums'],
  },
  segCountOn: { color: greenMedium },

  notice: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E7EDE8',
    backgroundColor: brand.surface,
    padding: 32,
    alignItems: 'center',
  },
  noticeText: { fontFamily: fonts.regular, fontSize: 14, color: NEUTRALS.sub, textAlign: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 72 },
  centeredText: { fontFamily: fonts.regular, fontSize: 13, color: NEUTRALS.sub },
  emptyWrap: {
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8E2DB',
    backgroundColor: brand.surface,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: brand.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: NEUTRALS.sub,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: greenDarkest,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 4,
  },
  filterEmpty: { paddingVertical: 40, alignItems: 'center' },
  filterEmptyText: { fontFamily: fonts.regular, fontSize: 13, color: NEUTRALS.sub, textAlign: 'center' },
  list: { gap: 14 },
});
