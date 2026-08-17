/**
 * What the Settings card TELLS the user for each push-permission state.
 *
 * Round 1 collapsed everything that wasn't `granted` into one amber "Push
 * notifications are off" strip, so:
 *   • a user who had never been asked was told they had refused;
 *   • a build where push cannot work at all (this project — the FCM sender id
 *     is missing) told them to change a device setting that cannot help;
 *   • the "Turn on notifications" spinner had no ceiling, so the Android
 *     hand-off to system Settings could leave it spinning forever;
 *   • the app toasted the same instruction OneSignal's own dialog had just
 *     given.
 *
 * Lives beside the gate rather than under `features/settings/` because what it
 * pins down is the notifications permission policy, not the preferences UI.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

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

// Render English copy: `t` returns the in-code defaultValue.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}));

jest.mock('sonner-native', () => ({ toast: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: () => {} } }));
jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { createAnimatedComponent: (c: unknown) => c, View: RN.View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: unknown) => ({ value: v }),
    withTiming: (v: unknown) => v,
  };
});
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});

jest.mock('@/lib/onesignal', () => ({
  getPushPermission: jest.fn(),
  requestPushPermission: jest.fn(),
  addPushPermissionListener: jest.fn(() => () => {}),
}));

import { toast } from 'sonner-native';
import { getPushPermission, requestPushPermission } from '@/lib/onesignal';
import { NotificationPreferencesCard } from '@/features/settings/components/NotificationPreferencesCard';

const mockGet = getPushPermission as jest.MockedFunction<typeof getPushPermission>;
const mockRequest = requestPushPermission as jest.MockedFunction<typeof requestPushPermission>;
const mockToast = toast as unknown as jest.Mock;

const OFF_TITLE = 'Push notifications are off';
const SETUP_TITLE = "Push notifications aren't set up yet";
const UNAVAILABLE_TITLE = "Push notifications aren't available in this app version";
const CTA = 'Turn on notifications';
const OPENING_SETTINGS = 'Opening your device notification settings…';
const WAITING_ANSWER = 'Waiting for your answer to the permission prompt…';

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockGet.mockResolvedValue('not-determined');
  mockRequest.mockResolvedValue('denied');
});

afterEach(() => {
  jest.useRealTimers();
});

/** Render and let `usePushPermission`'s first async read land. */
async function renderCard() {
  const view = render(<NotificationPreferencesCard />);
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
  return view;
}

/** Flush the press handler's awaits (request → live re-read → toast). */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

describe('NotificationPreferencesCard — push permission states', () => {
  it('does not accuse a never-asked user of switching notifications off', async () => {
    const { queryByText } = await renderCard();
    expect(queryByText(SETUP_TITLE)).not.toBeNull();
    expect(queryByText(OFF_TITLE)).toBeNull();
  });

  it('asks the plain OS prompt for a never-asked user (no settings hand-off)', async () => {
    const { getByLabelText } = await renderCard();
    fireEvent.press(getByLabelText(CTA));
    await settle();
    expect(mockRequest).toHaveBeenCalledWith(false);
  });

  it('sends an already-declined user to system Settings, and says so once', async () => {
    mockGet.mockResolvedValue('denied');
    const { getByLabelText, queryByText } = await renderCard();
    expect(queryByText(OFF_TITLE)).not.toBeNull();

    fireEvent.press(getByLabelText(CTA));
    await settle();
    expect(mockRequest).toHaveBeenCalledWith(true);
    // OneSignal's own "Open Settings" dialog already carried that instruction —
    // toasting it too is the same message twice.
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('tells the truth when push cannot work on this build, with no CTA', async () => {
    mockGet.mockResolvedValue('unavailable');
    const { queryByText, queryByLabelText } = await renderCard();
    expect(queryByText(UNAVAILABLE_TITLE)).not.toBeNull();
    expect(queryByText(OFF_TITLE)).toBeNull();
    // No button, because no action the user can take would change anything.
    expect(queryByLabelText(CTA)).toBeNull();
  });

  it('shows no strip at all once permission is granted', async () => {
    mockGet.mockResolvedValue('granted');
    const { queryByText, queryByLabelText } = await renderCard();
    expect(queryByText(OFF_TITLE)).toBeNull();
    expect(queryByText(SETUP_TITLE)).toBeNull();
    expect(queryByText(UNAVAILABLE_TITLE)).toBeNull();
    expect(queryByLabelText(CTA)).toBeNull();
  });

  it('confirms success when the user allows notifications', async () => {
    mockRequest.mockResolvedValue('granted');
    mockGet.mockResolvedValueOnce('not-determined').mockResolvedValue('granted');
    const { getByLabelText } = await renderCard();
    fireEvent.press(getByLabelText(CTA));
    await settle();
    expect(mockToast).toHaveBeenCalledWith('Push notifications are on');
  });

  it('never blames a device setting when the SDK itself is unavailable', async () => {
    // The real state of this project: the OneSignal call throws / push is not
    // configured. "Allow notifications in your device settings" is unactionable.
    mockGet.mockResolvedValue('denied');
    mockRequest.mockResolvedValue('unavailable');
    const { getByLabelText } = await renderCard();
    fireEvent.press(getByLabelText(CTA));
    await settle();
    expect(mockToast).toHaveBeenCalledWith(UNAVAILABLE_TITLE);
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.stringContaining('device settings to turn them on'),
    );
  });

  it('explains what it is waiting for, and stops waiting', async () => {
    // The Android settings hand-off can leave this promise unsettled forever.
    mockGet.mockResolvedValue('denied');
    mockRequest.mockReturnValue(new Promise<never>(() => {}));
    const { getByLabelText, queryByText } = await renderCard();

    fireEvent.press(getByLabelText(CTA));
    await settle();
    expect(queryByText(OPENING_SETTINGS)).not.toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(11_000);
    });
    // Spinner released, and no misleading toast fired on the way out.
    expect(queryByText(OPENING_SETTINGS)).toBeNull();
    expect(getByLabelText(CTA).props.accessibilityState.busy).toBe(false);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('names the first-ask wait differently from the settings hand-off', async () => {
    mockRequest.mockReturnValue(new Promise<never>(() => {}));
    const { getByLabelText, queryByText } = await renderCard();
    fireEvent.press(getByLabelText(CTA));
    await settle();
    expect(queryByText(WAITING_ANSWER)).not.toBeNull();
    expect(queryByText(OPENING_SETTINGS)).toBeNull();
  });
});
