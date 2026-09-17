/**
 * `Stepper` — the quantity control: `[−]  1  [+]`.
 *
 * ── Two accessibility decisions worth keeping ──
 *
 * **One accessible element, not three.** `role="adjustable"` with an
 * `accessibilityValue` announces "Quantity, 1" and lets the volume keys change
 * it. The alternative — two buttons either side of an unlabelled number —
 * announces as "minus button, 1, plus button", which says nothing about what
 * is being counted. The two halves are therefore hidden from the reader and
 * the actions are handled on the container.
 *
 * **The halves are `MIN_TOUCH` wide and stretch the full height**, rather than
 * a small glyph with `hitSlop`. hitSlop large enough to reach 44pt here would
 * make the two targets OVERLAP across the number between them, so a tap near
 * the middle would decrement when you meant to increment. That is worse than a
 * small target: it is a target that does the opposite of what you aimed at.
 *
 * `−` dims at the floor rather than disappearing — a control that vanishes
 * makes the row reflow under your thumb mid-tap.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Minus, Plus } from 'lucide-react-native';

import {
  MIN_TOUCH,
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

export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  testID,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  /** Optional ceiling — `+` dims at it, the same way `−` dims at the floor. */
  max?: number;
  /** What is being counted — "Quantity". Required: it is the announcement. */
  label: string;
  testID?: string;
}) {
  const c = useV2Colors();
  const atFloor = value <= min;
  const atCeiling = max !== undefined && value >= max;

  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max === undefined ? value + 1 : Math.min(max, value + 1));

  // Docs/UIUXRuleSet/responsiveness.md R4, one instance per half — a stepper is
  // pressed repeatedly, so "did that one land?" is the whole question. `scale:
  // false`: the halves sit inside a filled control with a fixed radius, and
  // shrinking one half would pull it away from that edge.
  const minus = usePressFeedback({ scale: false });
  const plus = usePressFeedback({ scale: false });

  return (
    <View
      testID={testID}
      style={[styles.stepper, { backgroundColor: c.surface }]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') inc();
        if (e.nativeEvent.actionName === 'decrement') dec();
      }}
    >
      {/* A filled control a finger touches, so it ramps like the rest.
          Caught by `v2MaterialCoverage.test.ts`, not by eye. */}
      <MaterialFill role="surface" ink="ink" radius={radius.md} />
      <AnimatedPressable
        onPress={dec}
        onPressIn={minus.onPressIn}
        onPressOut={minus.onPressOut}
        disabled={atFloor}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.half, atFloor && styles.disabled, minus.animatedStyle]}
      >
        <Minus size={icon.lg} color={c.inkSubtle} strokeWidth={2} />
      </AnimatedPressable>

      <Text variant="action" style={styles.value}>
        {String(value)}
      </Text>

      <AnimatedPressable
        onPress={inc}
        onPressIn={plus.onPressIn}
        onPressOut={plus.onPressOut}
        disabled={atCeiling}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.half, atCeiling && styles.disabled, plus.animatedStyle]}
      >
        <Plus size={icon.lg} color={c.ink} strokeWidth={2} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: control.input,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  half: {
    width: MIN_TOUCH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { textAlign: 'center', minWidth: space['5xl'] },
  disabled: { opacity: 0.45 },
});
