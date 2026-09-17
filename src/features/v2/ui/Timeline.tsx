/**
 * `Timeline` — a vertical rail of steps: dot, hairline connector, label.
 *
 * Two uses, one component:
 *  • 7a Analyzing — the five backend extraction phases, `live` while the run
 *    is actually moving.
 *  • 7b–7e Review — the four wizard steps, `live={false}` because nothing is
 *    happening on its own; the person is the one moving.
 *
 * No boxes and no numbered markers. The design separates with rules and space,
 * and a numbered marker would only be right if the reader needed the ordinal —
 * they need to know *where they are*, which the dot says better.
 *
 * ── Motion rules, which are the subtle part ──
 *
 * The dot's size and colour change is MEANINGFUL — it is the app saying where
 * the work reached — so it eases through `timing()` and resolves instantly
 * under Reduce Motion, keeping the end state correct.
 *
 * The ring pulsing off the active dot is DECORATIVE — no end state — so it is
 * gated out entirely by `useMotionEnabled()` rather than run at zero duration,
 * which would strobe.
 *
 * And `live` exists because **a ring pulsing on a stalled run is a lie.** When
 * a stream drops, the dot must stay large (the work did reach that step) but
 * stop breathing (nothing is happening right now).
 *
 * ⚠️ `on` IS NOT COSMETIC — same trap as `ProgressLine`. The connector is
 * `fill`, a ~1.02:1 step against `wash`, so on the green header sheet the rail
 * becomes a row of dots with nothing joining them. Pass `on="wash"` there, or
 * keep the rail in the body. A screen build hit this; the contrast suite could
 * not, because it only checks TEXT against grounds.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  HAIRLINE_WIDTH,
  duration,
  easing,
  radius,
  space,
  timing,
  useMotionEnabled,
  useV2Colors,
} from '@/theme/v2';

import { Text } from './Text';

/** Rail geometry. Drawn marks, deliberately off the space scale. */
const RAIL = 20;
const DOT_ACTIVE = 12;
const DOT_IDLE = 8;
const PULSE_SCALE = 2.4;
const PULSE_OPACITY = 0.45;

export type TimelineStep = {
  label: string;
  /** Shown only while this step is the active one — a live sub-line. */
  detail?: string;
};

type StepState = 'done' | 'active' | 'pending';

export function Timeline({
  steps,
  current,
  live = false,
  on = 'base',
}: {
  steps: readonly TimelineStep[];
  /** Index of the active step. Steps before it are done, after it pending. */
  current: number;
  /**
   * Whether work is actually progressing right now. Drives the pulse only.
   * Pass `false` for a wizard, and `false` the moment a live run stalls.
   */
  live?: boolean;
  /** The ground the rail sits on. `wash` darkens the connector so it stays visible. */
  on?: 'base' | 'wash';
}) {
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: steps.length, now: current }}>
      {steps.map((step, i) => (
        <TimelineRow
          key={step.label}
          label={step.label}
          detail={step.detail}
          state={i < current ? 'done' : i === current ? 'active' : 'pending'}
          pulse={live}
          on={on}
          last={i === steps.length - 1}
        />
      ))}
    </View>
  );
}

function TimelineRow({
  label,
  state,
  detail,
  pulse,
  on,
  last,
}: {
  label: string;
  state: StepState;
  detail?: string;
  pulse: boolean;
  on: 'base' | 'wash';
  last: boolean;
}) {
  const c = useV2Colors();
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <StepDot state={state} pulse={pulse} />
        {last ? null : (
          <View
            style={[
              styles.connector,
              { backgroundColor: on === 'wash' ? c.fillStrong : c.fill },
            ]}
          />
        )}
      </View>

      <View style={[styles.text, last && styles.textLast]}>
        <Text
          variant={state === 'active' ? 'action' : 'lead'}
          color={state === 'active' ? 'ink' : state === 'done' ? 'inkMuted' : 'inkSubtle'}
        >
          {label}
        </Text>
        {state === 'active' && detail ? (
          <Text variant="caption" color="accentInk" style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StepDot({ state, pulse }: { state: StepState; pulse: boolean }) {
  const c = useV2Colors();
  const motionOn = useMotionEnabled();
  const active = state === 'active';
  const beating = active && pulse;

  const grow = useSharedValue(active ? 1 : DOT_IDLE / DOT_ACTIVE);
  const ring = useSharedValue(0);

  useEffect(() => {
    grow.value = withTiming(
      active ? 1 : DOT_IDLE / DOT_ACTIVE,
      timing(duration.base, easing.standard),
    );
  }, [active, grow]);

  useEffect(() => {
    if (!motionOn || !beating) return;
    ring.value = 0;
    ring.value = withRepeat(withTiming(1, timing(duration.ambient, easing.standard)), -1, false);
    return () => {
      cancelAnimation(ring);
      ring.value = 0;
    };
  }, [motionOn, beating, ring]);

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * PULSE_OPACITY,
    transform: [{ scale: 1 + ring.value * (PULSE_SCALE - 1) }],
  }));

  return (
    <View style={styles.dotBox}>
      {motionOn && beating ? (
        <Animated.View
          style={[styles.dot, styles.ring, { backgroundColor: c.accent }, ringStyle]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: state === 'pending' ? c.fillStrong : c.accent },
          dotStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space['2xl'] },
  rail: { flexShrink: 0, width: RAIL, alignItems: 'center' },
  dotBox: {
    width: DOT_ACTIVE,
    height: DOT_ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  dot: {
    position: 'absolute',
    width: DOT_ACTIVE,
    height: DOT_ACTIVE,
    borderRadius: radius.pill,
  },
  ring: { opacity: PULSE_OPACITY },
  connector: { flex: 1, width: HAIRLINE_WIDTH },
  text: { flex: 1, minWidth: 0, paddingBottom: space['5xl'] },
  textLast: { paddingBottom: 0 },
  detail: { marginTop: space.xs },
});
