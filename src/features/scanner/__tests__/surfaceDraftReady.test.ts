import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { toast } from 'sonner-native';

// `sonner-native` is auto-mocked by __mocks__/sonner-native.js (its toast.* are
// no-ops); we just spy to assert calls. NotificationToast is passed to
// toast.custom as an element (never rendered here) — stub it so its theme/ui
// import chain doesn't load. draftKeys is all the SUT needs from draftHooks;
// the real module transitively pulls in the axios/mmkv (native) chain.
jest.mock('@/features/lab/notifications/NotificationToast', () => ({
  NotificationToast: () => null,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/services/drafts/draftHooks', () => ({ draftKeys: { all: ['drafts'] } }));
// The toast's "View" calls resumeDraftById; stub it so its heavy import chain
// (draftApi → axios → mmkv native) doesn't load in the jest env.
jest.mock('@/features/scanner/useResumeDraft', () => ({ resumeDraftById: jest.fn() }));

import {
  parseRecognitionReady,
  surfaceDraftReady,
  surfaceDraftFailed,
  alreadySurfaced,
  __resetSurfaced,
} from '@/features/scanner/surfaceDraftReady';

const mockCustom = jest.spyOn(toast, 'custom');
const mockError = jest.spyOn(toast, 'error');
const t = (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k;

beforeEach(() => {
  __resetSurfaced();
  mockCustom.mockClear();
  mockError.mockClear();
});

describe('parseRecognitionReady', () => {
  it('accepts the backend recognition_ready socket frame', () => {
    expect(
      parseRecognitionReady({ kind: 'recognition_ready', draft_id: 69, job_id: 'j-1' }),
    ).toEqual({ jobId: 'j-1', draftId: 69 });
  });

  it('accepts a wrapped notification row with type=recognition', () => {
    expect(
      parseRecognitionReady({ notification: { type: 'recognition' }, job_id: 7 }),
    ).toEqual({ jobId: '7', draftId: undefined });
  });

  it('ignores unrelated notifications', () => {
    expect(parseRecognitionReady({ kind: 'chat' })).toBeNull();
    expect(parseRecognitionReady({ notification: { type: 'chat' } })).toBeNull();
    expect(parseRecognitionReady(null)).toBeNull();
    expect(parseRecognitionReady('nope')).toBeNull();
  });
});

describe('surfaceDraftReady', () => {
  it('invalidates the drafts query and raises exactly one toast', () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries } as any;

    const first = surfaceDraftReady({ jobId: 'j-1', draftId: 69 }, { queryClient, t });

    expect(first).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['drafts'] });
    expect(mockCustom).toHaveBeenCalledTimes(1);
  });

  it('dedupes by job id across delivery layers (socket + poll + push)', () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries } as any;

    // Same job reported by three layers — only the first surfaces.
    surfaceDraftReady({ jobId: 'j-1' }, { queryClient, t });
    const second = surfaceDraftReady({ jobId: 'j-1', draftId: 69 }, { queryClient, t });
    const third = surfaceDraftReady({ jobId: 'j-1' }, { queryClient, t });

    expect(second).toBe(false);
    expect(third).toBe(false);
    expect(mockCustom).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(alreadySurfaced({ jobId: 'j-1' })).toBe(true);
  });

  it('is a no-op without a job or draft id', () => {
    const queryClient = { invalidateQueries: jest.fn() } as any;
    expect(surfaceDraftReady({}, { queryClient, t })).toBe(false);
    expect(mockCustom).not.toHaveBeenCalled();
  });
});

describe('surfaceDraftFailed', () => {
  it('raises an error toast', () => {
    surfaceDraftFailed({ t });
    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it('dedupes by job id (poll race vs on-screen error)', () => {
    surfaceDraftFailed({ jobId: 'j-9', t });
    surfaceDraftFailed({ jobId: 'j-9', t });
    expect(mockError).toHaveBeenCalledTimes(1);
  });
});
