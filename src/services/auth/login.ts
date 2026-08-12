import { greenbidz } from '@/api/greenbidzClient';
import { getAuthConfigError } from '@/lib/env';
import { IS_CUSTOMER } from '@/lib/flags';
import { mmkv } from '@/lib/mmkv';
import { getSecureItem, setSecureItem } from '@/lib/secureStorage';
import { useAuth, type ApprovalState } from '@/stores/authStore';
import { logout } from './logout';

export { logout };

/** Shape of the `extra` carried on an ACCOUNT_PENDING LoginError — the pending
 *  response body, which includes the per-step `approval` facts. */
export type ApprovalStateExtra = { approval?: ApprovalState };

export type LoginPayload = { email: string; password: string };

export type LoginSuccess = {
  user: { id: number; email: string; name: string; role: 'admin' | 'seller' | 'buyer' };
  token: string;
  refreshToken: string;
  company: string | null;
};

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_PENDING'
  | 'BUYER_NOT_ALLOWED'
  | 'VALIDATION'
  | 'NETWORK'
  | 'UNKNOWN';

export class LoginError extends Error {
  constructor(
    public code: LoginErrorCode,
    message: string,
    public extra?: unknown,
  ) {
    super(message);
    this.name = 'LoginError';
  }
}

export async function login(payload: LoginPayload): Promise<LoginSuccess> {
  const configError = getAuthConfigError();
  if (configError) {
    throw new LoginError('UNKNOWN', configError);
  }

  let res;
  try {
    res = await greenbidz.post('/auth/login', payload);
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: { status?: number; data?: Record<string, unknown> };
    };
    const status = axiosErr.response?.status;
    const body = axiosErr.response?.data;

    if (status === 400) {
      throw new LoginError('VALIDATION', (body?.message as string) ?? 'Check your input');
    }
    if (status === 401) {
      throw new LoginError('INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (status === 403 && body?.code === 'EMAIL_NOT_VERIFIED') {
      throw new LoginError('EMAIL_NOT_VERIFIED', (body.message as string) ?? 'Please verify your email');
    }
    if (status === 403 && body?.code === 'ACCOUNT_PENDING') {
      await persist({
        token: body.token as string,
        refreshToken: body.refreshToken as string,
        userId: body.userId as number,
      });
      mmkv.set('auth.pending', true);
      if (body.approval) mmkv.set('auth.approval', JSON.stringify(body.approval));

      // loginV3's pending response carries NO user object — only token/refreshToken/userId
      // (controller/authV3.controller.js:220-225). Synthesise the minimum the app needs so a
      // pending user can actually USE the app as a buyer instead of hitting a wall. The real
      // profile replaces this on the first approved login.
      const pendingProfile = {
        id: Number(body.userId),
        email: payload.email,
        name: payload.email.split('@')[0],
        role: 'buyer' as const,
        company: null,
      };
      mmkv.set('auth.profile', JSON.stringify(pendingProfile));
      useAuth.getState().setProfile(pendingProfile);
      useAuth.getState().setPending(true);

      throw new LoginError('ACCOUNT_PENDING', (body.message as string) ?? 'Account pending approval', body);
    }
    if (!axiosErr.response) {
      throw new LoginError('NETWORK', 'Network error — check your connection');
    }
    throw new LoginError('UNKNOWN', (body?.message as string) ?? 'Login failed');
  }

  return finalizeAuthSuccess(res.data?.data);
}

/**
 * Persist a successful auth `data` envelope (from `loginV3` OR
 * `recheck-approval`, which return the same shape) and return the typed
 * success. Enforces the build's role fork, clears the pending flag, stores
 * tokens + the slim profile. Throws (and logs out) for a role the build
 * doesn't accept.
 */
async function finalizeAuthSuccess(payloadData: any): Promise<LoginSuccess> {
  const user = payloadData?.data?.user;
  const role = user?.role;

  // The customer (lab) build accepts BOTH buyer and seller/admin accounts —
  // they see the same buy/sell app. The power-seller build (USER_TYPE=seller)
  // stays seller/admin-only, so buyers are still bounced there.
  if (role === 'buyer' && !IS_CUSTOMER) {
    await logout();
    throw new LoginError(
      'BUYER_NOT_ALLOWED',
      'The mobile app is for sellers. Use the website to browse and bid.',
    );
  }

  const allowedRoles = IS_CUSTOMER
    ? ['admin', 'seller', 'buyer']
    : ['admin', 'seller'];
  if (!role || !allowedRoles.includes(role)) {
    await logout();
    throw new LoginError('UNKNOWN', 'This account cannot use the mobile app.');
  }

  mmkv.set('auth.pending', false);

  await persist({
    token: payloadData.token,
    refreshToken: payloadData.refreshToken,
    userId: user.id,
  });

  mmkv.set(
    'auth.profile',
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: payloadData.userDetail?.company ?? null,
    }),
  );

  return {
    user,
    token: payloadData.token,
    refreshToken: payloadData.refreshToken,
    company: payloadData.userDetail?.company ?? null,
  };
}

/**
 * Re-check a PENDING account's approval without re-entering credentials, using
 * the pending refresh token saved when `login()` hit ACCOUNT_PENDING. Powers
 * the pending screen's "Check approval status" + its auto-check on open.
 *
 *   • approved        → persists full tokens + profile (via finalizeAuthSuccess)
 *                       and resolves; the caller then enters the app.
 *   • still pending   → throws LoginError('ACCOUNT_PENDING').
 *   • dead/expired    → 401 → the axios interceptor logs out + routes to login.
 */
export async function recheckApproval(): Promise<LoginSuccess> {
  const refreshToken = await getSecureItem('auth.refreshToken');
  if (!refreshToken) {
    throw new LoginError('UNKNOWN', 'No pending session found. Please sign in again.');
  }

  let res;
  try {
    res = await greenbidz.post('/auth/recheck-approval', { refreshToken });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: Record<string, unknown> } };
    const status = axiosErr.response?.status;
    const body = axiosErr.response?.data;

    if (status === 403 && body?.code === 'ACCOUNT_PENDING') {
      if (body.approval) mmkv.set('auth.approval', JSON.stringify(body.approval));
      throw new LoginError('ACCOUNT_PENDING', (body.message as string) ?? 'Still pending approval', body);
    }
    if (status === 401) {
      // The interceptor already logged out on 401; surface a clear message.
      throw new LoginError('INVALID_CREDENTIALS', 'Session expired — please sign in again');
    }
    if (!axiosErr.response) {
      throw new LoginError('NETWORK', 'Network error — check your connection');
    }
    throw new LoginError('UNKNOWN', (body?.message as string) ?? 'Could not check approval');
  }

  return finalizeAuthSuccess(res.data?.data);
}

async function persist({
  token,
  refreshToken,
  userId,
}: {
  token: string;
  refreshToken: string;
  userId: number;
}) {
  await setSecureItem('auth.accessToken', token);
  await setSecureItem('auth.refreshToken', refreshToken);
  mmkv.set('auth.userId', userId);
}

