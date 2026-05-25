import { greenbidz } from '@/api/greenbidzClient';
import { getAuthConfigError } from '@/lib/env';
import { mmkv } from '@/lib/mmkv';
import { setSecureItem } from '@/lib/secureStorage';
import { logout } from './logout';

export { logout };

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
      throw new LoginError('ACCOUNT_PENDING', (body.message as string) ?? 'Account pending approval', body);
    }
    if (!axiosErr.response) {
      throw new LoginError('NETWORK', 'Network error — check your connection');
    }
    throw new LoginError('UNKNOWN', (body?.message as string) ?? 'Login failed');
  }

  const payloadData = res.data?.data;
  const user = payloadData?.data?.user;
  const role = user?.role;

  if (role === 'buyer') {
    await logout();
    throw new LoginError(
      'BUYER_NOT_ALLOWED',
      'The mobile app is for sellers. Use the website to browse and bid.',
    );
  }

  if (role !== 'admin' && role !== 'seller') {
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

