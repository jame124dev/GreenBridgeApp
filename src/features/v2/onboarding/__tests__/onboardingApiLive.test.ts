/**
 * `isOnboardingApiLive()` — the interlock guarding the one write path in this
 * app that CREATES A REAL USER.
 *
 * ⚠️ WHY THIS FILE EXISTS. The original implementation read
 * `process.env.GREENBIDZ_API_URL`. Expo inlines only `EXPO_PUBLIC_*` into the
 * client bundle, so on a device that value was `undefined`, the check collapsed
 * to `''.includes('testapi…')`, and the function returned **false for every
 * possible configuration**. The write path was dead while appearing armed —
 * invisible from the UI, because each inert write returns `true` and the wizard
 * advances exactly as it would on success. A whole seller onboarding could be
 * walked end to end on hardware, reach "Your seller profile is in review", and
 * have written nothing at all.
 *
 * So the load-bearing case here is not "it fails closed" — the broken version
 * passed that perfectly. It is **`true` is reachable at all**, with the config
 * the app actually ships. A guard that can only ever say no is not a guard.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const extra: Record<string, unknown> = {};
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra };
    },
  },
}));

import { isOnboardingApiLive } from '../useOnboardingApi';

const DEV = 'https://testapi.greenbidz.com/api/v1';
const PROD = 'https://api.101recycle.greenbidz.com/api/v1';

const original = process.env.EXPO_PUBLIC_ONBOARDING_API;

/** Mirrors how the app is configured: flag in env, URL in `expoConfig.extra`. */
function configure(flag: string | undefined, url: string | undefined) {
  if (flag === undefined) delete process.env.EXPO_PUBLIC_ONBOARDING_API;
  else process.env.EXPO_PUBLIC_ONBOARDING_API = flag;
  if (url === undefined) delete extra.GREENBIDZ_API_URL;
  else extra.GREENBIDZ_API_URL = url;
}

beforeEach(() => configure(undefined, undefined));
afterEach(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_ONBOARDING_API;
  else process.env.EXPO_PUBLIC_ONBOARDING_API = original;
  delete extra.GREENBIDZ_API_URL;
});

describe('isOnboardingApiLive', () => {
  it('OPENS when the flag is on and the URL is the dev backend', () => {
    // The case the broken version could never reach. If this fails, the write
    // path is inert no matter what anyone puts in `.env`.
    configure('1', DEV);
    expect(isOnboardingApiLive()).toBe(true);
  });

  it('reads the URL from expoConfig.extra, not process.env', () => {
    // Pin the actual defect: the value present ONLY in process.env must not be
    // enough to arm the path, because on a device it is never there.
    configure('1', undefined);
    process.env.GREENBIDZ_API_URL = DEV;
    try {
      expect(isOnboardingApiLive()).toBe(false);
    } finally {
      delete process.env.GREENBIDZ_API_URL;
    }
  });

  it.each([
    ['the flag is off', '0', DEV],
    ['the flag is unset', undefined, DEV],
    ['the flag is some other value', 'true', DEV],
    ['the URL is PROD', '1', PROD],
    ['the URL is missing', '1', undefined],
    ['the URL is empty', '1', ''],
    ['neither is set', undefined, undefined],
  ])('stays closed when %s', (_label, flag, url) => {
    configure(flag, url);
    expect(isOnboardingApiLive()).toBe(false);
  });

  it('needs BOTH halves — prod with the flag on never writes', () => {
    configure('1', PROD);
    expect(isOnboardingApiLive()).toBe(false);
    configure('1', DEV);
    expect(isOnboardingApiLive()).toBe(true);
  });
});
