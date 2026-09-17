/**
 * `ScrimPill` — a pill that sits ON a photograph.
 *
 * The "1 of 3" counter over a photo, the "Rearrange" control, a "Cover" tag.
 * Two heights: a short static caption, and a taller one when it is tappable.
 *
 * ── WHY THIS IS IN THE KIT AND NOT IN A SCREEN ──
 *
 * It carries the over-photography discipline, and that is precisely the thing
 * that must not be re-derived per screen. **`scrimPill` and `onScrimPill` DO
 * NOT FLIP BY SCHEME**, because a photograph is the same photograph in dark
 * mode. Reaching for `surface`/`ink` here — the reflex, since they are the
 * card roles everywhere else — puts near-black text on a near-black photo in
 * dark, or a white slab over a bright one. That has shipped in this app once
 * already (the banner in `PromoBanner`'s docstring).
 *
 * So: never pass a colour in. The roles are fixed and the component owns them.
 *
 * ── TWO TONES, AND THE CANVAS PICKS ──
 *
 * `light` is the default: `rgba(255,255,255,.94)` with dark ink, the pill the
 * canvas gives a banner CTA and the round controls on a listing hero.
 * `scrim` is its inverse — `rgba(22,38,31,.82)` with white ink — which is what
 * the canvas gives the "1 / 9" photo counter (`t2-full.html:24`).
 *
 * They are not interchangeable. Both sit on photography, so the choice is about
 * WEIGHT: a light pill is the loudest thing on a hero and belongs to whatever
 * the hero wants pressed; a dark scrim recedes and belongs to a caption. Giving
 * a photo count the light pill makes the count outshout the actions beside it.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
// `Pressable` from GESTURE HANDLER, not react-native — RN's is intercepted by
// RNGH inside a gesture container. See `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';

import { control, radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';

import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ScrimPillTone = 'light' | 'scrim';

export function ScrimPill({
  label,
  glyph,
  tone = 'light',
  onPress,
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  /** Leading icon at `icon.sm`. Tint it `c.onScrimPill` / `c.onScrim` to match `tone`. */
  glyph?: ReactNode;
  /** `light` for a CTA on a banner, `scrim` for a caption on a photo. See above. */
  tone?: ScrimPillTone;
  /** Omit for a static caption — it then renders as a plain View, not a button. */
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });

  const dark = tone === 'scrim';

  const body = (
    <>
      {glyph}
      <Text variant={onPress ? 'captionMedium' : 'small'} color={dark ? 'onScrim' : 'onScrimPill'}>
        {label}
      </Text>
    </>
  );

  const base = [
    styles.pill,
    // A tappable pill is 34pt; a caption is 26pt and must never be tapped.
    onPress ? styles.tall : styles.short,
    { backgroundColor: dark ? c.scrimStrong : c.scrimPill },
    style,
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={base}>
        {body}
      </View>
    );
  }

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      // 34pt is under the 44pt minimum, and it has to be: the drawn pill sits
      // on a photo and a 44pt slab would cover the thing it labels.
      hitSlop={space.md}
      style={[...base, animatedStyle]}
    >
      {body}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
  },
  short: { height: control.chipSm, paddingHorizontal: space.xl },
  tall: { height: control.chip, paddingHorizontal: space['2xl'] },
});
