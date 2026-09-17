/**
 * Two motion wrappers.
 *
 * The design is quiet — motion answers what a person did, and is otherwise
 * absent. These are the two exceptions the screens have actually needed, and
 * they encode the distinction that matters:
 *
 * • `EnterOnMount` has an END STATE. It runs through `timing()`, so under
 *   Reduce Motion it resolves instantly to the finished position and the
 *   content is simply there.
 *
 * • `Shimmer` has NO end state — it is a loop. Running a loop at zero duration
 *   strobes, so it is gated OUT entirely by `useMotionEnabled()` and falls back
 *   to a flat block.
 *
 * Getting that backwards is the common mistake: gate the meaningful animation
 * and you break state; zero-duration the decorative one and you get a flicker.
 */
import React, { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  duration,
  easing,
  radius,
  timing,
  useMotionEnabled,
  useV2Colors,
} from '@/theme/v2';

/** How far entering content travels. Small: it is arriving, not launching. */
const ENTER_RISE = 12;

/**
 * Fades and rises content into place.
 *
 * For something that arrives after first paint — an item streaming in from the
 * extractor, a row appearing as a query resolves. **Not** for every section on
 * a static screen: a fade-and-rise on each block is the generic default and
 * reads as machine-made.
 */
export function EnterOnMount({ children }: { children: ReactNode }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, timing(duration.base, easing.standard));
  }, [t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * ENTER_RISE }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * A block that breathes while its content is still being fetched.
 *
 * Use where something is *known to be coming* — an item the model has counted
 * but not yet described. Where nothing is known, use `SectionNote` and say so
 * in words instead; a shimmer implies imminent content.
 */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useV2Colors();
  const motionOn = useMotionEnabled();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!motionOn) return;
    t.value = withRepeat(withTiming(1, timing(duration.ambientFast, easing.inOut)), -1, true);
    return () => {
      cancelAnimation(t);
      t.value = 0;
    };
  }, [motionOn, t]);

  const animated = useAnimatedStyle(() => ({ opacity: 0.5 + t.value * 0.5 }));
  const base = [styles.block, { backgroundColor: c.fill }, style];

  return motionOn ? <Animated.View style={[base, animated]} /> : <View style={base} />;
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.xs },
});
