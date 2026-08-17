/**
 * `getPushPermission()` must return four distinct states.
 *
 * The SDK's `getPermissionAsync()` is false both for "declined" and for "never
 * asked", and round 1 mapped that single boolean straight to `denied` — which is
 * how the Settings card ended up telling users who had never seen a prompt that
 * they had turned notifications off. `canRequestPermission()` (Android, and any
 * build without the iOS enum) and `permissionNative()` (iOS) are what separate
 * the two.
 */
import { Platform } from 'react-native';

const mockNotifications = {
  getPermissionAsync: jest.fn<Promise<boolean>, []>(),
  canRequestPermission: jest.fn<Promise<boolean>, []>(),
  permissionNative: jest.fn<Promise<number>, []>(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

jest.mock('react-native-onesignal', () => ({
  OneSignal: { Notifications: mockNotifications },
  LogLevel: { Verbose: 5 },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// The module reads the app id once at import time; without one every call is
// short-circuited to `unavailable`.
process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID = 'test-app-id';

/** Fresh import per case so the module-level app id / init flag are clean. */
function loadModule(): typeof import('../onesignal') {
  let mod!: typeof import('../onesignal');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../onesignal');
  });
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
});

describe('getPushPermission', () => {
  it('reports granted when the OS says yes', async () => {
    mockNotifications.getPermissionAsync.mockResolvedValue(true);
    const { getPushPermission } = loadModule();
    await expect(getPushPermission()).resolves.toBe('granted');
  });

  it('reports not-determined while a prompt could still be shown', async () => {
    mockNotifications.getPermissionAsync.mockResolvedValue(false);
    mockNotifications.canRequestPermission.mockResolvedValue(true);
    const { getPushPermission } = loadModule();
    await expect(getPushPermission()).resolves.toBe('not-determined');
  });

  it('reports denied once the prompt is spent', async () => {
    mockNotifications.getPermissionAsync.mockResolvedValue(false);
    mockNotifications.canRequestPermission.mockResolvedValue(false);
    const { getPushPermission } = loadModule();
    await expect(getPushPermission()).resolves.toBe('denied');
  });

  it('uses the iOS native enum to tell never-asked from declined', async () => {
    Platform.OS = 'ios';
    mockNotifications.getPermissionAsync.mockResolvedValue(false);
    // canRequestPermission would lie here if it were consulted first.
    mockNotifications.canRequestPermission.mockResolvedValue(false);
    mockNotifications.permissionNative.mockResolvedValue(0); // NotDetermined
    const { getPushPermission } = loadModule();
    await expect(getPushPermission()).resolves.toBe('not-determined');

    mockNotifications.permissionNative.mockResolvedValue(1); // Denied
    await expect(getPushPermission()).resolves.toBe('denied');
  });

  it('reports unavailable when the SDK call fails', async () => {
    mockNotifications.getPermissionAsync.mockRejectedValue(new Error('no native module'));
    const { getPushPermission } = loadModule();
    await expect(getPushPermission()).resolves.toBe('unavailable');
  });
});

describe('requestPushPermission', () => {
  it('does not record a refusal the user never gave', async () => {
    // Android: swiping the dialog away resolves `false` while permission stays
    // undetermined — re-read instead of reporting `denied`.
    mockNotifications.getPermissionAsync.mockResolvedValue(false);
    mockNotifications.canRequestPermission.mockResolvedValue(true);
    const requestPermission = jest.fn<Promise<boolean>, [boolean]>().mockResolvedValue(false);
    (mockNotifications as unknown as Record<string, unknown>).requestPermission = requestPermission;

    const { requestPushPermission } = loadModule();
    await expect(requestPushPermission(false)).resolves.toBe('not-determined');
    expect(requestPermission).toHaveBeenCalledWith(false);
  });
});
