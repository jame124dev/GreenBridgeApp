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
  const m =
    outlined || disabled
      ? null
      : filled
        ? material(c, scheme, 'accent', 'onAccent')
        : material(c, scheme, 'accentWash', 'accentInk');

  return (
    <AnimatedPressable
      testID={testID}
      /*
        ⚠️ THE HANDLER IS GUARDED, NOT JUST THE PROP.

        `disabled={inert}` below is the right declaration, but it is the only
        thing standing between a `loading` submit button and a SECOND submit,
        and it is not reliable on its own: with the gesture-handler `Pressable`
        a press still reached `onPress` while `accessibilityState.disabled` was
        `true` — caught by `DetailFooter.required.test.tsx`'s "disabled ONLY
        while submitting" case the moment this component replaced the footer's
        own button. Whether that reflects device behaviour or only the test
        environment is not established; either way the cost of the guard is one
        comparison and the cost of being wrong is a duplicate POST.
      */
      onPress={() => {
        if (inert) return;
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={[
        styles.base,
        {
          /*
            ⚠️ DISABLED IS A COLOUR HERE, NOT AN OPACITY — and that is not a
            style preference.

            The obvious `opacity: disabled ? 0.45 : 1` does NOT work on this
            component, whatever position it takes in the style array.
            `usePressFeedback` drives `animatedStyle` through Reanimated, which
            returns `opacity` unconditionally (`1` at rest) and applies it
            IMPERATIVELY to the native view every frame. An imperative write
            beats a static style, so the dim was silently discarded and a
            disabled primary button rendered at full strength: measured on
            device 2026-09-22, the enabled "Take a photo" and the disabled
            "Extract items" were both rgb(40,109,80), to the byte — while
            `disabled` really did block the press. It looked pressable and did
            nothing, which is the worst pairing available.

            Painting the fill instead keeps the decision out of Reanimated's
            reach. The material gradient is also suppressed above, because a
            live gradient over a dead fill reads as enabled again.
          */
          backgroundColor: disabled
            ? c.fill
            : filled
              ? c.accent
              : outlined
                ? 'transparent'
                : c.accentWash,
          borderColor: outlined ? c.hairlineStrong : 'transparent',
          borderWidth: outlined ? 1 : 0,
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
      {/*
        The CONTENT may be dimmed with opacity even though the pill may not:
        Reanimated only drives the root pressable, so a static opacity on a
        CHILD survives. That matters because the caller owns the icon's colour
        (`<Sparkles color={c.onAccent} />`), which would otherwise stay white
        on the muted disabled fill and disappear.
      */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={filled ? c.onAccent : c.accentInk} />
        ) : icon ? (
          /*
            The dim goes on the ICON ALONE, and only when disabled.
            The caller owns the icon's colour (`<Sparkles color={c.onAccent} />`),
            so on the muted disabled fill it would otherwise stay white and
            vanish. The LABEL must not be dimmed as well: `inkDisabled` is
            already the designed disabled ink, and stacking 0.45 on top of it
            measured **1.23:1** against the fill on device — a button whose
            text you cannot read is worse than one that looks enabled.
          */
          <View style={[styles.icon, disabled ? styles.dimmed : null]}>{icon}</View>
        ) : null}
        {/*
          `inkMuted`, not `inkDisabled`, and the reason is measured rather than
          chosen. Against the disabled ground (`fill`, #EDF1EE in light):

            inkDisabled #B4C0B9 → 1.65:1     inkSubtle #8B9A92 → 2.58:1
            inkMuted    #5A6B62 → 4.96:1

          `inkDisabled` is calibrated for the page grounds (`base`/`surface`),
          and on this wash it collapses — 1.63:1 read straight off the device,
          which is a label you cannot read at all. A disabled button still has
          to say what it would do; that is the whole reason it is shown rather
          than hidden. `inkMuted` keeps it clearly secondary AND legible.
        */}
        <Text variant="action" color={disabled ? 'inkMuted' : filled ? 'onAccent' : 'accentInk'}>
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const GRAD_START = { x: 0, y: 0 } as const;
const GRAD_END = { x: 0, y: 1 } as const;

const styles = StyleSheet.create({
  /** The disabled dim. Applied after `animatedStyle` — see the note there. */
  /**
   * Row wrapper so icon + label dim together. See the note at its use.
   *
   * It carries `base`'s gap: once the icon and the label stopped being direct
   * children of the pill, `base.gap` separated this wrapper from nothing and
   * the glyph sat flush against the text.
   */
  content: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  /** Applied to the CONTENT, never the root — Reanimated owns the root. */
  dimmed: { opacity: 0.45 },
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
