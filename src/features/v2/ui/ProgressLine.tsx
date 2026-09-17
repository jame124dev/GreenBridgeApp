/**
 * `ProgressLine` — a 3pt track.
 *
 * Verification progress on Account, extraction progress on Analyzing. The
 * design has no chunky progress bar and no percentage label beside it: the
 * count lives in the heading above ("2 of 4", "STEP 1 OF 5"), and this is the
 * visual echo.
 *
 * ⚠️ `on` IS NOT COSMETIC. The track sits on `fill` by default, which is a
 * ~1.02:1 step against `wash` — invisible. Every use of this component so far
 * is inside the green header sheet, so `on="wash"` (which switches the track to
 * `fillStrong`) is the common case, not the exception. Found by a screen build,
 * not by the contrast suite, which only checks text against grounds.
 *
 * `animated` eases the fill to each new value instead of jumping. Use it
 * wherever the value arrives from a live source; leave it off for a static
 * count that is already correct on first paint.
 *
 * `accessibilityValue` carries the numbers — a screen reader gets "2 of 4",
 * not "progress bar".
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  PROGRESS_TRACK_HEIGHT,
  duration,
  easing,
  radius,
  space,
  timing,
  useV2Colors,
} from '@/theme/v2';

export function ProgressLine({
  value,
  total,
  label,
  on = 'base',
  animated = false,
}: {
  /** Steps completed. Clamped to `total`. */
  value: number;
  total: number;
  /** What is progressing — "Account verification". */
  label: string;
  /** The ground the track sits on. `wash` darkens the track so it stays visible. */
  on?: 'base' | 'wash';
  /** Ease to each new value. For live progress. */
  animated?: boolean;
}) {
  const c = useV2Colors();
  const safeTotal = Math.max(1, total);
  const done = Math.min(Math.max(0, value), safeTotal);
  const fraction = done / safeTotal;

  // Width is animated in POINTS off a measured layout, not as a percentage
  // string: Reanimated cannot interpolate `'42%'` on the UI thread without
  // re-parsing it every frame.
  const [trackWidth, setTrackWidth] = useState(0);
  const filled = useSharedValue(0);

  useEffect(() => {
    const target = fraction * trackWidth;
    filled.value = animated
      ? withTiming(target, timing(duration.slow, easing.standard))
      : target;
  }, [fraction, trackWidth, animated, filled]);

  const fillStyle = useAnimatedStyle(() => ({ width: filled.value }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: safeTotal, now: done }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        { backgroundColor: on === 'wash' ? c.fillStrong : c.fill },
      ]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: c.accent }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: PROGRESS_TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  fill: { height: '100%' },
});
