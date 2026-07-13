// (lab) Draft Review — review the AI-generated listing (sell) / request (buy)
// before it goes live. Full implementation of NewVersion/03-draft-review.md.
//
// Flow (verified shell contract):
//   Back    -> router.back()  (returns to Home; tab bar HIDDEN here)
//   Publish -> router.replace('/(lab)/(tabs)/published')  (tab bar shows there)
//
// State: `mode` (sell|buy) is read from the composer store (Home wrote it; this
// screen is read-only). It drives every copy + accent swap.
//
// Phase 1 = STATIC. Copy/specs come from DRAFT_DATA[mode] in the demo module;
// mode-varied tints/accents are derived locally from @/constants/theme tokens.
// FUTURE DYNAMIC HOOK POINT: replace the `DRAFT_DATA[mode]` read + `getVM` below
// with `useQuery(['draft', draftId])` → map the result JSON onto the same VM
// shape; Publish becomes a `useMutation` (gated behind an explicit confirm) that
// navigates to Published with the real match count.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronLeft, MapPin, Users } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HStack, Screen, Text } from '@/components/ui';
import {
  brand,
  buyBlue,
  buyBlueSurface,
  fonts,
  greenDark,
  greenDarkest,
  greenMedium,
  spacing,
} from '@/constants/theme';
import { pop, reducedFade, rise, usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { LAB_CHAT_ENABLED } from '@/lib/flags';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useThread } from '@/features/lab/stores/threadStore';
import { useLabTurn } from '@/features/lab/hooks/useLabTurn';
import { DRAFT_DATA, type DraftData } from '@/features/lab/data/demo';
import { draftFromFrame } from '@/features/lab/data/draftFromFrame';
import {
  DraftEquipmentGlyph,
  DraftSparkle,
} from '@/features/lab/components/draftGlyphs';

/* -------------------------------------------------------------------------- */
/*  Local constants — one-off prototype greys + shadows (co-located, not tokens)*/
/*  These are per-screen prototype values, NOT app-wide tokens (spec §3).      */
/* -------------------------------------------------------------------------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Horizontal gutter — aligned to the large-device screen-padding token (24)
// instead of the off-grid prototype 22, so this screen sits on the same 4/8
// rhythm as neighboring token-based screens.
const GUTTER = spacing['2xl']; // 24

/** Stable empty-cards reference for the flag-OFF selector (no re-render churn). */
const EMPTY_CARDS: readonly { type: string; data: unknown }[] = [];

/** Literal confirmation the assistant requires before it writes the listing /
 *  request (spec 04 §5.3, 02 §3.2 seller flow). NOT localized — a control token. */
const CONFIRM_CREATE = 'CONFIRM CREATE';

/** `data` card `type`s that mean the create succeeded → advance to Published. */
const CREATE_DONE_TYPES = ['listing_created', 'wtb_request'] as const;

const DRAFT_COLORS = {
  ink: '#10201A', // near-black heading (darker than brand.foreground)
  inkBack: '#5E6E66', // back-button label
  inkSub: '#6B7A72', // subcopy
  inkMeta: '#7C8A82', // spec key / location / price hint / meta
  inkMetaTint: '#5b6b63', // meta ink for TINTED surfaces (price/demand blocks) — passes AA where inkSub #6B7A72 dips below 4.5:1
  cardBorder: '#E7EDE8',
  specDivider: '#EEF2EF',
  pillBg: '#EAF3EC',
  pillText: '#0E6B3F',
  secondaryBorder: '#DDE5DF',
  secondaryText: '#34503F',
  sourceBadgeBg: 'rgba(16,32,26,0.72)', // backdrop-blur fallback (RN has no blur)
  marketBadgeBg: 'rgba(255,255,255,0.92)',
  footerHairline: '#EEF2EF',
} as const;

const DRAFT_SHADOWS = {
  card: {
    shadowColor: greenDarkest, // #0E3B2E
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 8,
  },
  cta: (accentShadow: string) => ({
    shadowColor: accentShadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 10,
  }),
} as const;

/* -------------------------------------------------------------------------- */
/*  View-model — mode-varied tints/accents layered onto the static DRAFT_DATA. */
/*  Copy/specs are READ from DRAFT_DATA[mode]; colors derive from theme tokens. */
/* -------------------------------------------------------------------------- */

function getVM(mode: 'sell' | 'buy', data: DraftData) {
  const sell = mode === 'sell';
  return {
    ...data,
    // Gradient hero stops (135°)
    imgFrom: sell ? '#1f6b4a' : '#3b6fd4',
    imgTo: sell ? greenDarkest : '#1c3f8f',
    // Tints
    priceBg: sell ? '#F0F8F3' : buyBlueSurface, // #EEF3FE
    priceLabelColor: sell ? greenDark : buyBlue, // #16794A / #2563EB
    demandBg: sell ? '#F0F8F3' : buyBlueSurface,
    demandBorder: sell ? '#CDE8D8' : '#CFE0FB',
    // Accents
    accent: sell ? greenDark : buyBlue, // #16794A / #2563EB
    accentShadow: sell ? 'rgba(22,121,74,0.55)' : 'rgba(37,99,235,0.45)',
  };
}

// Constant, mode-independent (spec §5)
const MARKET_COLOR = greenDarkest; // #0E3B2E

/* -------------------------------------------------------------------------- */
/*  Staggered-reveal delays (spec §6 DRAFT recipe)                             */
/* -------------------------------------------------------------------------- */

const DELAY = {
  pill: 100,
  headline: 150,
  card: 200,
  specBase: 200, // + i*80
  specStagger: 80,
  price: 320,
  demand: 400,
  ctaPrimary: 450,
  ctaSecondary: 530,
} as const;

/* -------------------------------------------------------------------------- */

export default function LabDraft() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();

  // `mode` carried from Home via the composer store (read-only here).
  const mode = useComposer((s) => s.mode);

  // Data source is flag-gated. FLAG OFF → the verbatim Phase-1 static path
  // (`DRAFT_DATA[mode]`) with zero regression. FLAG ON → the live listing draft
  // streamed into `threadStore.turn.draft` on the previous (Processing) screen,
  // mapped onto the identical `DraftData` shape (fields fill in cumulatively as
  // frames arrive — `draftFromFrame` falls back to the static copy for any slot
  // not yet resolved, so the card is always coherent; replace-in-place, keyed).
  // Subscribe to `turn.draft` only when live so the static build never re-renders
  // on stream frames.
  const liveDraftFrame = useThread((s) => (LAB_CHAT_ENABLED ? s.turn.draft : undefined));
  const data: DraftData = LAB_CHAT_ENABLED
    ? draftFromFrame(liveDraftFrame, mode)
    : DRAFT_DATA[mode];
  const vm = useMemo(() => getVM(mode, data), [mode, data]);

  // ── Live Publish wiring (LAB_CHAT_ENABLED) ────────────────────────────────
  // The Publish CTA is a real mutation ONLY when the flag is on AND a live draft
  // actually streamed in on the previous (Processing) screen. Otherwise the
  // screen keeps its verbatim static navigation (no regression).
  const isLivePublish = LAB_CHAT_ENABLED && liveDraftFrame != null;

  // The assistant writes the listing/request only on the literal "CONFIRM CREATE"
  // turn (spec 04 §5.3 / 02 §3.2 seller flow). We send that turn via `useLabTurn`
  // (single-flight orchestration), then navigate on the terminal frame.
  const labTurn = useLabTurn();
  const [submitting, setSubmitting] = useState(false);
  // Single-flight guard: a fast double-tap or a re-render must not open a second
  // CONFIRM CREATE turn (mirrors the web `wtbSavedRef` create-once guard).
  const submitRef = useRef(false);
  // Guards the one-time navigation off the terminal frame.
  const navigatedRef = useRef(false);
  // Turn frames the terminal-detection effect reads. Subscribed only when live so
  // the static build never re-renders on stream state.
  const turnStatus = useThread((s) => (LAB_CHAT_ENABLED ? s.turn.status : 'idle'));
  const turnCards = useThread((s) => (LAB_CHAT_ENABLED ? s.turn.cards : EMPTY_CARDS));
  // Card count captured at submit time — a NEW terminal card after this index is
  // the create result (the CONFIRM CREATE turn appends to the existing `turn`; it
  // does not reset it, so we watch for growth past the pre-submit baseline).
  const baselineCardsRef = useRef(0);

  // Entrance builders — honor reduced motion (RISE/POP → FadeIn, no stagger).
  const enterRise = (delay: number) => (reduced ? reducedFade(delay) : rise(delay));
  const enterPop = (delay: number) => (reduced ? reducedFade(delay) : pop(delay));

  // SE (< 400px) large-type scale-down. Applied consistently to the H1 headline
  // AND the card's secondary large type (card title, price value) so the small-
  // screen survival rule isn't half-applied to only the headline.
  const isSmall = width < 400;
  const headlineSize = isSmall ? 23 : 26;
  const headlineLine = isSmall ? 25 : 28;
  const titleSize = isSmall ? 18 : 19;
  const priceValueSize = isSmall ? 22 : 24;

  // Bespoke Back button press-scale (0.97, matches Button).
  const back = usePressScale();

  const FOOTER_SPACER = 140; // ScrollView bottom pad so content clears the footer

  const onBack = () => {
    haptics.tap();
    router.back(); // → Home (flow reset owned by the shell)
  };

  const goToPublished = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace('/(lab)/(tabs)/published');
  }, [router]);

  const onPublish = useCallback(() => {
    haptics.impact(); // MEDIUM — primary action

    // Static path (flag off, or the flag is on but no live draft streamed in):
    // keep the exact Phase-1 navigation. No mutation, no submitting state.
    if (!isLivePublish) {
      goToPublished();
      return;
    }

    // Live path: send the literal "CONFIRM CREATE" turn — the assistant creates
    // the listing (sell → `listing_created`) / request (buy → `wtb_request`) only
    // on this confirmation (spec 04 §5.3). `useLabTurn` is itself single-flight,
    // but we also guard here so a double-tap never opens a second turn or double-
    // navigates. Baseline the current card count so the terminal-detection effect
    // recognizes the NEW result card the turn appends.
    if (submitRef.current) return;
    submitRef.current = true;
    baselineCardsRef.current = useThread.getState().turn.cards.length;
    setSubmitting(true);
    void labTurn.start(CONFIRM_CREATE);
  }, [isLivePublish, goToPublished, labTurn]);

  // Terminal-frame → Published (live path only). The CONFIRM CREATE turn folds
  // frames into the shared `turn`; a create-result card appearing past the
  // pre-submit baseline, or the terminal `done`, means the write landed. On
  // `error` clear the submitting state so the CTA is retriable (draft intact).
  useEffect(() => {
    if (!isLivePublish || !submitting) return;
    if (turnStatus === 'error') {
      submitRef.current = false;
      setSubmitting(false);
      toast(t('mobile.labDraft.publishFailed'));
      return;
    }
    const createdCard = turnCards
      .slice(baselineCardsRef.current)
      .some((c) => (CREATE_DONE_TYPES as readonly string[]).includes(c.type));
    if (createdCard || turnStatus === 'done') {
      setSubmitting(false);
      goToPublished();
    }
  }, [isLivePublish, submitting, turnStatus, turnCards, goToPublished]);

  // Abort any in-flight CONFIRM CREATE turn if the screen unmounts mid-submit.
  useEffect(() => () => labTurn.abort(), [labTurn]);

  const onEdit = () => {
    haptics.tap();
    toast(t('mobile.labDraft.editComingSoon'));
  };

  const publishHint = t(`mobile.labDraft.publishHint.${mode}`);

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={['top']}
      // Unify the surface with the sticky footer (which paints brand.background
      // #f8f9ff): the scroll content and footer now share one color so the
      // footer hairline reads as a clean edge, not a color seam.
      style={{ backgroundColor: brand.background }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: FOOTER_SPACER + insets.bottom }}
        decelerationRate="normal"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header row ─────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <AnimatedPressable
            onPress={onBack}
            onPressIn={back.onPressIn}
            onPressOut={back.onPressOut}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.labDraft.backA11y')}
            // Sole nav affordance — guarantee ≥ the 48pt layout.minTouch target
            // in both axes (content is only ~29pt tall / ~55pt wide on its own).
            hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            style={[styles.backBtn, back.style]}
          >
            <ChevronLeft size={17} color={DRAFT_COLORS.inkBack} strokeWidth={2.2} />
            <Text style={styles.backLabel}>{t('mobile.labDraft.back')}</Text>
          </AnimatedPressable>
        </View>

        {/* ── "AI drafted" pill ──────────────────────────────────────── */}
        <Animated.View entering={enterPop(DELAY.pill)} style={styles.pillWrap}>
          <View
            style={styles.pill}
            accessibilityLabel={t('mobile.labDraft.aiDrafted')}
          >
            <DraftSparkle size={14} color={greenMedium} />
            <Text style={styles.pillText}>{t('mobile.labDraft.aiDrafted')}</Text>
          </View>
        </Animated.View>

        {/* ── Headline + subcopy ─────────────────────────────────────── */}
        <Animated.View entering={enterRise(DELAY.headline)} style={styles.block}>
          <Text
            accessibilityRole="header"
            style={[
              styles.headline,
              { fontSize: headlineSize, lineHeight: headlineLine },
            ]}
          >
            {t(`mobile.labDraft.headline.${mode}`)}
          </Text>
          <Text style={styles.subcopy}>{t('mobile.labDraft.subcopy')}</Text>
        </Animated.View>

        {/* ── Listing / request card ─────────────────────────────────── */}
        {/* Shadow on the outer wrapper; overflow:hidden on the inner card so
            iOS shadows aren't clipped (spec §2d note). */}
        <Animated.View entering={enterPop(DELAY.card)} style={styles.block}>
          <View style={[styles.cardShadow, DRAFT_SHADOWS.card]}>
            <View style={styles.card}>
              {/* Gradient hero */}
              <View style={styles.hero}>
                <LinearGradient
                  colors={[vm.imgFrom, vm.imgTo] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <DraftEquipmentGlyph size={62} />

                {/* Badge cluster */}
                <View style={styles.badgeCluster}>
                  <View style={[styles.marketBadge]}>
                    <Text style={[styles.marketBadgeText, { color: MARKET_COLOR }]}>
                      {vm.market}
                    </Text>
                  </View>
                  <View style={styles.sourceBadge}>
                    <Check size={11} color="#fff" strokeWidth={2.4} />
                    <Text style={styles.sourceBadgeText}>{t(`mobile.labDraft.source.${mode}`)}</Text>
                  </View>
                </View>
              </View>

              {/* Card body */}
              <View style={styles.cardBody}>
                <Text style={[styles.title, { fontSize: titleSize }]}>{vm.title}</Text>

                {/* Location */}
                <HStack gap="sm" style={styles.locationRow}>
                  <MapPin size={14} color={DRAFT_COLORS.inkSub} strokeWidth={2} />
                  <Text style={styles.location}>{vm.location}</Text>
                </HStack>

                {/* Specs table */}
                <View style={styles.specsTable}>
                  {vm.specs.map((row, i) => (
                    <Animated.View
                      key={row.k}
                      entering={
                        reduced
                          ? reducedFade(DELAY.specBase + i * DELAY.specStagger)
                          : pop(DELAY.specBase + i * DELAY.specStagger)
                      }
                    >
                      <HStack justify="space-between" style={styles.specRow}>
                        <Text style={styles.specKey}>{row.k}</Text>
                        <Text style={styles.specVal}>{row.v}</Text>
                      </HStack>
                    </Animated.View>
                  ))}
                </View>

                {/* Price block */}
                <Animated.View
                  entering={enterPop(DELAY.price)}
                  style={[styles.priceBlock, { backgroundColor: vm.priceBg }]}
                >
                  <View style={styles.priceLeft}>
                    <Text style={[styles.priceLabel, { color: vm.priceLabelColor }]}>
                      {t(`mobile.labDraft.priceLabel.${mode}`)}
                    </Text>
                    <Text style={[styles.priceValue, { fontSize: priceValueSize }]}>{vm.price}</Text>
                  </View>
                  <Text style={styles.priceHint}>{vm.priceHint}</Text>
                </Animated.View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Demand callout ─────────────────────────────────────────── */}
        <Animated.View entering={enterPop(DELAY.demand)} style={styles.demandOuter}>
          <View
            accessibilityLabel={`${vm.demandTitle}. ${t(`mobile.labDraft.demandSub.${mode}`)}`}
            style={[
              styles.demand,
              { backgroundColor: vm.demandBg, borderColor: vm.demandBorder },
            ]}
          >
            <View style={[styles.demandTile, { backgroundColor: vm.accent }]}>
              <Users size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.demandTextWrap} importantForAccessibility="no-hide-descendants">
              <Text style={styles.demandTitle}>{vm.demandTitle}</Text>
              <Text style={styles.demandSub}>{t(`mobile.labDraft.demandSub.${mode}`)}</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Sticky footer CTAs (siblings of the ScrollView — never scroll) ── */}
      <View
        style={[
          styles.footer,
          { paddingBottom: 12 + insets.bottom },
        ]}
      >
        <Animated.View entering={enterPop(DELAY.ctaPrimary)}>
          <Button
            size="sm"
            haptic={false}
            loading={submitting}
            label={t(`mobile.labDraft.publishLabel.${mode}`)}
            onPress={onPublish}
            accessibilityHint={publishHint}
            style={{
              backgroundColor: vm.accent,
              height: 54,
              borderRadius: 16,
              ...DRAFT_SHADOWS.cta(vm.accentShadow),
            }}
          />
        </Animated.View>
        <Animated.View entering={enterPop(DELAY.ctaSecondary)}>
          <Button
            variant="secondary"
            size="sm"
            haptic={false}
            disabled={submitting}
            label={t('mobile.labDraft.editDetails')}
            onPress={onEdit}
            accessibilityHint={t('mobile.labDraft.editComingSoon')}
            style={{
              borderWidth: 1.4,
              borderColor: DRAFT_COLORS.secondaryBorder,
              backgroundColor: '#fff',
              height: 54, // match the primary CTA height for an even stacked-CTA block (was sm 48)
              borderRadius: 16,
            }}
          />
        </Animated.View>
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md, // clears the Dynamic Island beyond the top inset
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10, // 10 + 17px chevron + 10 = ~37pt box; hit-slop lifts it past 48pt minTouch
    alignSelf: 'flex-start',
  },
  backLabel: {
    color: DRAFT_COLORS.inkBack,
    fontSize: 13,
    fontFamily: fonts.semibold, // Inter 600 ≈ weight 600
  },

  block: { paddingHorizontal: GUTTER },

  // AI pill
  pillWrap: {
    paddingHorizontal: GUTTER,
    marginTop: 8,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: DRAFT_COLORS.pillBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillText: {
    color: DRAFT_COLORS.pillText,
    fontSize: 11.5,
    fontFamily: fonts.bold, // Inter 700
  },

  // Headline
  headline: {
    fontFamily: fonts.headingBold, // Hanken 800 (loaded)
    color: DRAFT_COLORS.ink,
    letterSpacing: -0.52,
    marginBottom: 6,
  },
  subcopy: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: DRAFT_COLORS.inkSub,
    marginBottom: 18,
  },

  // Card
  cardShadow: {
    borderRadius: 22,
    backgroundColor: brand.surface,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: DRAFT_COLORS.cardBorder,
    backgroundColor: brand.surface,
    overflow: 'hidden',
  },
  hero: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCluster: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 6,
    alignItems: 'flex-start',
  },
  marketBadge: {
    backgroundColor: DRAFT_COLORS.marketBadgeBg,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
  },
  marketBadgeText: {
    fontFamily: fonts.headingBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DRAFT_COLORS.sourceBadgeBg,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
  },
  sourceBadgeText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 10,
  },

  cardBody: {
    paddingTop: 16,
    paddingHorizontal: 17,
    paddingBottom: 18,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 19,
    lineHeight: 22,
    color: DRAFT_COLORS.ink,
    letterSpacing: -0.19,
  },
  locationRow: {
    marginTop: 7,
  },
  location: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: DRAFT_COLORS.inkSub, // #6B7A72 (~5:1 on white) — inkMeta #7C8A82 fails AA at this size
    flexShrink: 1,
  },

  // Specs
  specsTable: {
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: DRAFT_COLORS.specDivider,
    gap: 11,
  },
  specRow: {
    gap: 12,
  },
  specKey: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: DRAFT_COLORS.inkSub, // #6B7A72 (~5:1 on white) — inkMeta #7C8A82 fails AA at this size
    flexShrink: 0,
  },
  specVal: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: DRAFT_COLORS.ink,
    textAlign: 'right',
    flexShrink: 1,
  },

  // Price block
  priceBlock: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceLeft: { flexShrink: 1 },
  priceLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.55,
  },
  priceValue: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    color: DRAFT_COLORS.ink,
    marginTop: 1,
  },
  priceHint: {
    fontFamily: fonts.regular,
    fontSize: 12, // lifted from 11 — readable body min, off the sub-12 cluster
    lineHeight: 16,
    color: DRAFT_COLORS.inkMetaTint, // sits on the tinted price bg — inkSub #6B7A72 dips to ~4.1:1 there, so use the darker tint-meta ink for AA
    textAlign: 'right',
    maxWidth: 120,
  },

  // Demand callout
  demandOuter: {
    paddingHorizontal: GUTTER,
    marginTop: 14,
  },
  demand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  demandTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demandTextWrap: { flex: 1 },
  demandTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
    color: DRAFT_COLORS.ink,
  },
  demandSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: DRAFT_COLORS.inkMetaTint, // sits on the tinted sell/buy demand bg — darker tint-meta ink keeps it AA (inkSub #6B7A72 dips below 4.5:1 here)
    marginTop: 2,
  },

  // Sticky footer
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    backgroundColor: brand.background, // #f8f9ff, opaque
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DRAFT_COLORS.footerHairline,
    gap: 10,
  },
});
