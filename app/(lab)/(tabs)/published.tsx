// (lab) Published — celebration after publish (NewVersion/04-published.md).
// Flow: draft → published → matches. Lives inside (tabs) with href:null so the
// tab bar SHOWS but no tab is highlighted (all idle). "See your matches" flips
// to the Matches tab; "Back to home" returns to the Home tab. Both use
// router.replace so the OS back-gesture never returns to this one-shot success
// screen. Copy + count come from the composer mode; accents stay deep-forest in
// BOTH modes (no buyBlue — spec §4 mode-color rule).
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui';
import { useComposer } from '@/features/lab/stores/composerStore';
// FUTURE DYNAMIC HOOK POINT: replace this static import with
//   const { data } = useQuery(['publishResult', listingId], fetchPublishResult)
// returning { matchedCount, counterpartyType, countries }; render 0/skeleton
// while pending. title/subtitle stay client-composed from mode + resolved count.
import { PUBLISHED_DATA } from '@/features/lab/data/demo';
import {
  CheckBadge,
  MatchCountCard,
  PublishedCTA,
  PUB_C,
} from '@/features/lab/components/publishedComponents';
import { fonts, greenDarkest, motion, spacing } from '@/constants/theme';
import { DURATIONS, reducedFade, rise } from '@/animations/recipes';

// Estimated FrostedTabBar content height (paddingTop 9 + item ~46 + paddingBottom
// 9); insets.bottom is added on top. Kept local — clears the absolute tab bar so
// the ghost CTA is never obscured on a gesture-pill device (spec §7).
const TAB_BAR_CONTENT_H = 64;

export default function LabPublished() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const mode = useComposer((s) => s.mode);
  const data = PUBLISHED_DATA[mode];

  // Small-screen H1 downscale (foundation §C): drop the display H1 below its
  // 28px floor only on narrow devices (iPhone SE, width < 400) so the two-line
  // title wraps cleanly without clipping; full 28/32 everywhere else.
  const { width } = useWindowDimensions();
  const isNarrow = width < 400;
  const headlineSize = isNarrow ? 25 : 28;
  const headlineLine = isNarrow ? 29 : 32;

  // Screen entrance — RISE + scale 0.97→1 (~400ms), the draft → published
  // transition (spec §6). Reduced motion: opacity-only ~200ms fade (no
  // translate/scale). Single shared value set drives one animated style.
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(reduced ? 0 : 10);
  const scale = useSharedValue(reduced ? 1 : 0.97);

  useEffect(() => {
    if (reduced) {
      opacity.value = withTiming(1, { duration: DURATIONS.reduced });
      return;
    }
    opacity.value = withTiming(1, { duration: 400 });
    translateY.value = withSpring(0, motion.spring);
    scale.value = withSpring(1, motion.spring);
  }, [reduced, opacity, translateY, scale]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const headlineEntering = reduced ? reducedFade(0) : rise(300);
  const subtitleEntering = reduced ? reducedFade(0) : rise(350);

  const goMatches = () => {
    // → Matches tab (replace so back-gesture can't return here). FrostedTabBar
    // reads state.index for the active tint, so navigating sets the tab.
    router.replace('/(lab)/(tabs)/matches');
  };
  const goHome = () => {
    router.replace('/(lab)/(tabs)/home');
  };

  return (
    <Screen
      scroll
      padded={false}
      edges={['top']}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing['2xl'] + TAB_BAR_CONTENT_H + insets.bottom },
      ]}
    >
      <Animated.View style={[styles.inner, rootStyle]}>
        <CheckBadge />

        <Animated.Text
          entering={headlineEntering}
          style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineLine }]}
        >
          {t(`mobile.labPublished.title.${mode}`)}
        </Animated.Text>

        <Animated.Text entering={subtitleEntering} style={styles.subtitle}>
          {t(`mobile.labPublished.subtitle.${mode}`)}
        </Animated.Text>

        {/* Card shell POP @450ms; avatars stagger inside starting @500ms.
            Managed-note fade is carried by the card's own reveal. */}
        <Animated.View entering={reduced ? reducedFade(0) : rise(450)}>
          <MatchCountCard
            label={t(`mobile.labPublished.matchLabel.${mode}`)}
            count={data.matchCount}
            note={t('mobile.labPublished.managedNote')}
            avatars={data.avatars}
            ringColor={greenDarkest}
            avatarBaseDelay={500}
          />
        </Animated.View>

        <View style={styles.ctaGroup}>
          <Animated.View entering={reduced ? reducedFade(0) : rise(650)}>
            <PublishedCTA
              label={t('mobile.labPublished.seeMatches')}
              variant="primary"
              onPress={goMatches}
            />
          </Animated.View>
          <Animated.View entering={reduced ? reducedFade(0) : rise(730)}>
            <PublishedCTA
              label={t('mobile.labPublished.backToHome')}
              variant="ghost"
              onPress={goHome}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  inner: {
    flexGrow: 1,
    // Decorative low-centering below the safe-area inset (spec §2), snapped to
    // the 4/8 grid: spacing['6xl'] (72) = spacing['4xl'] 40 + spacing['3xl'] 32.
    paddingTop: spacing['6xl'],
    paddingHorizontal: spacing['2xl'], // 24 — large-screen padding token
  },
  headline: {
    fontFamily: fonts.headingBold,
    // fontSize / lineHeight set inline (width-based H1 downscale); base band is
    // 28/32 (H1 floor, ~1.14 display ratio).
    letterSpacing: -0.5,
    color: PUB_C.headline,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14, // bodySm token
    lineHeight: 20,
    color: PUB_C.subtitle,
    textAlign: 'center',
    maxWidth: 280,
    alignSelf: 'center',
    marginBottom: spacing['2xl'], // 24 — section gap
  },
  ctaGroup: {
    marginTop: spacing['2xl'], // 24 — section gap
    flexDirection: 'column',
    gap: spacing.md, // 12 — CTA rhythm
  },
});
