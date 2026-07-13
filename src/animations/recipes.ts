/**
 * Motion recipes — Reanimated 4 ports of the web-prototype CSS keyframes.
 *
 * The canonical named set (per `NewVersion/00-foundation.md`
 * → "Animation & Interaction Recipes") is:
 *
 *   RISE   — entrance fade + slide-up 10px   (screen entries, drawers)
 *   POP    — scale 0.92→1 + fade             (card/chip reveals, confirmations)
 *   PULSE  — opacity 0.35↔1 loop             (secondary "in-progress" indicator)
 *   SPIN   — infinite 360° rotation          (processing spinner, loading)
 *   SLIDE-X— horizontal translate            (sell/buy toggle, tab switch)
 *   PROGRESS — width 6%→100% (screen helper)  (step-completion bars)
 *
 * Everything targets 60 FPS locked and runs on the UI thread (worklet-safe):
 * continuous loops use `useSharedValue` + `useAnimatedStyle` (no JS-side calc),
 * one-shot entrances use Reanimated layout-animation builders.
 *
 * Reduced motion: every animated value has the documented static fallback and
 * honors `useReducedMotion()`. Press scale is 0.97 everywhere (matches
 * `@/components/ui/Button`).
 *
 * Haptics do NOT live here — import `{ haptics }` from `@/lib/haptics`.
 */
import { useEffect } from 'react';
import {
  Easing,
  FadeIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
  type StyleProps,
} from 'react-native-reanimated';
import { motion } from '@/constants/theme';

/* -------------------------------------------------------------------------- */
/*  Shared timing / easing constants (single source, mirrors the recipe table) */
/* -------------------------------------------------------------------------- */

/** The one true press-in scale. Matches `@/components/ui/Button` — never 0.95/0.92. */
export const PRESS_SCALE = 0.97;

/** Recipe durations (ms). Kept local so the table and the code can't drift. */
export const DURATIONS = {
  rise: 350,
  pop: 300,
  pulse: 1500,
  spin: 1000,
  slideX: 280,
  progress: 800,
  /** reduced-motion opacity fade */
  reduced: 200,
} as const;

/** Material standard decelerate curve `cubic-bezier(.4, 0, .2, 1)` — SLIDE-X.
 *  Exported so bespoke surfaces (e.g. the upload action sheet backdrop) drive
 *  their non-spring opacity fades on the same curve rather than re-deriving it. */
export const MATERIAL_DECEL = Easing.bezier(0.4, 0, 0.2, 1);
/** `Easing.out(cubic)` — PROGRESS fill. */
const OUT_CUBIC = Easing.out(Easing.cubic);
/** `Easing.inOut(cubic)` — PULSE breathing loop. */
const INOUT_CUBIC = Easing.inOut(Easing.cubic);

/** RISE spring — soft, ~0.75 damping ratio feel. Exported so hand-composed
 *  sheet/drawer entrances reuse the exact config instead of re-deriving it. */
export const RISE_SPRING = { damping: 20, stiffness: 180, mass: 1 } as const;
/** POP spring — slightly stiffer with a little overshoot. */
export const POP_SPRING = { damping: 12, stiffness: 220, mass: 1 } as const;

/* -------------------------------------------------------------------------- */
/*  Entering / exiting builders (one-shot, layout animations)                  */
/* -------------------------------------------------------------------------- */

/**
 * RISE entrance — fade + slide-up 10px over 350ms (spring feel).
 * Reduced-motion fallback: opacity-only `FadeIn` (200ms, no translate).
 *
 * Usage: `<Animated.View entering={rise()} />`. Because the reduced-motion
 * branch must be evaluated at render time, prefer the `useRise()` hook inside
 * components; `rise()` is provided for call sites that already know the
 * preference (e.g. gate on `useReducedMotion()` themselves).
 */
export function rise(delayMs = 0): EntryExitAnimationFunction {
  const build: EntryExitAnimationFunction = () => {
    'worklet';
    const animations: StyleProps = {
      opacity: withDelay(delayMs, withTiming(1, { duration: DURATIONS.rise })),
      transform: [{ translateY: withDelay(delayMs, withSpring(0, RISE_SPRING)) }],
    };
    const initialValues: StyleProps = {
      opacity: 0,
      transform: [{ translateY: 10 }],
    };
    return { initialValues, animations };
  };
  return build;
}

/**
 * POP entrance — scale 0.92→1 + fade over 300ms (spring, slight overshoot).
 * In lists, stagger by 80ms per item: `pop(index * 80)`.
 * Reduced-motion fallback: opacity-only `FadeIn` (no scale).
 */
export function pop(delayMs = 0): EntryExitAnimationFunction {
  const build: EntryExitAnimationFunction = () => {
    'worklet';
    const animations: StyleProps = {
      opacity: withDelay(delayMs, withTiming(1, { duration: DURATIONS.pop })),
      transform: [{ scale: withDelay(delayMs, withSpring(1, POP_SPRING)) }],
    };
    const initialValues: StyleProps = {
      opacity: 0,
      transform: [{ scale: 0.92 }],
    };
    return { initialValues, animations };
  };
  return build;
}

/** Per-item stagger step for POP reveals in lists (80ms, per foundation). */
export const POP_STAGGER_MS = 80;

/**
 * Reduced-motion entrance fallback shared by RISE and POP — a plain 200ms
 * opacity fade with no translate/scale. Exposed so screens can branch:
 *
 *   const reduced = useReducedMotion();
 *   <Animated.View entering={reduced ? reducedFade() : rise()} />
 */
export function reducedFade(delayMs = 0) {
  return FadeIn.duration(DURATIONS.reduced).delay(delayMs);
}

/**
 * `useRise` / `usePop` — resolve the correct entering builder for the current
 * reduced-motion preference. Prefer these over the raw builders in components.
 */
export function useRise(delayMs = 0): EntryExitAnimationFunction | ReturnType<typeof FadeIn.duration> {
  const reduced = useReducedMotion();
  return reduced ? reducedFade(delayMs) : rise(delayMs);
}

export function usePop(delayMs = 0): EntryExitAnimationFunction | ReturnType<typeof FadeIn.duration> {
  const reduced = useReducedMotion();
  return reduced ? reducedFade(delayMs) : pop(delayMs);
}

/* -------------------------------------------------------------------------- */
/*  Continuous loops (shared-value hooks, run on UI thread)                     */
/* -------------------------------------------------------------------------- */

/**
 * SPIN — infinite 360° linear rotation (1000ms), for processing/loading.
 * Reduced-motion fallback: static, no rotation (show the resting icon).
 * Returns an animated style; spread onto the spinning `Animated.View`.
 */
export function useSpin(durationMs: number = DURATIONS.spin) {
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      rotation.value = 0;
      return;
    }
    rotation.value = withRepeat(
      withTiming(360, { duration: durationMs, easing: Easing.linear }),
      -1, // infinite
      false, // no reverse
    );
    return () => cancelAnimation(rotation);
  }, [reduced, durationMs, rotation]);

  return useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
}

/**
 * PULSE — opacity 0.35↔1 loop (1500ms, inOut cubic), for a secondary
 * "in-progress" indicator.
 * Reduced-motion fallback: static opacity 1.
 */
export function usePulse(durationMs: number = DURATIONS.pulse) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 0;
      return;
    }
    // half-cycle timing; withRepeat reverse handles the return leg → full 1500ms
    progress.value = withRepeat(
      withTiming(1, { duration: durationMs / 2, easing: INOUT_CUBIC }),
      -1,
      true, // reverse (0.35 ↔ 1)
    );
    return () => cancelAnimation(progress);
  }, [reduced, durationMs, progress]);

  return useAnimatedStyle(() => ({
    // reduced → progress pinned at 0 → interpolate returns 1 (the max) only when
    // reduced; guard explicitly so the resting state is a solid opacity 1.
    opacity: reduced ? 1 : interpolate(progress.value, [0, 1], [0.35, 1]),
  }));
}

/* -------------------------------------------------------------------------- */
/*  SLIDE-X (imperative translate, e.g. sell/buy toggle, tab switch)           */
/* -------------------------------------------------------------------------- */

/**
 * SLIDE-X — horizontal translate over 280ms on the Material decelerate curve.
 * Returns `{ style, slideTo }`: keep a shared X and imperatively drive it.
 * Reduced-motion fallback: instant snap (no translate animation).
 *
 *   const { style, slideTo } = useSlideX();
 *   // on mode change: slideTo(mode === 'buy' ? trackWidth / 2 : 0)
 *   <Animated.View style={style} />
 */
export function useSlideX(initialX = 0) {
  const reduced = useReducedMotion();
  const x = useSharedValue(initialX);

  const slideTo = (toX: number) => {
    if (reduced) {
      x.value = toX; // instant snap
    } else {
      x.value = withTiming(toX, { duration: DURATIONS.slideX, easing: MATERIAL_DECEL });
    }
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return { style, slideTo, x };
}

/* -------------------------------------------------------------------------- */
/*  Press scale — shared helper for custom Pressables (0.97, matches Button)   */
/* -------------------------------------------------------------------------- */

/**
 * Shared press-scale helper for bespoke `Pressable`s so they match
 * `@/components/ui/Button` exactly (press-in `1 → 0.97` over `motion.tap`,
 * spring/time back to `1`).
 * Reduced-motion fallback: no scale — value stays at 1.
 *
 *   const { style, onPressIn, onPressOut } = usePressScale();
 *   <AnimatedPressable style={style} onPressIn={onPressIn} onPressOut={onPressOut} />
 *
 * NOTE: this does NOT fire haptics — pair with `haptics.*` from `@/lib/haptics`
 * in your `onPress` handler.
 */
export function usePressScale() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const onPressIn = () => {
    if (reduced) return; // no scale under reduced motion
    scale.value = withTiming(PRESS_SCALE, { duration: motion.tap });
  };

  const onPressOut = () => {
    if (reduced) return;
    // spring back for a lively release (falls back to timing feel via light spring)
    scale.value = withSpring(1, motion.spring);
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { style, onPressIn, onPressOut, scale };
}

/* -------------------------------------------------------------------------- */
/*  PROGRESS (screen-specific helper built on the same primitives)             */
/* -------------------------------------------------------------------------- */

/**
 * PROGRESS — animated width fill 6%→100% over 800ms (out cubic), for
 * step-completion bars. Returns an animated style bound to a width percentage.
 * Reduced-motion fallback: sets the final width instantly (no animated fill).
 *
 *   const { style, animateTo } = useProgress();
 *   useEffect(() => { animateTo(0.6); }, []);   // 60%
 *   <Animated.View style={style} />              // parent must have a known width
 */
export function useProgress(initial = 0.06) {
  const reduced = useReducedMotion();
  const pct = useSharedValue(initial);

  const animateTo = (to: number) => {
    const clamped = Math.max(0, Math.min(1, to));
    if (reduced) {
      pct.value = clamped; // final width instantly
    } else {
      pct.value = withTiming(clamped, { duration: DURATIONS.progress, easing: OUT_CUBIC });
    }
  };

  const style = useAnimatedStyle(() => ({
    width: `${pct.value * 100}%`,
  }));

  return { style, animateTo, pct };
}

/* -------------------------------------------------------------------------- */
/*  Confidence ring (MATCH screen) — animated strokeDashoffset for an SVG ring */
/* -------------------------------------------------------------------------- */

/** Ring geometry per foundation: r=56 inside a 128px box, stroke `greenMedium`. */
export const CONFIDENCE_RING = {
  size: 128,
  radius: 56,
  get circumference() {
    return 2 * Math.PI * this.radius;
  },
} as const;

/**
 * Confidence ring driver — animates `strokeDashoffset` to draw the ring to
 * `pct` (0–1) over 1200ms out-cubic. Bind the returned `progress` shared value
 * via a `useAnimatedProps` on an `AnimatedCircle` in the screen:
 *
 *   const circumference = CONFIDENCE_RING.circumference;
 *   const progress = useConfidenceRing(0.92);
 *   const props = useAnimatedProps(() => ({
 *     strokeDashoffset: circumference * (1 - progress.value),
 *   }));
 *
 * Reduced-motion fallback: jumps to the final value instantly.
 */
export function useConfidenceRing(toPct: number, durationMs = 1200): SharedValue<number> {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, toPct));
    if (reduced) {
      progress.value = clamped;
      return;
    }
    progress.value = withTiming(clamped, { duration: durationMs, easing: OUT_CUBIC });
    return () => cancelAnimation(progress);
  }, [reduced, toPct, durationMs, progress]);

  return progress;
}

/* -------------------------------------------------------------------------- */
/*  Convenience: attention "confirm" bounce (POP-family one-shot, imperative)  */
/* -------------------------------------------------------------------------- */

/**
 * One-shot confirm bounce for already-mounted elements (checkmarks, badges)
 * where a mount-time `entering` animation can't be used. Scales 1 → 0.92 → 1
 * with the POP spring on release. Reduced-motion: no-op.
 *
 *   const { style, bounce } = usePopBounce();
 *   // on confirm: bounce();
 */
export function usePopBounce() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const bounce = () => {
    if (reduced) return;
    scale.value = withSequence(
      withTiming(0.92, { duration: DURATIONS.pop / 3 }),
      withSpring(1, POP_SPRING),
    );
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { style, bounce, scale };
}
