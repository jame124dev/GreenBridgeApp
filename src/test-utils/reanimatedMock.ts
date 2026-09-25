/**
 * The Reanimated stand-in every v2 component test needs.
 *
 * ⚠️ `react-native-reanimated/mock` DOES NOT WORK here. In 4.x that file
 * imports the real module first, and the real module throws under Jest before
 * a single assertion runs — so the official mock is not an option and each
 * suite has been hand-rolling its own.
 *
 * `Row.layout.test.tsx` wrote the first one with a note saying to lift it here
 * "when a second v2 component needs it". That happened on 2026-09-22, when the
 * auth screens moved onto the v2 kit: three existing suites went red on
 * `useReducedMotion is not a function`, because each carried its OWN partial
 * copy covering only what the OLD `Button` touched. Three partial mocks of one
 * module is how a test suite ends up asserting against a different component
 * than the app renders.
 *
 * The surface below is what `theme/v2/motion.ts` and the kit's press feedback
 * actually call. Add to it when a component reaches for something new — and add
 * it HERE, not in a suite.
 *
 * Usage (the factory is `require`d inside the mock so Jest's hoisting is happy):
 *
 *     jest.mock('react-native-reanimated', () =>
 *       require('@/test-utils/reanimatedMock').reanimatedMock(),
 *     );
 */
export function reanimatedMock() {
  const identity = (v: unknown) => v;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (C: unknown) => C,
      View: RN.View,
      Text: RN.Text,
    },
    Easing: { bezier: () => identity },
    ReduceMotion: { System: 'system' },
    useSharedValue: (v: unknown) => ({ value: v }),
    // Returning the style object itself — a worklet that computes a style is
    // just a function here, so calling it gives the resting-state style. Layout
    // assertions depend on that; animation assertions cannot be made at all.
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useReducedMotion: () => false,
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withDelay: (_d: unknown, v: unknown) => v,
    withSequence: (...v: unknown[]) => v[v.length - 1],
    cancelAnimation: () => undefined,
    runOnJS: (fn: unknown) => fn,
    interpolate: () => 0,

    /**
     * `Screen` uses this to mirror the keyboard's height into a shared value
     * (`Screen.tsx`, the "Channel 1 — per-frame animation" block). Any test
     * that renders a v2 `Screen` reaches it; the first was
     * `app/(lab)/sell/__tests__/apply.test.tsx`, when that screen started
     * rendering `GuestTabState`.
     *
     * A no-op is the honest stand-in: the reaction fires on UI-thread value
     * changes, which do not happen under Jest, so running the callback once
     * here would report a keyboard transition that never occurred.
     */
    useAnimatedReaction: () => undefined,

    /**
     * For react-native-gesture-handler, not for us.
     *
     * RNGH's `reanimatedWrapper` probes this module and, if it resolves, calls
     * `Reanimated.useEvent` / `useHandler` to drive animated gesture handlers.
     * A partial mock makes the probe SUCCEED and the call fail — the error is
     * `_reanimatedWrapper.Reanimated.useEvent is not a function`, thrown from
     * inside RNGH, which points nowhere near the mock that caused it. Every v2
     * screen hits this because the kit's `Pressable` comes from RNGH.
     */
    useEvent: () => () => undefined,
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    setGestureState: () => undefined,
  };
}
