import { greenbidz } from '@/api/greenbidzClient';

// Native forgot-password flow. Wraps the existing (public) backend endpoints
// mounted at /api/v1/user/forgot-password/* — the greenbidz client base already
// includes /api/v1 and already sends `x-platform: LabGreenbidz`, so these calls
// pass ONLY the body. Error codes key off HTTP status (body carries {message}).
export type ResetErrorCode = 'NO_ACCOUNT' | 'INVALID_OTP' | 'NETWORK' | 'UNKNOWN';

export class ResetError extends Error {
  constructor(public code: ResetErrorCode, message: string) {
    super(message);
    this.name = 'ResetError';
  }
}

function mapError(err: unknown): ResetError {
  const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
  if (!axiosErr.response) return new ResetError('NETWORK', 'Network error — check your connection');
  const status = axiosErr.response.status;
  const message = axiosErr.response.data?.message;
  if (status === 404) return new ResetError('NO_ACCOUNT', message ?? 'No account found');
  if (status === 400) return new ResetError('INVALID_OTP', message ?? 'Invalid or expired code');
  return new ResetError('UNKNOWN', message ?? 'Something went wrong');
}

export async function sendResetOtp(email: string): Promise<void> {
  try {
    await greenbidz.post('/user/forgot-password/send-otp', { email });
  } catch (err) {
    throw mapError(err);
  }
}

export async function verifyResetOtp(email: string, otp: string): Promise<void> {
  try {
    await greenbidz.post('/user/forgot-password/verify-otp', { email, otp });
  } catch (err) {
    throw mapError(err);
  }
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
  try {
    await greenbidz.post('/user/forgot-password/reset', { email, otp, newPassword });
  } catch (err) {
    throw mapError(err);
  }
}
