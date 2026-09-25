/**
 * Jest for an Expo app.
 *
 * ⚠️ DO NOT declare `setupFiles` here. The jest-expo preset fills it with two
 * entries (`@react-native/jest-preset/jest/setup.js` and
 * `jest-expo/src/preset/setup.js`) and declaring the key REPLACES that array
 * rather than appending to it, which takes the whole React Native environment
 * out from under every test.
 */
module.exports = {
  preset: 'jest-expo',

  /**
   * ⚠️ `ui_git_repo/` IS NOT OUR CODE, AND JEST WAS THE ONLY TOOL STILL
   * READING IT.
   *
   * It holds cloned reference apps (see its README) — each a whole Expo
   * project with its own tests, mocks and lockfile. `metro.config.js` blocks
   * it from the bundler and `tsconfig.json` excludes it from typechecking;
   * jest had no equivalent, so `npx jest` ran five of the template's own
   * suites and, worse, let
   * `ui_git_repo/obytes-template/__mocks__/react-native-gesture-handler.ts`
   * shadow the real module for OUR tests. That mock re-exports
   * `react-native-gesture-handler/src/mocks.ts`, which does not resolve here,
   * so five `app/(auth)` suites failed at LOAD time with a stack pointing at
   * `src/features/v2/ui/Screen.tsx` — reading like a broken v2 kit rather than
   * a stray vendored mock.
   *
   * `bkp/` is here for the same reason: screens moved out of the route tree on
   * 2026-09-23 are kept for reference, not to be run.
   */
  /**
   * ⚠️ WITHOUT THIS, ANY TEST THAT REACHES `@/theme/v2` FAILS TO LOAD.
   *
   * `src/theme/v2/motion.ts:22` imports `react-native-reanimated`, which pulls
   * in `react-native-worklets`, whose `.native` entry constructs
   * `NativeWorklets` at module scope and throws
   * `[Worklets] Native part of Worklets doesn't seem to be initialized.`
   * The stack points at whichever component imported the theme, so it reads
   * like a broken card rather than a missing test shim — the same shape as the
   * `react-native-keyboard-controller` trap mapped below.
   *
   * This is the resolver the library ships for it: it drops the `.native`
   * extensions for worklets requests only, so jest resolves the plain JS
   * variant that has no native dependency. Nothing else in the resolution
   * graph changes.
   *
   * Found after a port of one scanner card was REVERTED earlier on the
   * assumption that the v2 kit was simply untestable from `src/features/
   * scanner`. It was not; the shim was missing.
   */
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',

  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/ui_git_repo/', '<rootDir>/bkp/'],
  modulePathIgnorePatterns: ['<rootDir>/ui_git_repo/', '<rootDir>/bkp/'],

  moduleNameMapper: {
    /**
     * `react-native-keyboard-controller` cannot link under Jest. Its
     * `bindings.native.ts` builds a `NativeEventEmitter` over a TurboModule
     * that does not exist outside a real app, and it throws at IMPORT time — so
     * any test rendering a screen that reaches the v2 UI barrel fails to LOAD.
     * The stack points at `Screen.tsx`, which reads like a broken test rather
     * than a missing mock.
     *
     * This bit when `app/(auth)/login.tsx` and `forgot-password.tsx` were
     * rebuilt on the v2 kit (2026-09-22): three previously-green suites that
     * render those screens went red at once, none of them for a real reason.
     *
     * The library ships a mock but does NOT register itself — its
     * `jest/index.js` ends in `module.exports = mock`, so pointing
     * `setupFilesAfterEnv` at it merely evaluates an object and changes
     * nothing. It has to be substituted for the module, which is what this
     * mapping does. Anchored (`^…$`) so deep imports are unaffected.
     */
    '^react-native-keyboard-controller$':
      '<rootDir>/node_modules/react-native-keyboard-controller/jest',

    /**
     * Same class of problem, third instance. `@gorhom/bottom-sheet`'s
     * `constants.ts:68` runs `Easing.out(Easing.exp)` at MODULE SCOPE, and
     * under jest `react-native-reanimated`'s `Easing` does not survive the
     * mocking — so importing the library throws before any test body runs
     * (`Easing.out is not a function`, or `Cannot read properties of undefined`).
     *
     * It reaches almost everything because `src/features/v2/ui/ConfirmSheet.tsx`
     * imports it and `ConfirmSheet` is exported from the kit BARREL
     * (`index.ts:62`). Any screen that imports anything from `@/features/v2/ui`
     * therefore drags the bottom sheet in, and the stack names the screen — so
     * it reads as a broken screen rather than a missing shim. It took out the
     * six `app/(auth)` and `features/v2/scan` suites the day `ConfirmSheet`
     * landed, and an 8th (`app/(lab)/sell/apply`) the moment that screen
     * started using the kit.
     *
     * The library ships `mock.js` for exactly this. Anchored (`^…$`) so deep
     * imports are unaffected.
     *
     * ⚠️ Verified pre-existing, not caused by the `resolver:` above: with that
     * line commented out the same suites fail the same way.
     */
    '^@gorhom/bottom-sheet$': '<rootDir>/node_modules/@gorhom/bottom-sheet/mock',
  },

  transformIgnorePatterns: [
    // `react-native-keyboard-controller` is listed because the jest mock above
    // ships as untranspiled ESM.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|nativewind|react-native-svg|react-native-keyboard-controller)',
  ],
};
