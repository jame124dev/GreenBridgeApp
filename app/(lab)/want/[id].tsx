// (lab) All matches for ONE want (redesign mockup: the "All matches" phone).
// Opened from a WantCard's "View all N" — this screen shows every product matched
// to a single saved want, colour-graded by relevance, with sort + a criteria
// recap so the buyer knows exactly what they're looking at.
//
// Route:   /(lab)/want/[id]   (stack-level, tab bar HIDDEN — registered in
//          app/(lab)/_layout.tsx). Params: id = String(want.id), title = want.title.
// Data:    useWantMatches(Number(id)) for the matches; the parent want is read
//          from the useWants cache by id (recap chips + ⋮ manage), title-only if
//          the cache is cold.
//
// Actions per match (MatchListCard):
//   - "View details"   → /(lab)/match/<wtb_id:product_id>  (Match Detail).
//   - "Message seller" → the DIRECT seller thread when a sellerId is resolvable
//     from the snapshot (not today — the backend omits seller_id), else the
//     Messages inbox + a toast (same fallback as app/(lab)/match/[id].tsx).
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MoreVertical, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { EmptyState, Text } from '@/components/ui';
import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { WTB_ENABLED } from '@/lib/flags';
import { useWants } from '@/features/lab/hooks/useWants';
import { useWantMatches } from '@/features/lab/hooks/useWantMatches';
import type { WtbListItem, WtbMatch, WtbProductSnapshot } from '@/features/lab/data/wtbApi';
import {
  matchToProductVM,
  sortMatchesStrongest,
  wantSearchChips,
} from '@/features/lab/wants/data/wantsView';
import { MatchListCard } from '@/features/lab/wants/components/MatchListCard';
import { ManageWantSheet } from '@/features/lab/wants/components/ManageWantSheet';

type SortMode = 'best' | 'newest' | 'price';
// i18n keys resolved at render (module scope can't call the hook). `labelKey` →
// the segment label; `subKey` → the "sorted by …" fragment in the subtitle.
const SORTS: { key: SortMode; labelKey: string; subKey: string }[] = [
  { key: 'best', labelKey: 'sortBest', subKey: 'subRelevance' },
  { key: 'newest', labelKey: 'sortNewest', subKey: 'subDateListed' },
  { key: 'price', labelKey: 'sortPrice', subKey: 'subPrice' },
];

/** Snapshot price → finite number | null (nulls sort last under "Price"). */
function priceNum(p: WtbProductSnapshot['price']): number | null {
  if (p == null) return null;
  const n = Number(p);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function LabWantMatches() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const wtbId = Number(id);

  const [sort, setSort] = useState<SortMode>('best');
  const [manageOpen, setManageOpen] = useState(false);

  // Parent want from the My-Wants cache (recap chips + manage sheet). Cold cache
  // → undefined; the screen degrades to the title param only.
  const { wants } = useWants();
  const want: WtbListItem | undefined = useMemo(
    () => wants.find((w) => w.id === wtbId),
    [wants, wtbId],
  );
  const headerTitle =
    (want?.title && want.title.trim()) ||
    (title && title.trim()) ||
    t('mobile.labMatch.matchesTitleFallback');

  const { matches, isLoading, isError, refetch } = useWantMatches(wtbId);

  // Sort the matches for the active segment (best = strongest score, newest =
  // matched_at desc, price = ascending with unpriced items last).
  const sorted = useMemo(() => {
    if (sort === 'newest') {
      return [...matches].sort((a, b) => tsOf(b) - tsOf(a));
    }
    if (sort === 'price') {
      return [...matches].sort((a, b) => {
        const pa = priceNum(a.product_snapshot?.price);
        const pb = priceNum(b.product_snapshot?.price);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1; // nulls last
        if (pb == null) return -1;
        return pa - pb;
      });
    }
    return sortMatchesStrongest(matches);
  }, [matches, sort]);

  const total = sorted.length;
  const activeSubKey = SORTS.find((s) => s.key === sort)?.subKey ?? 'subRelevance';
  const activeSub = t(`mobile.labMatch.${activeSubKey}`);
  const subtitle = t(
    total === 1 ? 'mobile.labMatch.subtitleOne' : 'mobile.labMatch.subtitleOther',
    { count: total, sub: activeSub },
  );

  const { category, keywords } = want ? wantSearchChips(want) : { category: '', keywords: [] };

  const onBack = useCallback(() => {
    haptics.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/(lab)/(tabs)/matches');
  }, [router]);

  const openDetails = useCallback(
    (matchId: string) => {
      router.push(`/(lab)/match/${matchId}`);
    },
    [router],
  );

  // Same seller-thread bridge as app/(lab)/match/[id].tsx: open the DIRECT
  // buyer↔seller thread for the matched listing. The snapshot doesn't carry
  // seller_id, so we open with just the batch id and let the deal screen resolve
  // the seller on-demand (pass seller_id through if a future snapshot has it).
  const messageSeller = useCallback(
    (m: WtbMatch) => {
      const s = m.product_snapshot ?? {};
      const sellerId = typeof s.seller_id === 'number' ? s.seller_id : null;
      const batchId = s.batch_id ?? m.product_id ?? 0;
      if (batchId) {
        router.push({
          pathname: '/(lab)/deal/[id]',
          params: {
            id: String(batchId),
            // `s.name` is the PRODUCT name (not the seller's), so pass it only as
            // a name when we also have the seller id; otherwise let the deal
            // screen resolve the seller's real display name from the batch.
            ...(sellerId != null
              ? { sellerId: String(sellerId), name: (s.name && String(s.name).trim()) || '' }
              : {}),
          },
        });
        return;
      }
      router.push('/(lab)/(tabs)/deals');
      toast(t('mobile.labMatch.openMessagesToast'));
    },
    [router, t],
  );

  const showManage = WTB_ENABLED && !!want;

  return (
    <View style={styles.root}>
      {/* Fixed nav header — back + want title/subtitle + manage (⋮) */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labMatch.back')}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ChevronLeft size={24} color={lab.ink} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.headerWho}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {headerTitle}
          </Text>
          <Text numberOfLines={1} style={styles.headerSub}>
            {subtitle}
          </Text>
        </View>
        {showManage ? (
          <Pressable
            onPress={() => {
              haptics.tap();
              setManageOpen(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.labMatch.manageWant')}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <MoreVertical size={18} color={lab.inkMeta} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={brand.primary} />
          <Text style={styles.centeredText}>{t('mobile.labMatch.loadingMatches')}</Text>
        </View>
      ) : isError ? (
        <EmptyState
          title={t('mobile.labMatch.matchesLoadErrorTitle')}
          description={t('mobile.labMatch.matchesLoadErrorBody')}
          actionLabel={t('mobile.labMatch.retry')}
          onAction={refetch}
          style={styles.stateWrap}
        />
      ) : total === 0 ? (
        <EmptyState
          title={t('mobile.labMatch.noMatchesTitle')}
          description={t('mobile.labMatch.noMatchesBody')}
          style={styles.stateWrap}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] + insets.bottom }}
        >
          {/* Criteria recap — "SEARCHING" + the want's category / keyword chips */}
          {category || keywords.length > 0 ? (
            <Animated.View entering={FadeIn.duration(250)} style={styles.recap}>
              <View style={styles.recapLabel}>
                <Search size={12} color={lab.inkMeta} strokeWidth={2} />
                <Text style={styles.recapLabelText}>{t('mobile.labMatch.searching')}</Text>
              </View>
              {category ? (
                <View style={[styles.kwChip, styles.catChip]}>
                  <Text style={[styles.kwText, styles.catText]}>{category}</Text>
                </View>
              ) : null}
              {keywords.map((kw) => (
                <View key={kw} style={styles.kwChip}>
                  <Text style={styles.kwText}>{kw}</Text>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {/* Sort segment — Best match / Newest / Price */}
          <View style={styles.seg}>
            {SORTS.map((s) => {
              const on = s.key === sort;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    haptics.tap();
                    setSort(s.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.segBtn, on && styles.segBtnOn]}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{t(`mobile.labMatch.${s.labelKey}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Match cards */}
          <View style={styles.list}>
            {sorted.map((m, i) => (
              <MatchListCard
                key={`${m.id}-${m.product_id}`}
                vm={matchToProductVM(m)}
                index={i}
                onViewDetails={() => openDetails(matchToProductVM(m).matchId)}
                onMessageSeller={() => messageSeller(m)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {want ? (
        <ManageWantSheet want={want} visible={manageOpen} onClose={() => setManageOpen(false)} />
      ) : null}
    </View>
  );
}

/** matched_at → epoch ms (missing/invalid → 0 so undated rows sort oldest). */
function tsOf(m: WtbMatch): number {
  if (!m.matched_at) return 0;
  const t = Date.parse(m.matched_at);
  return Number.isNaN(t) ? 0 : t;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: brand.surface,
    borderBottomWidth: 1,
    borderBottomColor: lab.hairline,
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerWho: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: fonts.headingBold, fontSize: 16, lineHeight: 20, color: lab.ink },
  headerSub: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: lab.inkSub, marginTop: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: 72 },
  centeredText: { fontFamily: fonts.regular, fontSize: 13, color: lab.inkSub },
  stateWrap: { marginTop: spacing['4xl'] },
  recap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  recapLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginRight: spacing.xs },
  recapLabelText: {
    fontFamily: fonts.label,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: lab.inkMeta,
  },
  kwChip: { borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#EEF2EF' },
  kwText: { fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 14, color: lab.inkSub },
  catChip: { backgroundColor: brand.primarySurface },
  catText: { color: brand.primary },
  seg: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: '#E7EEE9',
    borderRadius: radius.md,
    padding: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingVertical: 8, borderRadius: radius.sm },
  segBtnOn: {
    backgroundColor: brand.surface,
    shadowColor: greenDarkest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  segText: { fontFamily: fonts.bold, fontSize: 12.5, color: lab.inkSub },
  segTextOn: { color: brand.primary },
  list: { gap: spacing.md },
});
