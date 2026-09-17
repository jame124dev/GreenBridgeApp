/**
 * `PrimaryAction` — the one green pill. "Scan it".
 *
 * 54pt tall, fully rounded, `accent` filled, 15pt/500 label, optional leading
 * icon at 20pt with a 10pt gap. There is at most ONE of these visible at a
 * time; that is the rule the design is built on and the reason it reads as
 * calm. A second green pill on the same screen means the screen has two
 * primary actions and needs a decision, not a component.
 *
 * Press feedback comes from `usePressFeedback`, NOT from Pressable's
 * `({ pressed })` style callback — NativeWind's interop spreads the `style`
 * prop, and spreading a function yields `{}`, so the function form is silently
 * deleted at runtime and the button never reacts. See `theme/v2/motion.ts`.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import {
  control,
  lift,
  material,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
  useV2Theme,
} from '@/theme/v2';

import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PrimaryAction({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  variant = 'filled',
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Rendered at `icon.xl` (20pt) to the left of the label. */
  icon?: React.ReactNode;
  /** Shows a spinner and blocks the press. Keep the label — a bare spinner says nothing about what is happening. */
  loading?: boolean;
  disabled?: boolean;
  /**
   * `tinted` is the same shape on `accentWash` — for a real second action
   * beneath the primary one. `quiet` is the same shape with no fill at all.
   *
   * ⚠️ Prefer `tinted` over `quiet` on any surface where the button must read
   * as a button. `quiet` draws its outline in `hairlineStrong`, which measures
   * 1.27:1 on `base` in light and 1.89:1 in dark — far under the 3:1 that
   * WCAG 1.4.11 asks of a control's visible boundary, so the pill shape is not
   * actually perceivable and what is left is a green label with padding. A
   * ground change carries much further than a hairline: `accentWash` separates
   * from `surface` by dE 7.3 (light) / 15.0 (dark).
   */
  variant?: 'filled' | 'tinted' | 'quiet';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();
  const { scheme } = useV2Theme();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
  const inert = disabled || loading;
  const filled = variant === 'filled';
  const outlined = variant === 'quiet';
  /*
    Material. The ramp runs AWAY from the label — down from `accent` under
    white, up to `accentWash` under `accentInk` — so no part of the pill is
    worse for contrast than the flat fill was. See `theme/v2/material.ts`.
  */
  const m = outlined
    ? null
    : filled
      ? material(c, scheme, 'accent', 'onAccent')
      : material(c, scheme, 'accentWash', 'accentInk');

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: filled ? c.accent : outlined ? 'transparent' : c.accentWash,
          borderColor: outlined ? c.hairlineStrong : 'transparent',
          borderWidth: outlined ? 1 : 0,
          opacity: disabled ? 0.45 : 1,
        },
        // A shadow needs something to cast from, so it goes on the pressable
        // and the gradient sits inside it. `quiet` has no fill and so casts
        // nothing — an outline that floats is a box, not a button.
        !outlined && !disabled ? lift.control : null,
        animatedStyle,
        style,
      ]}
    >
      {m ? (
        <>
          {/* Wrapped in a plain View: `pointerEvents` on `LinearGradient` is
              dropped on the New Architecture and the gradient then swallows
              every press. See the note in `Surface.tsx`. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={m.colours}
              locations={m.locations}
              start={GRAD_START}
              end={GRAD_END}
              style={[StyleSheet.absoluteFill, styles.fill]}
            />
          </View>
        </>
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" color={filled ? c.onAccent : c.accentInk} />
      ) : (
        icon ? <View style={styles.icon}>{icon}</View> : null
      )}
      <Text variant="action" color={filled ? 'onAccent' : 'accentInk'}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const GRAD_START = { x: 0, y: 0 } as const;
const GRAD_END = { x: 0, y: 1 } as const;

const styles = StyleSheet.create({
  fill: { borderRadius: radius.pill },
  base: {
    height: control.button,
    borderRadius: radius.pill,
    // The gradient is an absolute child; without this it squares off the pill.
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space['6xl'],
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
