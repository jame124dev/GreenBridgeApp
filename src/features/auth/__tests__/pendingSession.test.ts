/**
 * A PENDING login must produce a usable BUYER session, not a dead end.
 *
 * `loginV3` answers 403 `ACCOUNT_PENDING` for any account whose
 * `pw_user_status !== "approved"` — which is the state EVERY new app signup
 * starts in — but that response already carries a real, working JWT. It does
 * NOT carry a user object (controller/authV3.controller.js:211-226), so the app
 * has to synthesise the minimum profile itself; without one, `useAuth().profile`
 * stays null and every profile-gated screen behaves as if nobody is signed in.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn() },
}));
jest.mock('@/lib/secureStorage', () => ({
  getSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
  deleteSecureItem: jest.fn(),
}));
// In-memory MMKV: the real one is a Nitro native module that cannot load under
// Jest, and this test asserts what was PERSISTED, so a no-op mock won't do.
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
// `login()` bails out before touching the network when app.config `extra` is
// missing X_SYSTEM_KEY / GREENBIDZ_API_URL, which is the case under Jest.
jest.mock('@/lib/env', () => ({ getAuthConfigError: () => null }));

import { greenbidz } from '@/api/greenbidzClient';
import { mmkv } from '@/lib/mmkv';
import { login, LoginError } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';

const post = greenbidz.post as jest.Mock<any>;

beforeEach(() => {
  post.mockReset();
  useAuth.getState().reset();
});

describe('pending login', () => {
  it('persists a usable buyer profile when the account is pending', async () => {
    post.mockRejectedValue({
      response: {
        status: 403,
        data: {
          code: 'ACCOUNT_PENDING',
          message: 'Your account is pending approval.',
          token: 'tok',
          refreshToken: 'ref',
          userId: 4242,
        },
      },
    });

    await expect(login({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(LoginError);

    const raw = mmkv.getString('auth.profile');
    expect(raw).toBeTruthy();
    const profile = JSON.parse(raw as string);
    expect(profile).toEqual({
      id: 4242,
      email: 'a@b.com',
      name: 'a', // derived from the address; replaced on first approved login
      role: 'buyer',
      company: null,
    });
    expect(mmkv.getBoolean('auth.pending')).toBe(true);
  });

  it('leaves useAuth().profile non-null so the app treats the user as signed in', async () => {
    post.mockRejectedValue({
      response: {
        status: 403,
        data: {
          code: 'ACCOUNT_PENDING',
          message: 'Your account is pending approval.',
          token: 'tok',
          refreshToken: 'ref',
          userId: 7,
        },
      },
    });

    await expect(login({ email: 'ada@lovelace.dev', password: 'x' })).rejects.toBeInstanceOf(
      LoginError,
    );

    expect(useAuth.getState().profile).toEqual({
      id: 7,
      email: 'ada@lovelace.dev',
      name: 'ada',
      role: 'buyer',
      company: null,
    });
    expect(useAuth.getState().isPending).toBe(true);
  });
});
