/**
 * `PromoBanner` — a photograph with a caption over a scrim.
 *
 * The only pictorial element in the design, and the only place a light pill
 * appears. Its height uses `scaleW` because it is a picture: held at a fixed
 * 150pt it looks cramped on a large phone and oversized on a small one, unlike
 * type and touch targets, which must not scale.
 *
 * ⚠️ THE CAPTION DOES NOT FLIP BY SCHEME. It sits on a photograph, and a
 * photograph is the same photograph in dark mode. Colours come from the
 * `onScrim*` roles, which are deliberately identical in both palettes —
 * see `theme/v2/palette.ts`. Using `ink`/`base` here would put near-black text
 * on a near-black scrim over an arbitrary image.
 *
 * With no `source`, it falls back to a flat `scrimFallback` ground: the caption
 * keeps its contrast and the block keeps its height, so a missing asset
 * degrades rather than collapsing the layout. **Both banners are in that state
 * today** — the two photographs are not in the repo — so this is the normal
 * path, not a rare one.
 *
 * That fallback is `scrimFallback` and NOT `ink` — `ink` flips, and in dark it
 * is near-white, which turned this banner into a white slab with a grey smear
 * across it. Caught on device; no test would have found it.
 *
 * ⚠️ THE GRADIENT IS ONLY DRAWN OVER A PHOTOGRAPH. Its whole job is to make a
 * caption readable over an image nobody has seen yet. On the flat fallback —
 * a ground already chosen for that contrast — it is redundant in light and
 * actively wrong in dark, where it took the bottom of the card BELOW the page
 * ground and erased the card's own edge. Seen on a phone in dark: bare text
 * and a floating white pill, no card.
 */
import React from 'react';
import {
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';

import {
  CARD_PAD,
  GUTTER,
  control,
  icon,
  radius,
  scaleW,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Drawn at 150pt on the 390pt reference frame. */
const BANNER_HEIGHT = 150;

export function PromoBanner({
  eyebrow,
  headline,
  actionLabel,
  onPress,
  source,
  style,
  testID,
}: {
  /** Tracked caps over the photo — "FOR SELLERS". */
  eyebrow: string;
  headline: string;
  /** "See what sells". Says what happens, not "Learn more". */
  actionLabel: string;
  onPress: () => void;
  /** Omit and the banner uses a flat ground rather than collapsing. */
  source?: ImageSourcePropType;
  /** Outer spacing. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${actionLabel}`}
      style={[styles.banner, { height: scaleW(BANNER_HEIGHT) }, animatedStyle, style]}
    >
      {/*
        Both fills carry the radius THEMSELVES rather than trusting the
        parent's `overflow: 'hidden'` to clip them.

        ⚠️ They used to rely on that clip and it silently stopped working when
        the kit moved to gesture-handler's `Pressable` — RNGH does not clip its
        children the way RN's Pressable did, so the square fill painted over
        all four rounded corners. Measured off a screenshot: the corner pixel
        went from #FFFFFF (page showing through) to the card colour. A child
        that needs to be round should say so itself.
      */}
      {source ? (
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, styles.fill]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: c.scrimFallback }]}>
          {/* Material on the stand-in ground only — never over a photograph,
              and no shadow: this banner rides Home's swiping pane. */}
          <MaterialFill role="scrimFallback" ink="onScrim" radius={radius.xl} />
        </View>
      )}

      {source ? (
        /*
          The canvas ramp, all four stops (`6a.html`):
            rgba(6,28,20,.18) 0% · .34 40% · .62 70% · .82 100%

          It was `['transparent', scrim, scrimStrong]` at `[0, 0.45, 1]` — the
          two end stops right, the 0.18 floor and the 0.62 knee missing, and the
          mid stop 5% late. That reads as "close enough" until a photograph is
          actually behind it: measured on the real banner image, the eyebrow sat
          at 3.77:1 and the headline at 3.22:1, and the backdrop under the
          caption swung from rgb(2,9,6) to rgb(185,228,206) across its own width.
          A flat stand-in ground hid all of that for the whole build.
        */
        <LinearGradient
          colors={[c.scrimSoft, c.scrim, c.scrimMid, c.scrimStrong]}
          locations={[0, 0.4, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/*
        THE SECOND SCRIM. The canvas banner stacks two, and missing this one is
        why the caption measured short even after the full-bleed ramp was fixed:

          <div style="position:absolute;inset:0;background:linear-gradient(…)">   ← the one above
          <div style="…bottom:0;padding:26px 20px 18px;background:
               linear-gradient(180deg,rgba(6,28,20,0) 0%,.80 26%,.92 100%)">      ← this one

        So the caption is not sitting on the photo's ramp — it carries its own,
        far darker, and reaches .80 within a quarter of its own height. With only
        the first, the eyebrow measured 4.00:1 against AA's 4.5.

        Transparent stops when there is no photo: the flat `scrimFallback` ground
        already gives the caption a constant contrast, and layering a gradient on
        it would just dirty a solid colour.
      */}
      <LinearGradient
        colors={
          source
            ? ['transparent', c.scrimStrong, c.scrimDeep]
            : ['transparent', 'transparent', 'transparent']
        }
        locations={[0, 0.26, 1]}
        style={styles.caption}
      >
        <Text variant="eyebrow" color="onScrimTint">
          {eyebrow}
        </Text>
        <Text variant="h3" color="onScrim" style={styles.headline}>
          {headline}
        </Text>
        <View style={[styles.pill, { backgroundColor: c.scrimPill }]}>
          <Text variant="captionMedium" color="onScrimPill">
            {actionLabel}
          </Text>
          <ArrowRight size={icon.sm} color={c.onScrimPill} />
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fill: { borderRadius: radius.xl },
  banner: {
    marginHorizontal: GUTTER,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  caption: { padding: CARD_PAD, paddingTop: space['6xl'] },
  headline: { marginTop: space.sm, maxWidth: 250 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
    height: control.chip,
    paddingHorizontal: space['3xl'],
    borderRadius: radius.pill,
  },
});
