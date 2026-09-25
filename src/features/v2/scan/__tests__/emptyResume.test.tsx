/**
 * Nothing to review / resume — task `todo/SCANV2_V2UI_15_EMPTY_RESUME.md`.
 *
 * Two different things are gated here, and they fail for the same reason: the
 * drafts screen is where a seller arrives with NOTHING, so every promise it
 * makes has to hold for the least-privileged user who can reach it — a guest.
 *
 * ── 1. THE GUEST PARITY BUG ────────────────────────────────────────────────
 *
 * `SellingPane.onScan` had its `requireAuth('sell', …)` removed so a guest can
 * scan before signing up, matching `nextjs-port`'s gate-at-publish — its
 * docblock states it outright: *"Scan it and type the details do NOT [gate] —
 * they are open to a guest"*.
 *
 * `startV2Scan()` is the EXTRACTED copy of that same action and still gates.
 * Its two callers are the empty states of `app/v2/drafts.tsx` and
 * `app/v2/listings.tsx`, and both of those render for a guest — the query is
 * `enabled: !isGuest`, so a disabled query is not loading, has no data, and
 * falls straight through to the empty state. The identical action therefore
 * opens the camera from Home and demands an account two screens over.
 *
 * Worse, `startV2Scan`'s own docblock says *"TODO: `SellingPane.onScan` still
 * inlines this. Point it here when that file is next touched"* — so the helper
 * as written would have silently RE-GATED Home the next time anyone tidied it.
 *
 * ── 2. A 403 IS A DEAD SESSION, NOT AN EMPTY LIST ──────────────────────────
 *
 * The screen says "Pull down to try again — nothing has been lost" for ANY
 * failure. Pulling down on an expired token does nothing, for ever, while the
 * copy promises it will work. `listDrafts` rethrows the axios error with its
 * response intact, so the status is available to say the true thing.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT ASSERT ────────────────────────────
 *
 * The task also asked for per-row status (`Needs a category`, a `READY` pill)
 * and wrapping subtitles. Both were written from the Stitch mock and neither
 * survives contact with the code — see the audit in the task file.
 * `DraftSummary` carries no field completeness, and `Row.subtitle` is one line
 * BY DESIGN with a written rationale. Asserting them would be asserting the
 * mock.
 *
 * ⚠️ Mock-backing variables must be named `mock*` — Babel hoists `jest.mock`
 * factories above every other statement and rejects any other identifier.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

/**
 * The REAL i18n instance, not a stub.
 *
 * These assertions match the strings a seller actually reads, and the screen
 * now renders them through `t()`. Initialising for real means a key that does
 * not resolve fails HERE — as it did the moment `drafts.tsx` was translated and
 * this suite went red — rather than shipping a screen that renders
 * `mobile.scanv2.drafts.emptyTitle` to a user.
 *
 * Safe to import: `src/i18n/index.ts` calls `init()` synchronously with inlined
 * resources and no backend plugin, so there is nothing to await.
 */
import '@/i18n';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockReset = jest.fn();
/** Records whether the real `requireAuth` would have been reached at all. */
const mockRequireAuth = jest.fn((_reason: string, run: () => void) => run());

/**
 * The handlers are wrapped rather than passed by reference: `import` is hoisted
 * above the `const mockPush = …` declarations, so the factory runs while they
 * are still uninitialised and captures `undefined` — which surfaces much later
 * as "router.push is not a function", pointing at the source file rather than
 * at this mock.
 */
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => ({}),
  // `Screen` renders the v2 `TabBar`, which highlights the active tab from the
  // current route.
  usePathname: () => '/v2/drafts',
}));

/**
 * `Screen` pulls in `react-native-keyboard-controller`, whose native binding
 * throws "doesn't seem to be linked" the moment it is required under jest.
 * The library ships its own mock for exactly this — used rather than
 * hand-rolled, so it keeps pace with the package.
 */
jest.mock('react-native-keyboard-controller', () =>
  jest.requireActual('react-native-keyboard-controller/jest'),
);

/**
 * Same story one layer down: `Screen` → `TabBar` → `react-native-reanimated`,
 * whose worklets runtime is not initialised under jest.
 *
 * ⚠️ `react-native-reanimated/mock` does NOT help — in 4.x that file imports
 * the real module first and throws before it can substitute anything. This is
 * the surface `Row.layout.test.tsx` already worked out for exactly this reason,
 * copied rather than re-derived, plus `default.View` because `TabBar` renders
 * `Animated.View` for the keyboard collapse.
 *
 * That file's note says to lift this into `src/test-utils/` when a second v2
 * component needs it — which is now. Deliberately NOT done here: the lift edits
 * a test under `src/features/v2/ui/**`, which is kit, and the kit is read-only
 * for both concurrent sessions (`todo/_SESSION_LOCKS.md` rule 3). Logged there
 * as a kit gap instead.
 */
jest.mock('react-native-reanimated', () => {
  const identity = (v: unknown) => v;
  const RealReact = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (C: unknown) => C,
      // Plain, not `forwardRef`: the tab bar's `Animated.View` takes no ref,
      // and typing one here is the only thing in this file `tsc` objects to.
      View: (props: object) => RealReact.createElement(RN.View, props),
    },
    Easing: { bezier: () => identity },
    ReduceMotion: { System: 'system' },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useReducedMotion: () => false,
    // react-native-gesture-handler's reanimated wrapper reaches for these two
    // on import. `Row.layout.test.tsx` never hit them because it renders a Row
    // in isolation; a whole screen mounts RNGH's Pressable.
    useEvent: () => () => undefined,
    useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
    // `useKeyboardInset` (the tab-bar collapse) subscribes through this.
    useAnimatedReaction: () => undefined,
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    runOnJS:
      (fn: (...a: unknown[]) => unknown) =>
      (...a: unknown[]) =>
        fn(...a),
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    cancelAnimation: () => undefined,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/stores/scanDraftStore', () => ({
  useScanDraft: { getState: () => ({ reset: mockReset }) },
}));

/** Signed-out by default: the state every assertion here is about. */
let mockIsGuest = true;
jest.mock('@/features/auth/requireAuth', () => ({
  requireAuth: (reason: string, run: () => void) => mockRequireAuth(reason, run),
  useIsGuest: () => mockIsGuest,
}));

jest.mock('@/features/lab/notifications/useLabNotifications', () => ({
  useLabNotifications: () => ({ unreadCount: 0 }),
}));

jest.mock('@/features/scanner/useResumeDraft', () => ({
  useResumeDraft: () => ({ resume: jest.fn(), resumingId: null }),
}));

/** Swapped per test to drive the screen's loading / empty / error states. */
let mockDraftsQuery: Record<string, unknown> = {};
jest.mock('@/services/drafts/draftHooks', () => ({
  useListDrafts: () => mockDraftsQuery,
}));

import { V2ThemeProvider } from '@/theme/v2';

import { startV2Scan } from '../startV2Scan';
import V2Drafts from '../../../../../app/v2/drafts';

/**
 * Every v2 screen reads `useV2Theme`, which throws by design outside the
 * provider that `app/v2/_layout.tsx` mounts. Rendering the route component on
 * its own has to supply it.
 */
function renderScreen() {
  return render(
    <V2ThemeProvider>
      <V2Drafts />
    </V2ThemeProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockReset.mockClear();
  mockRequireAuth.mockClear();
  mockIsGuest = true;
  mockDraftsQuery = { data: { drafts: [] }, isLoading: false, isError: false, refetch: jest.fn() };
});

describe('starting a scan is open to a guest, from every entry point', () => {
  /**
   * The parity assertion. Home does not gate; the extracted helper must not
   * either, or the same action means two different things two taps apart.
   */
  it('does not ask a guest to sign in', () => {
    startV2Scan();

    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it('still flushes a half-finished draft and opens the v2 camera', () => {
    startV2Scan();

    // FLUSH-ALWAYS: skipping it resumes an abandoned draft into a fresh scan.
    expect(mockReset).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalled();
  });
});

describe('the drafts screen with nothing in it', () => {
  it('offers BOTH ways to start, not just the camera', () => {
    renderScreen();

    expect(screen.getByText('Scan an item')).toBeTruthy();
    // Home offers a second door for anyone who cannot photograph the machine
    // right now — a seller at a desk, or one whose nameplate is unreadable.
    // An empty screen offering one door is a dead end for half of them.
    expect(screen.getByText(/type the details/i)).toBeTruthy();
  });

  it('opens the camera for a guest without a sign-in sheet', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Scan an item'));

    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalled();
  });
});

describe('the drafts screen when the request fails', () => {
  it('tells the truth about an expired session instead of promising a retry', () => {
    mockDraftsQuery = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 403 } },
      refetch: jest.fn(),
    };

    renderScreen();

    // Pulling down on a dead token does nothing, for ever.
    expect(screen.queryByText(/pull down to try again/i)).toBeNull();
    expect(screen.getByText('Your session has ended')).toBeTruthy();
    // And the way out is a CONTROL, not just a sentence telling them to go and
    // find one — the whole failure being fixed is a screen with no next step.
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('still offers a retry for a failure that a retry can actually fix', () => {
    mockDraftsQuery = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Network Error' },
      refetch: jest.fn(),
    };

    renderScreen();

    expect(screen.getByText(/pull down to try again/i)).toBeTruthy();
  });
});

describe('neither state flashes while the drafts are loading', () => {
  it('shows only the loading note', () => {
    mockDraftsQuery = { data: undefined, isLoading: true, isError: false, refetch: jest.fn() };

    renderScreen();

    expect(screen.queryByText('Nothing unfinished')).toBeNull();
    expect(screen.queryByText(/did not load/i)).toBeNull();
  });
});
