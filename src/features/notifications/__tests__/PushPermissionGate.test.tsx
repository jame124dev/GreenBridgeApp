/**
 * The defects a reviewer saw, locked in.
 *
 * 1. The OS notification prompt fired on the LOGIN screen, before sign-in.
 * 2. `requestPermission(true)` (fallback-to-settings) re-showed OneSignal's
 *    "Notifications Not Available" dialog on every launch after one decline.
 * 3. The single ask was recorded BEFORE the dialog resolved, so an app kill
 *    mid-prompt spent it while permission stayed not-determined forever.
 *
 * So: never ask while unauthenticated or on `(auth)`, never ask automatically
 * with fallback-to-settings, and treat the MMKV flag as a shortcut that the real
 * permission state can always reconcile.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';

// MMKV is a Nitro native module and cannot load under Jest (authStore imports it).
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, unknown>();
  return {
    mmkv: {
      set: (k: string, v: unknown) => store.set(k, v),
      getString: (k: string) => store.get(k) as string | undefined,
      getBoolean: (k: string) => store.get(k) as boolean | undefined,
      getNumber: (k: string) => store.get(k) as number | undefined,
      remove: (k: string) => store.delete(k),
    },
  };
});

let mockSegments: string[] = [];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));

jest.mock('@/lib/onesignal', () => ({
  getPushPermission: jest.fn(),
  requestPushPermission: jest.fn(),
}));

import { getPushPermission, requestPushPermission } from '@/lib/onesignal';
import { useAuth, type Profile } from '@/stores/authStore';
import { mmkv } from '@/lib/mmkv';
import { PushPermissionGate } from '../PushPermissionGate';
import { hasAskedForPush } from '../pushPromptState';

const mockGet = getPushPermission as jest.MockedFunction<typeof getPushPermission>;
const mockRequest = requestPushPermission as jest.MockedFunction<typeof requestPushPermission>;

const PROFILE: Profile = {
  id: 1,
  email: 'reviewer@example.com',
  name: 'Reviewer',
  role: 'buyer',
  company: null,
};

/** Signed in and sitting on a real in-app screen. */
function signedInOnHome() {
  mockSegments = ['(lab)', '(tabs)', 'home'];
  useAuth.setState({ profile: PROFILE, hydrated: true });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mmkv.remove('notifications.permissionAsked');
  useAuth.setState({ profile: null, hydrated: true });
  // The interesting default: nobody has been asked yet.
  mockGet.mockResolvedValue('not-determined');
  mockRequest.mockResolvedValue('denied');
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * One cold start: mount, run past the settle delay, flush the async permission
 * chain, then UNMOUNT.
 *
 * The unmount matters — the previous helper left each gate mounted, so a second
 * "launch" ran two gates concurrently. Its `waitFor` was also a tautology
 * (`toHaveBeenCalledTimes(mock.calls.length)`) and asserted nothing; the
 * timer-driven flush below is what actually settles the effect.
 */
async function coldStart() {
  const view = render(<PushPermissionGate />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
    // The effect awaits two promises in sequence; drain the microtask queue so
    // `markPushAsked()` has run by the time we assert on it.
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
  view.unmount();
}

describe('PushPermissionGate', () => {
  // A restored session hydrates the profile while the router is still on
  // /(auth)/login — so `profile` alone can't be what keeps the prompt off the
  // login screen. This case must fail if the `(auth)` guard is removed.
  it('never prompts on the auth screens, even with a hydrated profile', async () => {
    mockSegments = ['(auth)', 'login'];
    useAuth.setState({ profile: PROFILE, hydrated: true });
    await coldStart();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('never prompts without a signed-in profile', async () => {
    mockSegments = ['(lab)', '(tabs)', 'home'];
    await coldStart();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('prompts once, post-auth, without fallback-to-settings', async () => {
    signedInOnHome();
    await coldStart();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(false);
  });

  it('stays silent on every launch after a decline', async () => {
    signedInOnHome();
    await coldStart();
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // Second cold start: the MMKV flag survives, so nothing is asked again.
    mockRequest.mockClear();
    await coldStart();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('leaves an already-granted user alone', async () => {
    mockGet.mockResolvedValue('granted');
    signedInOnHome();
    await coldStart();
    expect(mockRequest).not.toHaveBeenCalled();
    // Nothing left to ask, so the ask is retired rather than re-read forever.
    expect(hasAskedForPush()).toBe(true);
  });

  it('never re-prompts someone who already declined at OS level', async () => {
    // e.g. a reinstall on a device that still remembers the refusal: the system
    // prompt would not appear, so calling it would be a silent no-op.
    mockGet.mockResolvedValue('denied');
    signedInOnHome();
    await coldStart();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(hasAskedForPush()).toBe(true);
  });

  it('burns no ask when push is unavailable on this build', async () => {
    // e.g. the missing FCM sender id / a dev-client without the native module:
    // degrade quietly, but keep the single ask for a build that can deliver.
    mockGet.mockResolvedValue('unavailable');
    signedInOnHome();
    await coldStart();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(hasAskedForPush()).toBe(false);

    mockGet.mockResolvedValue('not-determined');
    await coldStart();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps the ask when the prompt itself could not be shown', async () => {
    // The read saw a usable SDK, but the request call failed — no dialog ever
    // reached the user, so the one automatic ask must survive for a build that
    // can display it. Same rule as the `unavailable` read above.
    mockRequest.mockResolvedValue('unavailable');
    signedInOnHome();
    await coldStart();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(hasAskedForPush()).toBe(false);
  });

  it('does not spend the ask when the app dies mid-prompt', async () => {
    // The dialog is on screen and the promise never settles — the process is
    // killed. Marking the ask first (round 1) left the user permanently
    // not-determined AND permanently un-askable.
    mockRequest.mockReturnValue(new Promise<never>(() => {}));
    signedInOnHome();
    await coldStart();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(hasAskedForPush()).toBe(false);

    // Next launch: permission is still not-determined, so the ask the user
    // never answered is offered again — exactly once.
    mockRequest.mockClear();
    mockRequest.mockResolvedValue('granted');
    await coldStart();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(hasAskedForPush()).toBe(true);
  });
});
