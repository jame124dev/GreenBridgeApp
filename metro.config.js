const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * ⚠️ KEEP THE VENDORED UI TEMPLATES OUT OF THE BUNDLER.
 *
 * `ui_git_repo/` holds cloned reference repos (see its README). Each is a
 * whole Expo app with its own `app/` directory, `package.json` and lockfile.
 * Left visible to Metro they cause duplicate-module warnings at best, and at
 * worst a second `app/` tree confuses tooling that scans for routes. They are
 * there to be READ and copied from, never to be bundled.
 *
 * Also excluded from `tsconfig.json` and ignored by git for the same reason.
 */
// A plain RegExp, not `metro-config/src/defaults/exclusionList` — that
// subpath is no longer exported by this version of metro-config, and
// `blockList` accepts a RegExp or an array of them.
//
// The character class has to allow BOTH separators: Metro hands this
// absolute Windows paths with backslashes, and a forward-slash-only pattern
// silently matches nothing here.
const blockUiGitRepo = /[\\/]ui_git_repo[\\/].*/;

/**
 * ⚠️ KEEP `__tests__` OUT OF THE ROUTE TREE — EXPLICITLY.
 *
 * The note below says "`getDefaultConfig` already sets one, and what it blocks
 * is `__tests__`". That stopped being true in **Expo 56**: the default
 * blockList no longer covers it, so the seven `__tests__` directories living
 * under `app/` (`app/(auth)/__tests__`, `app/(lab)/account/__tests__`,
 * `app/(lab)/sell/__tests__`) became route nodes again.
 *
 * The symptom is not a resolution error — it is expo-router's
 * `validateRouteTreeExports` walking those files and throwing
 * **"Do not import `@jest/globals` outside of the Jest test environment"**,
 * which renders as a full-screen redbox and no app at all. It only appears on
 * a COLD route-tree scan, so a long-running dev server keeps working and the
 * failure looks like it arrived with whatever was edited last.
 *
 * Blocking them here rather than moving the files: they sit beside the screens
 * they test on purpose, and Jest resolves them itself without Metro.
 *
 * Both separators, for the same reason as `blockUiGitRepo` — Metro hands this
 * absolute Windows paths with backslashes.
 */
const blockAppTests = /[\\/]__tests__[\\/].*/;

/**
 * ⚠️ EXTEND THE DEFAULT BLOCKLIST, NEVER ASSIGN OVER IT.
 *
 * `getDefaultConfig` already sets one, and what it blocks is `__tests__`.
 * Replacing it put every `app/**‍/__tests__/*.tsx` back into the ROUTE tree —
 * expo-router scans `app/`, so the test files became routes, dragged
 * `@testing-library/react-native` into the app bundle, and Metro answered
 * every bundle request with HTTP 500 ("Unable to resolve module console").
 *
 * The device gave no sign of this: it kept serving the last good bundle, so
 * the app simply stopped picking up changes and looked frozen rather than
 * broken. Ask the bundler, not the phone — `curl` the entry bundle and check
 * the status code.
 */
const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = Array.isArray(defaultBlockList)
  ? [...defaultBlockList, blockUiGitRepo, blockAppTests]
  : [defaultBlockList, blockUiGitRepo, blockAppTests].filter(Boolean);

module.exports = withNativeWind(config, { input: './global.css' });
