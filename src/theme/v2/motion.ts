/**
 * v2 motion helpers.
 *
 * ⚠️ THE BUG THIS FILE EXISTS TO PREVENT
 *
 * NativeWind's JSX interop SPREADS the `style` prop. Spreading a function
 * yields `{}`, so a function-form style on a React Native primitive is
 * SILENTLY DELETED at runtime:
 *
 *     <Pressable style={({ pressed }) => [s.row, pressed && s.pressed]} />   ❌
 *
 * The row renders, nothing throws, and the pressed state simply never appears.
 * Jest cannot catch it either — the interop is skipped when NODE_ENV==='test',
 * so the unit test passes and the phone is wrong. This has already cost this
 * codebase real time; `src/__tests__/noFunctionStyleProp.test.ts` now fails the
 * build on the pattern.
 *
 * So: press feedback comes from `usePressFeedback()` below — a Reanimated
 * shared value driven by `onPressIn`/`onPressOut`, with a plain object style.
 * It is also better feedback than the boolean, because it eases.
 */
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { duration, easing, press } from './scale';

const bezier = (b: readonly [number, number, number, number]) =>
  Easing.bezier(b[0], b[1], b[2], b[3]);

/**
 * A timing config from the v2 tokens.
 *
 * `reduceMotion: ReduceMotion.System` makes Reanimated honour the OS
 * "Reduce Motion" setting for us — the animation resolves instantly to its
 * end value instead of being skipped, so state stays correct.
 *
 * ⚠️ JS THREAD ONLY. This is a plain function, not a worklet, so calling it
 * from inside a gesture callback or `useAnimatedReaction` throws at runtime:
 *
 *   [Worklets] Tried to synchronously call a non-worklet function `timing`
 *   on the UI thread.
 *
 * It type-checks and lints clean either way, so the failure only shows up on
 * a device. Build the config once in the component body and let the worklet
 * capture the finished object — see `HomePager`.
 */
export function timing(
  ms: number = duration.base,
  curve: readonly [number, number, number, number] = easing.standard,
): WithTimingConfig {
  return { duration: ms, easing: bezier(curve), reduceMotion: ReduceMotion.System };
}

/**
 * Press feedback for any tappable surface.
 *
 *     const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
 *     <AnimatedPressable style={[s.card, animatedStyle]} onPressIn={onPressIn} onPressOut={onPressOut} />
 *
 * Pass `scale: false` for a full-bleed row, where scaling the whole width
 * reads as a glitch rather than a press — those dim only.
 */
export function usePressFeedback({ scale = true }: { scale?: boolean } = {}) {
  const active = useSharedValue(0);
  const reduced = useReducedMotion();

  // Deliberately NOT wrapped in useCallback. A shared value is a stable ref, so
  // there is nothing to memoise, and `react-hooks/immutability` (React
  // Compiler) rejects mutating a value that appears in a hook's dependency
  // array — which is exactly what `active.value = …` inside `useCallback([active])`
  // is. Plain functions sidestep the rule without suppressing it.
  const onPressIn = () => {
    active.value = withTiming(1, timing(duration.press, easing.exit));
  };

  const onPressOut = () => {
    active.value = withTiming(0, timing(duration.release, easing.standard));
  };

  const animatedStyle = useAnimatedStyle(() => {
    const t = active.value;
    return {
      opacity: 1 - t * (1 - press.opacity),
      // Reduce Motion means no movement — the opacity dip still carries the
      // feedback, so the control never becomes unresponsive-feeling.
      transform: scale && !reduced ? [{ scale: 1 - t * (1 - press.scale) }] : [],
    };
  }, [scale, reduced]);

  return { animatedStyle, onPressIn, onPressOut };
}

/**
 * Whether to draw motion at all.
 *
 * Use for decorative motion that has no end state worth resolving to — the
 * shimmer on the Analyzing screen, an ambient pulse. Skip it entirely when
 * this is true rather than running it at zero duration.
 */
export function useMotionEnabled(): boolean {
  return !useReducedMotion();
}
