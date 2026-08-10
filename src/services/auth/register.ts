/**
 * Native in-app registration — the three-step code-verified signup.
 *
 * ⚠️ WHY THIS IS NATIVE AND MUST STAY NATIVE.
 * The app previously had no signup at all: the login screen linked out to
 * `greenbidz.com/contact-us/`, a web enquiry form. App Review rejected build 14
 * under **Guideline 3.1.1** — "access to external mechanisms for purchases or
 * subscriptions" — because that page is a B2B sign-up funnel (Company field,
 * "auction services", "list my equipment", "free valuation").
 *
 * Registration itself was never the problem; linking OUT to it was. So this flow
 * is entirely in-app, free, and creates a plain **buyer** marketplace account.
 * Never replace it with a WebView or a browser hand-off.
 *
 * Backend (already live on prod `main`, mounted at /api/v1/user):
 *   POST /user/signup-initiate         { email, password, role }  -> emails a 6-digit code
 *   POST /user/verify-signup-code      { email, code }
 *   POST /user/resend-verification-code{ email }
 *   POST /user/complete-signup         { email, first_name, ... } -> creates the account
 *
 * Two server-side facts that shape the UI:
 *  - The pending registration lives in an **in-memory Map with a 10-minute
 *    expiry**, so it does NOT survive an API restart and is not shared across
 *    instances. The code step must therefore handle "No pending registration
 *    found. Please start over." as a real, recoverable state, not a freak error.
 *  - The new account is created with `pw_user_status = "pending"`, so after
 *    signup the user is NOT logged in — they await admin approval. We route to
 *    the existing pending screen rather than inventing a second waiting state.
 */
import { greenbidz } from '@/api/greenbidzClient';
import { getAuthConfigError } from '@/lib/env';

export type RegisterErrorCode =
  /** Email already has an account — offer sign-in instead of a dead end. */
  | 'EMAIL_TAKEN'
  /** Wrong code. */
  | 'INVALID_CODE'
  /** Code expired (>10 min) — resend is the recovery. */
  | 'CODE_EXPIRED'
  /** Server forgot the pending signup (restart / expiry) — restart step 1. */
  | 'SESSION_LOST'
  | 'VALIDATION'
  | 'NETWORK'
  | 'UNKNOWN';

export class RegisterError extends Error {
  constructor(
    public code: RegisterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RegisterError';
  }
}

type ApiErr = { response?: { status?: number; data?: { message?: string } } };

/** Map an axios failure onto a code the UI can offer a recovery for. */
function toRegisterError(err: unknown, fallback: string): RegisterError {
  const e = err as ApiErr;
  if (!e.response) {
    return new RegisterError('NETWORK', 'Network error — check your connection');
  }
  const msg = e.response.data?.message ?? fallback;
  const low = msg.toLowerCase();

  // The API signals all of these with 400 + a message, so match on the text.
  if (low.includes('already registered')) {
    return new RegisterError('EMAIL_TAKEN', msg);
  }
  if (low.includes('expired')) {
    return new RegisterError('CODE_EXPIRED', msg);
  }
  if (low.includes('no pending registration') || low.includes('not verified')) {
    return new RegisterError('SESSION_LOST', msg);
  }
  if (low.includes('invalid verification code')) {
    return new RegisterError('INVALID_CODE', msg);
  }
  if (e.response.status === 400) {
    return new RegisterError('VALIDATION', msg);
  }
  return new RegisterError('UNKNOWN', msg);
}

function assertConfigured() {
  const configError = getAuthConfigError();
  if (configError) throw new RegisterError('UNKNOWN', configError);
}

/** Step 1 — create the pending signup and email a 6-digit code. */
export async function signupInitiate(email: string, password: string): Promise<void> {
  assertConfigured();
  try {
    // role stays "buyer": the app registers marketplace buyers only. Seller /
    // business onboarding (document upload, approval) is deliberately NOT here.
    await greenbidz.post('/user/signup-initiate', { email, password, role: 'buyer' });
  } catch (err) {
    throw toRegisterError(err, 'Could not start registration');
  }
}

/** Step 2 — verify the emailed code. */
export async function verifySignupCode(email: string, code: string): Promise<void> {
  assertConfigured();
  try {
    await greenbidz.post('/user/verify-signup-code', { email, code: code.trim() });
  } catch (err) {
    throw toRegisterError(err, 'Could not verify the code');
  }
}

/** Step 2b — send a fresh code (the previous one lasts 10 minutes). */
export async function resendVerificationCode(email: string): Promise<void> {
  assertConfigured();
  try {
    await greenbidz.post('/user/resend-verification-code', { email });
  } catch (err) {
    throw toRegisterError(err, 'Could not resend the code');
  }
}

export type CompleteSignupPayload = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  /** Optional on purpose — see the Guideline 3.1.1 note at the top. */
  company?: string;
  country?: string;
};

export type CompleteSignupResult = { user_id: number; email: string; name: string };

/** Step 3 — create the account. The user is left PENDING admin approval. */
export async function completeSignup(
  payload: CompleteSignupPayload,
): Promise<CompleteSignupResult> {
  assertConfigured();
  try {
    const res = await greenbidz.post('/user/complete-signup', payload);
    const data = res.data?.data;
    return {
      user_id: Number(data?.user_id ?? 0),
      email: String(data?.email ?? payload.email),
      name: String(data?.name ?? ''),
    };
  } catch (err) {
    throw toRegisterError(err, 'Could not create your account');
  }
}
