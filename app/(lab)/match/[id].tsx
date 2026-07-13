// (lab) Match Detail — the decision moment of the match funnel (spec 06-match-detail).
// Confidence ring + side-by-side WTS/WTB cards + "Why AI matched you" + trust
// chips + a sticky "Confirm interest" CTA. Presented as a bottom-up modal
// (tab bar hidden; presentation:'modal' set in app/(lab)/_layout.tsx).
//
// Flow:  matches → match → deal
//   Back            → router.back()  (fallback replace → matches feed)
//   Confirm CTA     → router.push('/(lab)/deal/${dealId}')  (static)
//                   → router.replace('/(lab)/deal/${dealId}') (live, WTB_ENABLED)
//
// DATA SOURCE (NewVersion/dynamic/04 §8):
//   WTB_ENABLED off → static MATCH_DETAIL_FIXTURE, EXACT Phase-1 behavior (no
//                     network, no skeleton, no empty/error states).
//   WTB_ENABLED on  → useMatchDetail(id) composes the live detail client-side from
//                     listWants + listWantMatches (id = `${wtb_id}:${product_id}`),
//                     mapped into the SAME MatchDetailFixture shape so the JSX below
//                     renders identically. Adds a loading skeleton + error/empty state.
//
// Mode (sell/buy) only shifts the "You ·"/"Buyer ·" attribution + the CTA verb;
// structure, ring, accents, and CTA color stay green in both modes.
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { EmptyState } from '@/components/ui';
import { brand, fonts, greenMedium, buyBlue } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { usePop, useRise, usePressScale } from '@/animations/recipes';
import { useComposer } from '@/features/lab/stores/composerStore';
import { WTB_ENABLED } from '@/lib/flags';
// Phase-1 static source (used verbatim when WTB_ENABLED is OFF — no regression).
import { MATCH_DETAIL_FIXTURE, type MatchDetailFixture } from '@/features/lab/data/demo';
// Phase-2 live source — composes the same MatchDetailFixture shape from the WTB API.
import { useMatchDetail } from '@/features/lab/hooks/useMatchDetail';
import {
  ConfidenceRing,
  SideCard,
  WhyMatchedCard,
  TrustChip,
} from '@/features/lab/match/components';

const GUTTER = 22; // prototype gutter; NOT on the 4px scale — declared explicitly.

// Screen-local hexes with no exact foundation token (spec §3 `M` const).
const M = {
  // Align the page tint to the feed (brand.background). The old #F4F7F4 rationale
  // ("matches the ring inner mask") is obsolete — ConfidenceRing is an SVG stroked
  // ring with a transparent center, so there is no colored inner mask to blend.
  bg: brand.background, // #f8f9ff — one page tint across the matches unit
  title: '#10201A',
  ctaCaption: brand.textMuted, // #5b6b63 (~4.9:1 on the footer) — was #90A096 (~2.5:1)
  back: '#5E6E66',
  trustIcon: '#0E6B3F',
  sub: '#8A988F',
  skeleton: '#E4EBE6', // == ring track; neutral placeholder fill
} as const;

// Sticky CTA colored glow (spec §2.6) — foundation elevation tokens don't cover
// a colored shadow, so this is a documented screen-local override.
const ctaShadow = {
  shadowColor: greenMedium,
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.5,
  shadowRadius: 13,
  elevation: 8,
} as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LabMatch() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // Live detail (composed client-side from listWants + listWantMatches). The hook
  // self-disables (→ null, not loading) when WTB_ENABLED is false or id is blank,
  // so calling it unconditionally is free in the static path.
  const { detail, isLoading, isError, isEmpty, refetch } = useMatchDetail(id);

  // Source select: static fixture when the flag is OFF (EXACT Phase-1 behavior),
  // else the live-composed detail (same MatchDetailFixture shape).
  const match: MatchDetailFixture | null = WTB_ENABLED ? detail : MATCH_DETAIL_FIXTURE;

  // Mode only affects the "You ·" framing + CTA verb (spec §4).
  const mode = useComposer((s) => s.mode);
  const youIsBuyer = mode === 'buy';
  const ctaLabel = youIsBuyer
    ? t('mobile.labMatch.confirmInterest.buy')
    : t('mobile.labMatch.confirmInterest.sell');

  const onBack = useCallback(() => {
    haptics.tap(); // light / selection
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(lab)/(tabs)/matches');
    }
  }, [router]);

  // "Contact seller" opens the DIRECT buyer↔seller thread (the same Messages
  // surface as the Deals tab). It needs the seller's user id + the listing's
  // batch id: batch id comes from the matched product (wts.id); seller id comes
  // from the enriched snapshot (wts.sellerId). The backend snapshot doesn't emit
  // seller_id yet, so until it does we land on the Messages inbox (same surface)
  // — the moment the snapshot carries seller_id this opens the exact thread with
  // zero further change.
  const sellerId = match?.wts?.sellerId ?? null;
  const batchId = match?.wts?.id ?? '';
  const sellerName = match?.wts?.org || t('mobile.labMatch.sellerFallback');
  const onConfirm = useCallback(() => {
    haptics.impact(); // MEDIUM confirm thump (bespoke CTA — no Button haptic)
    if (youIsBuyer && sellerId != null && batchId) {
      // Replace so the confirmed match can't be re-opened by Back (funnel moves
      // forward into the conversation).
      router.replace({
        pathname: '/(lab)/deal/[id]',
        params: { id: String(batchId), sellerId: String(sellerId), name: sellerName },
      });
      return;
    }
    // Fallback: the Messages surface (seller thread not yet resolvable).
    router.push('/(lab)/(tabs)/deals');
    toast(t('mobile.labMatch.openMessagesToast'));
  }, [router, youIsBuyer, sellerId, batchId, sellerName, t]);

  // Bespoke-CTA press scale (0.97, matches Button) — spec §2.6 chose a bespoke
  // Pressable so the label renders Hanken-800 + colored glow.
  const cta = usePressScale();

  // Entrance builders — resolved unconditionally at the top level (rules of
  // hooks): RISE for the ring hero, staggered POP for cards/chips/CTA. Reduced
  // motion collapses the stagger to 0 inside the recipe hooks (usePop → fade).
  const ringEnter = useRise(0);
  const leftCardEnter = usePop(reduceMotion ? 0 : 200);
  const rightCardEnter = usePop(reduceMotion ? 0 : 280);
  const sellerChipEnter = usePop(reduceMotion ? 0 : 600);
  const escrowChipEnter = usePop(reduceMotion ? 0 : 700);
  const ctaEnter = usePop(reduceMotion ? 0 : 750);

  // Sticky-footer geometry — scroll padding derived from the footer's real
  // height so content never hides behind the CTA (spec §7).
  const CTA_H = 54;
  const CAPTION_H = 28;
  const FOOTER_PAD_TOP = 18;
  const SPACER = 16;
  const footerBottomPad = insets.bottom + 8;
  const footerH = FOOTER_PAD_TOP + CTA_H + CAPTION_H + footerBottomPad;
  const scrollPadBottom = footerH + SPACER;

  const backRow = (
    <View style={styles.backRow}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labMatch.backA11y')}
        style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <ChevronLeft size={17} color={M.back} strokeWidth={2.2} />
        <Text style={styles.backLabel}>{t('mobile.labMatch.backLabel')}</Text>
      </Pressable>
    </View>
  );

  // ── Live-only non-content states (never reached when WTB_ENABLED is OFF, so the
  // static path is byte-for-byte the Phase-1 render) ────────────────────────────
  if (WTB_ENABLED && isLoading) {
    return (
      <View style={styles.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: scrollPadBottom }}
        >
          {backRow}
          {/* Ring shimmer + two gray cards (spec §5 loading skeleton). */}
          <View style={styles.ringWrap}>
            <View style={styles.ringSkeleton}>
              <ActivityIndicator color={greenMedium} />
            </View>
          </View>
          <View style={styles.cardsRow}>
            <View style={[styles.cardFlex, styles.cardSkeleton]} />
            <View style={[styles.cardFlex, styles.cardSkeleton]} />
          </View>
          <View style={styles.section}>
            <View style={styles.wideSkeleton} />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (WTB_ENABLED && (isError || isEmpty || !match)) {
    const heading = isError
      ? t('mobile.labMatch.loadErrorTitle')
      : t('mobile.labMatch.unavailableTitle');
    const body = isError
      ? t('mobile.labMatch.loadErrorBody')
      : t('mobile.labMatch.unavailableBody');
    return (
      <View style={styles.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top }}
        >
          {backRow}
          {/* Shared EmptyState — same title/description/Button treatment as the
              matches-feed error/empty states (spec consistency across the unit). */}
          <EmptyState
            title={heading}
            description={body}
            actionLabel={isError ? t('mobile.labMatch.retry') : undefined}
            onAction={isError ? refetch : undefined}
            style={styles.emptyWrap}
          />
        </ScrollView>
      </View>
    );
  }

  // From here `match` is guaranteed non-null (static fixture, or a resolved live
  // detail). Derive the mode-aware subs off the resolved data.
  const detailMatch = match as MatchDetailFixture;
  const youLabel = t('mobile.labMatch.youLabel');
  const wtbSub = youIsBuyer
    ? `${youLabel} · ${detailMatch.wtb.context}`
    : `${t('mobile.labMatch.buyerLabel')} · ${detailMatch.wtb.context}`;
  const wtsSub = youIsBuyer
    ? `${detailMatch.wts.org} · ${detailMatch.wts.location}`
    : `${youLabel} · ${detailMatch.wts.location}`;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: scrollPadBottom }}
      >
        {/* Back link — ≥44px tap target */}
        {backRow}

        {/* Confidence ring (hero) — entrance RISE; ring owns its arc sweep */}
        <Animated.View entering={ringEnter} style={styles.ringWrap}>
          <ConfidenceRing percentage={detailMatch.confidence} label={t('mobile.labMatch.aiMatch')} />
        </Animated.View>

        {/* Side-by-side WTS / WTB cards */}
        <View style={styles.cardsRow}>
          <Animated.View entering={leftCardEnter} style={styles.cardFlex}>
            <SideCard
              eyebrow={t('mobile.labMatch.forSaleWts')}
              accent={greenMedium}
              title={detailMatch.wts.title}
              sub={wtsSub}
              price={detailMatch.wts.priceLabel}
            />
          </Animated.View>
          <Animated.View entering={rightCardEnter} style={styles.cardFlex}>
            <SideCard
              eyebrow={t('mobile.labMatch.wantedWtb')}
              accent={buyBlue}
              title={detailMatch.wtb.title}
              sub={wtbSub}
              price={detailMatch.wtb.budgetLabel}
            />
          </Animated.View>
        </View>

        {/* Why AI matched you (owns its own header fade + reason stagger) */}
        <View style={styles.section}>
          <WhyMatchedCard reasons={detailMatch.reasons} />
        </View>

        {/* Trust chips */}
        <View style={styles.trustRow}>
          {detailMatch.trust.verifiedSeller ? (
            <Animated.View entering={sellerChipEnter} style={styles.cardFlex}>
              <TrustChip
                icon={<ShieldCheck size={17} color={M.trustIcon} strokeWidth={2} />}
                label={t('mobile.labMatch.verifiedSeller')}
              />
            </Animated.View>
          ) : null}
          {detailMatch.trust.escrow ? (
            <Animated.View entering={escrowChipEnter} style={styles.cardFlex}>
              <TrustChip
                icon={
                  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                    <Rect
                      x={2}
                      y={7}
                      width={20}
                      height={14}
                      rx={2}
                      stroke={M.trustIcon}
                      strokeWidth={2}
                    />
                    <Path
                      d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
                      stroke={M.trustIcon}
                      strokeWidth={2}
                    />
                  </Svg>
                }
                label={t('mobile.labMatch.escrow')}
              />
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTA footer — OUTSIDE the scroll (spec §7) */}
      <View
        style={[
          styles.footer,
          { paddingBottom: footerBottomPad },
        ]}
      >
        <Animated.View entering={ctaEnter}>
          <AnimatedPressable
            onPress={onConfirm}
            onPressIn={cta.onPressIn}
            onPressOut={cta.onPressOut}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            style={[styles.cta, ctaShadow, cta.style]}
          >
            <Text
              style={styles.ctaLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {ctaLabel}
            </Text>
          </AnimatedPressable>
        </Animated.View>
        <Text style={styles.caption}>
          {t('mobile.labMatch.caption')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: M.bg, // override brand.background so the ring mask blends
  },
  backRow: {
    paddingHorizontal: GUTTER,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 14, // → row height ≥44 with the 17px icon
  },
  backLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '600',
    color: M.back,
  },
  ringWrap: {
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: GUTTER,
    paddingBottom: 4,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 16,
    marginHorizontal: GUTTER,
  },
  cardFlex: {
    flex: 1,
  },
  section: {
    marginTop: 14,
    marginHorizontal: GUTTER,
  },
  trustRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginHorizontal: GUTTER,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: 18,
    backgroundColor: M.bg,
    // Hairline so scrolling content visibly terminates under the sticky CTA
    // instead of colliding with a hard opaque edge (reads as clipped).
    borderTopWidth: 1,
    borderTopColor: '#E7EDE8',
  },
  cta: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: greenMedium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaLabel: {
    fontFamily: fonts.headingBold, // Hanken 800
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  caption: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: M.ctaCaption,
    marginTop: 11,
  },
  // ── Live loading skeleton (WTB_ENABLED only) ──────────────────────────────
  ringSkeleton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 6,
    borderColor: M.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  cardSkeleton: {
    height: 118,
    borderRadius: 18,
    backgroundColor: M.skeleton,
  },
  wideSkeleton: {
    height: 132,
    borderRadius: 18,
    backgroundColor: M.skeleton,
  },
  // ── Live error / empty state (WTB_ENABLED only) — routed through the shared
  // EmptyState (which owns its own centering + padding); this only offsets it
  // below the back row. ───────────────────────────────────────────────────────
  emptyWrap: {
    marginTop: 48,
  },
});
