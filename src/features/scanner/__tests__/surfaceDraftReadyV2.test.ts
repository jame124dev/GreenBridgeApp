/**
 * The "your draft is ready" toast must open a draft where the CURRENT UI can
 * show it.
 *
 * ── THE DEFECT THIS PINS ───────────────────────────────────────────────────
 *
 * `surfaceDraftReady` is the single funnel for a finished background/document
 * scan, and its "View" action called `resumeDraftById(draftId, t)` with neither
 * a route resolver nor a multi-item handler. Both v2 draft surfaces
 * (`SellingPane`, `app/v2/drafts.tsx`) pass both. So on a v2 build the toast —
 * the one surface a seller reaches after backgrounding an upload — either
 * dropped them into old chrome or, for a multi-item draft, failed outright with
 * "Could not open this draft".
 *
 * The extract lane makes multi-item the common case (an 18-item draft from one
 * spreadsheet, 2026-09-17), so this is the path most likely to be taken.
 *
 * ── AND THE REGRESSION IT PREVENTS ─────────────────────────────────────────
 *
 * This function is shared with the SHIPPED UI. With `V2_UI_ENABLED` off both
 * arguments must be `undefined`, or an old-UI seller gets walked into v2
 * mid-journey. Both directions are asserted; a fix for one that breaks the
 * other is the actual risk here, which is why they live in one file.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/features/lab/notifications/NotificationToast', () => ({
  NotificationToast: () => null,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/services/drafts/draftHooks', () => ({ draftKeys: { all: ['drafts'] } }));
jest.mock('@/features/scanner/useResumeDraft', () => ({ resumeDraftById: jest.fn() }));
// Sentinels — identity is all that is asserted, and stubbing keeps the
// expo-router/mmkv import chain out of the jest env.
jest.mock('@/features/v2/scan/openMultiItemDraft', () => ({
  openMultiItemDraft: jest.fn(),
}));
jest.mock('@/features/v2/scan/v2ResumeRoute', () => ({ v2ResumeRoute: jest.fn() }));

const t = (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k;

/**
 * Raise the toast with the flag in a given state, press "View", and hand back
 * the arguments `resumeDraftById` was called with.
 *
 * `V2_UI_ENABLED` is a module constant read at import time, so each case needs
 * its own module registry — `resetModules` + a fresh `require` inside
 * `isolateModules`. Setting the env var afterwards would do nothing.
 *
 * ⚠️ EVERYTHING must happen inside the isolated registry, including reading the
 * stub back. A `require` outside it resolves to a DIFFERENT copy of
 * `useResumeDraft` whose mock never saw the call — which reads as "the control
 * did nothing" rather than "you looked in the wrong place".
 */
function pressViewWithFlag(v2: boolean): unknown[] {
  let args: unknown[] = [];
  jest.resetModules();
  jest.isolateModules(() => {
    jest.doMock('@/lib/flags', () => ({ V2_UI_ENABLED: v2 }));
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { toast } = require('sonner-native');
    const custom = jest.spyOn(toast, 'custom');
    const resume = require('@/features/scanner/useResumeDraft').resumeDraftById as jest.Mock;
    const mod = require('@/features/scanner/surfaceDraftReady');
    /* eslint-enable @typescript-eslint/no-require-imports */
    custom.mockClear();
    resume.mockClear();
    mod.__resetSurfaced();

    mod.surfaceDraftReady(
      { jobId: 'j-1', draftId: 247 },
      { queryClient: { invalidateQueries: jest.fn() }, t },
    );

    const element = (custom.mock.calls[0] as unknown[])[0] as {
      props: { onView: () => void };
    };
    element.props.onView();
    args = resume.mock.calls[0] as unknown[];
  });
  return args;
}

describe('surfaceDraftReady — where "View" lands', () => {
  it('opens a draft through the v2 destinations when v2 is the UI', () => {
    const [id, , routeFor, onMultiItem] = pressViewWithFlag(true);

    expect(id).toBe('247');
    // The multi-item handler is the whole point: without it an 18-item draft
    // falls through every branch of `resumeDraftById` and toasts a failure.
    expect(onMultiItem).toBeDefined();
    expect(routeFor).toBeDefined();
  });

  it('is byte-identical to the shipped call when v2 is off', () => {
    const [id, , routeFor, onMultiItem] = pressViewWithFlag(false);

    expect(id).toBe('247');
    expect(routeFor).toBeUndefined();
    expect(onMultiItem).toBeUndefined();
  });
});
