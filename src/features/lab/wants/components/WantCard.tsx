// WantCard — one saved want on the My Wants dashboard (mobile port of the web
// MyWants `WantCard`, elevated to the redesign mockup's first phone). Header:
// title + status/notify pills + saved date + "Searching" keyword/category chips
// + a manage (⋮) button. Body: the want's BEST match (strongest-first [0]) shown
// as a photo + name + price + location + a colour-graded relevance ring, then a
// footer that stacks a "+N more" thumbnail preview and a "View all N →" link into
// the per-want All-matches screen. The manage sheet (pause/resume, notify
// frequency, edit, delete) is owned here and mounted per card.
//
// Matches load via `useWantMatches` (shared React Query cache with the parent
// dashboard's aggregate). Loading / no-match states are preserved.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellRing, ChevronRight, MoreVertical, Search } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { ProductThumb, RelevanceRing } from '@/features/lab/components';
import { brand, fonts, greenDarkest, greenMedium, lab, radius, spacing } from '@/constants/theme';
import { usePop, usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { useWantMatches } from '@/features/lab/hooks/useWantMatches';
import type { WtbListItem } from '@/features/lab/data/wtbApi';
import {
  formatWantDate,
  frequencyLabel,
  isActiveStatus,
  matchToProductVM,
  sortMatchesStrongest,
  statusLabel,
  wantSearchChips,
} from '@/features/lab/wants/data/wantsView';
import { ManageWantSheet } from './ManageWantSheet';

// How many product thumbs the footer stack previews before collapsing into "+N".
const STACK_MAX = 2;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const NEUTRALS = {
  title: '#10201A',
  sub: '#6B7A72',
  border: '#E7EDE8',
  headerBg: '#F3F8F4',
  footerBg: '#FCFDFC',
  chipInk: '#5B6B63',
  chipBg: '#EEF2EF',
} as const;

export function WantCard({
  want,
  index = 0,
  onOpenMatch,
}: {
  want: WtbListItem;
  index?: number;
  onOpenMatch: (matchId: string) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { matches, isLoading } = useWantMatches(want.id);
  const [manageOpen, setManageOpen] = useState(false);

  const sorted = useMemo(() => sortMatchesStrongest(matches), [matches]);
  const total = sorted.length;
  const best = total > 0 ? matchToProductVM(sorted[0]) : null;
  // Thumbnails for the footer stack (the whole set, best-first), collapsed to +N.
  const stack = useMemo(() => sorted.slice(0, STACK_MAX).map(matchToProductVM), [sorted]);
  const extra = total - stack.length; // count hidden behind the "+N" tile

  const { category, keywords } = wantSearchChips(want);
  const active = isActiveStatus(want.status);
  const savedDate = formatWantDate(want.created_at);

  const bestPress = usePressScale();

  const bestLocation = best ? [best.country, best.condition].filter(Boolean).join(' · ') : '';

  const openBest = () => {
    if (!best) return;
    haptics.tap();
    onOpenMatch(best.matchId);
  };

  const openAll = () => {
    haptics.tap();
    router.push({
      pathname: '/(lab)/want/[id]',
      params: { id: String(want.id), title: want.title },
    });
  };

  return (
    <Animated.View entering={usePop(index * 80)} style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {want.title}
          </Text>
          <Pressable
            onPress={() => {
              haptics.tap();
              setManageOpen(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.labWants.manageWantA11y')}
            style={styles.manageBtn}
          >
            <MoreVertical size={18} color={lab.inkMeta} />
          </Pressable>
        </View>

        <View style={styles.pillRow}>
          <View style={[styles.statusPill, active ? styles.statusActive : styles.statusIdle]}>
            <View style={[styles.dot, { backgroundColor: active ? greenMedium : '#9AA89F' }]} />
            <Text style={[styles.statusText, { color: active ? greenDarkest : NEUTRALS.sub }]}>
              {statusLabel(want.status, t)}
            </Text>
          </View>
          <View style={styles.notifyPill}>
            <BellRing size={11} color={greenMedium} strokeWidth={2} />
            <Text style={styles.notifyText}>{frequencyLabel(want.notify_frequency, t)}</Text>
          </View>
          {savedDate ? <Text style={styles.saved}>· {t('mobile.labWants.savedDate', { date: savedDate })}</Text> : null}
        </View>

        {/* What this want hunts for */}
        {category || keywords.length > 0 ? (
          <View style={styles.searchRow}>
            <Search size={11} color={NEUTRALS.sub} strokeWidth={2} />
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
          </View>
        ) : null}
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={brand.primary} />
          <Text style={styles.loadingText}>{t('mobile.labWants.findingMatches')}</Text>
        </View>
      ) : !best ? (
        <View style={styles.emptyRow}>
          <BellRing size={18} color={brand.primaryAccent} strokeWidth={2} />
          <Text style={styles.emptyText}>
            {t('mobile.labWants.noMatchesYet')}
          </Text>
        </View>
      ) : (
        <>
          {/* Best match — the want's strongest fit, shown not just counted */}
          <AnimatedPressable
            onPress={openBest}
            onPressIn={bestPress.onPressIn}
            onPressOut={bestPress.onPressOut}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.labWants.bestMatchA11y', { name: best.name })}
            style={[styles.best, bestPress.style]}
          >
            <ProductThumb uri={best.image} size={60} kind="machine" />
            <View style={styles.bestInfo}>
              <Text numberOfLines={2} style={styles.bestName}>
                {best.name}
              </Text>
              <Text style={styles.bestPrice}>{best.priceText}</Text>
              {bestLocation ? <Text style={styles.bestLoc}>{bestLocation}</Text> : null}
            </View>
            <RelevanceRing pct={best.pct} tier={best.tier} size={52} />
          </AnimatedPressable>

          {/* Footer — depth hint (+N more) + one tap into the full match list */}
          {total > 1 ? (
            <Pressable
              onPress={openAll}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.labWants.viewAllA11y', { count: total })}
              style={styles.footer}
            >
              <View style={styles.stack}>
                {stack.map((vm, i) => (
                  <View key={`${vm.matchId}-${i}`} style={[styles.stackThumb, i > 0 && styles.stackOverlap]}>
                    <ProductThumb uri={vm.image} size={34} radius={radius.sm} kind="machine" />
                  </View>
                ))}
                {extra > 0 ? (
                  <View style={[styles.moreTile, styles.stackOverlap]}>
                    <Text style={styles.moreText}>+{extra}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.link}>
                <Text style={styles.linkText}>{t('mobile.labWants.viewAll', { count: total })}</Text>
                <ChevronRight size={14} color={brand.primary} strokeWidth={2.4} />
              </View>
            </Pressable>
          ) : null}
        </>
      )}

      <ManageWantSheet want={want} visible={manageOpen} onClose={() => setManageOpen(false)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: NEUTRALS.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: NEUTRALS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRALS.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.headingBold, fontSize: 15, lineHeight: 20, color: NEUTRALS.title },
  manageBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 9 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusActive: { backgroundColor: '#DCF3E4' },
  statusIdle: { backgroundColor: '#ECEFEC' },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  statusText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.2 },
  notifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: lab.chipSellBg,
  },
  notifyText: { fontFamily: fonts.bold, fontSize: 10.5, color: greenMedium },
  saved: { fontFamily: fonts.regular, fontSize: 11, color: lab.inkMeta },
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 9 },
  kwChip: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: NEUTRALS.chipBg },
  kwText: { fontFamily: fonts.semibold, fontSize: 10.5, color: NEUTRALS.chipInk },
  catChip: { backgroundColor: brand.primarySurface },
  catText: { color: brand.primary },

  // Best-match strip
  best: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bestInfo: { flex: 1, minWidth: 0 },
  bestName: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: NEUTRALS.title },
  bestPrice: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: NEUTRALS.title, marginTop: 3 },
  bestLoc: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: NEUTRALS.sub, marginTop: 2 },

  // Footer stack + link
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: lab.hairline,
    backgroundColor: NEUTRALS.footerBg,
  },
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackThumb: { borderWidth: 2, borderColor: '#fff', borderRadius: radius.sm, overflow: 'hidden' },
  stackOverlap: { marginLeft: -10 },
  moreTile: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: greenDarkest,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontFamily: fonts.headingBold, fontSize: 11, color: '#fff' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  linkText: { fontFamily: fonts.bold, fontSize: 12.5, color: brand.primary },

  // States
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
  },
  loadingText: { fontFamily: fonts.regular, fontSize: 12.5, color: NEUTRALS.sub },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    margin: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: NEUTRALS.border,
    backgroundColor: '#FAFCFA',
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
  },
  emptyText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: NEUTRALS.sub },
});
