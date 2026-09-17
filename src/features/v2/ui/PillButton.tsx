/**
 * `PillButton` — a tappable pill with a selected state.
 *
 * `Chip` is the decorative sibling: it carries a value and is hidden from
 * screen readers. This one is a control.
 *
 *   choice  40pt. `surface` when off, filled `accent` with a ✓ when on. The
 *           shape every either/or in the review flow is drawn as.
 *   soft    34pt `accentWash` — a quiet assist beside a label ("Use my location").
 *   filled  34pt `accent` with `onAccent` ink — the ONE action inside a card,
 *           where `PrimaryAction`'s 54pt slab would outweigh the card holding
 *           it ("Use this" on 3a's priced answer). Same measure as `soft`, so
 *           a row can mix them; the difference is weight, not size.
 *   ghost   46pt, no ground, accent ink — "Add another location".
 *
 * ── `role` is not a detail ──
 *
 * A `choice` pill defaults to `role="radio"`, which tells a screen-reader user
 * that picking one clears the others. That is right for currency or price mode
 * and WRONG for condition, where `DraftItem.condition` is a `string[]` and
 * "Waste disposal" and "Demolition / removal" legitimately co-occur. Pass
 * `role="checkbox"` for a multi-select, or the interface lies about what the
 * tap will do.
 *
 * Press feedback is `usePressFeedback`, never `style={({pressed}) => …}`:
 * NativeWind's interop spreads `style`, spreading a function yields `{}`, and
 * the whole state disappears at runtime while Jest still passes.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import {
  CARD_PAD,
  control,
  icon,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PillTone = 'choice' | 'soft' | 'filled' | 'ghost';

export function PillButton({
  label,
  onPress,
  tone = 'choice',
  selected = false,
  role = 'radio',
  glyph,
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: PillTone;
  /** `choice` only — draws the fill and the ✓, and sets the selected state. */
  selected?: boolean;
  /** `checkbox` for a multi-select group. See the note above — this matters. */
  role?: 'radio' | 'checkbox';
  /** Leading glyph for `soft` / `ghost`. Size it at `icon.md`. */
  glyph?: ReactNode;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });

  const choice = tone === 'choice';
  const on = choice && selected;

  const ground =
    tone === 'soft'
      ? c.accentWash
      : tone === 'filled'
        ? c.accent
        : tone === 'ghost'
          ? 'transparent'
          : on
            ? c.accent
            : c.surface;
  const inkColor =
    on || tone === 'filled' ? 'onAccent' : tone === 'choice' ? 'ink' : 'accentInk';

  /** The ROLE `ground` came from — what the ramp is built on. `null` = no fill. */
  const materialRole =
    tone === 'soft'
      ? ('accentWash' as const)
      : tone === 'filled'
        ? ('accent' as const)
        : tone === 'ghost'
          ? null
          : on
            ? ('accent' as const)
            : ('surface' as const);

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole={choice ? role : 'button'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        choice
          ? role === 'checkbox'
            ? { checked: selected, disabled }
            : { selected, disabled }
          : { disabled }
      }
      // The pills are 34–46pt tall. `soft` in particular is below the 44pt
      // minimum, so every tone gets the difference back in hitSlop rather than
      // growing the drawn shape.
      hitSlop={{ top: space.sm, bottom: space.sm, left: space.xs, right: space.xs }}
      style={[
        styles.pill,
        tone === 'soft' || tone === 'filled'
          ? styles.soft
          : tone === 'ghost'
            ? styles.ghost
            : styles.choice,
        { backgroundColor: ground },
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {/*
        Material. `PillButton` is a thing a finger touches with a fill to ramp,
        so the house rule ("depth goes on things a finger touches, and on
        cards") applies — it was simply missed when the kit was rolled through,
        the same way `IconAction` was, and for the same reason: nobody LOOKED at
        a screen full of material controls and noticed the one flat one.

        The ramp takes the role the ground was resolved from, never a colour, so
        it cannot disagree with `backgroundColor` above. `ghost` has no fill to
        ramp and is on the deliberately-flat list beside `QuietAction`.
        No shadow: these ride the review flow's scrolling steps, and a shadow is
        `elevation` on Android — the same draw-pass cost that keeps shadows off
        everything but `PrimaryAction`.
      */}
      {materialRole ? (
        <MaterialFill role={materialRole} ink={inkColor} radius={radius.pill} />
      ) : null}
      {on ? <Check size={icon.md} color={c.onAccent} strokeWidth={2} /> : glyph}
      <Text variant={choice ? 'bodyMedium' : 'captionMedium'} color={inkColor}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    // Clips the gradient to the pill, like `IconAction`. RNGH's Pressable does
    // not clip children the way RN's does, and `PromoBanner` already lost its
    // corners to exactly this.
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
  },
  choice: { height: control.avatar, paddingHorizontal: CARD_PAD },
  soft: { height: control.chip, paddingHorizontal: space.xl },
  ghost: { height: control.thumb, paddingHorizontal: space.xl },
  disabled: { opacity: 0.45 },
});
