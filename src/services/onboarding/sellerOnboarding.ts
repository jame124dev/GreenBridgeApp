/**
 * Seller onboarding — the API layer for the `/auth2` port.
 *
 * Modelled on `services/auth/register.ts`: same `greenbidz` client, same
 * typed-error shape, same "map the server's message onto a code the UI can
 * offer a recovery for".
 *
 * ⚠️⚠️ READ BEFORE CALLING ANY OF THIS AGAINST A REAL BACKEND.
 *
 * `signupSellerV2` CREATES A REAL USER ROW. The app's `.env` currently points
 * at **prod** (`api.101recycle.greenbidz.com`), where that means a real account
 * in DB `greenbidz` against real sellers. CLAUDE.md § "dev/staging first":
 * all work goes against dev (`testapi.greenbidz.com`, DB `greenbidz_test`) and
 * prod needs an explicit go, every time. Point the env at dev before the first
 * call.
 *
 * ⚠️ THE TWO `onboarding-details` ROUTES ARE UNAUTHENTICATED ON PROD.
 * Verified on `origin/main`: `routes/userRoutes.js:101-102` mount them with no
 * middleware, and `controller/authV3.controller.js:1449` / `:1501` take the
 * identity straight from `user_id` in the body and `userId` in the query, with
 * no ownership check. `PUT /user/settings` (`:109`) is the same and also writes
 * `bankDetails`. So anyone can read or overwrite any seller's company name,
 * tax ID and address, and flip `onboarding_completed` — the flag the dashboard
 * gate trusts. The owner's decision (2026-10-05) is to leave the server as it
 * is; this note exists so nobody later reads these calls as proof the routes
 * are safe. See `Docs/v2/authv2/00-introduction.md`.
 *
 * ⚠️ `role: 'seller'` IS THE CONTESTED PATH. `services/auth/register.ts` says,
 * deliberately: "role stays 'buyer': the app registers marketplace buyers only.
 * Seller / business onboarding (document upload, approval) is deliberately NOT
 * here" — because of App Review Guideline 3.1.1, which rejected this app twice.
 * Everything here is reachable only from the `__DEV__` route. Do not wire it
 * into a shipped flow until that question is answered.
 */
import { greenbidz } from '@/api/greenbidzClient';
import { getAuthConfigError } from '@/lib/env';

export type OnboardingErrorCode =
  /** Email already has an account — offer sign-in, never a dead end. */
  | 'EMAIL_TAKEN'
  /** 400 with a field complaint. */
  | 'VALIDATION'
  /** No response at all. */
  | 'NETWORK'
  | 'UNKNOWN';

/** Where this module's own copy lives. The server's own text is never keyed. */
export const ONBOARDING_ERROR_KEYS = {
  network: 'mobile.auth.onboarding.errors.network',
  noUserId: 'mobile.auth.onboarding.errors.noUserId',
  createAccount: 'mobile.auth.onboarding.errors.createAccount',
  saveAnswers: 'mobile.auth.onboarding.errors.saveAnswers',
  loadProgress: 'mobile.auth.onboarding.errors.loadProgress',
  completeNotPersisted: 'mobile.auth.onboarding.errors.completeNotPersisted',
} as const;

/**
 * ⚠️ THE MESSAGE THE UI SHOWS IS CHOSEN BY `messageKey`, NOT BY `message`.
 *
 * These are thrown from module scope, where there is no `t` — so an error
 * raised here cannot translate itself, and `OnboardingFlow` renders
 * `api.error` verbatim. `messageKey` is the i18n key for copy WE wrote;
 * `message` stays the raw text for the cases where the sentence came from the
 * SERVER (a validation complaint, "email already registered"), which no
 * locale file can contain. The UI prefers the key and falls back to `message`.
 */
export class OnboardingError extends Error {
  code: OnboardingErrorCode;
  /** i18n key for app-authored copy; absent when `message` is the server's. */
  messageKey?: string;
  constructor(code: OnboardingErrorCode, message: string, messageKey?: string) {
    super(message);
    this.name = 'OnboardingError';
    this.code = code;
    this.messageKey = messageKey;
  }
}

type ApiErr = { response?: { status?: number; data?: { message?: string } } };

function toOnboardingError(err: unknown, fallbackKey: string): OnboardingError {
  const e = err as ApiErr;
  if (!e.response) {
    return new OnboardingError('NETWORK', 'Network error', ONBOARDING_ERROR_KEYS.network);
  }
  const serverMsg = e.response.data?.message;
  // The duplicate-email case is a 400 with a message and no code, same as the
  // v1 signup — match the text, as `register.ts` does. The server's wording is
  // kept as-is: it is not ours to key, and it is more specific than any
  // fallback we could write.
  if (serverMsg && /already registered|already exists/i.test(serverMsg)) {
    return new OnboardingError('EMAIL_TAKEN', serverMsg);
  }
  const code = e.response.status === 400 ? 'VALIDATION' : 'UNKNOWN';
  if (serverMsg) return new OnboardingError(code, serverMsg);
  return new OnboardingError(code, '', fallbackKey);
}

function assertConfigured() {
  const configError = getAuthConfigError();
  if (configError) throw new OnboardingError('UNKNOWN', configError);
}

/* ── Step 1: create the account ─────────────────────────────────────────── */

export type SellerSignupPayload = {
  email: string;
  password: string;
  /** Full name is split by the caller — the API wants two fields. */
  first_name: string;
  last_name: string;
  phone: string;
  role: 'buyer' | 'seller';
  /**
   * The user's language, NOT a hardcoded 'en'. The web posts `lang: "en"`
   * unconditionally (`SellerOnboarding.tsx:539`), which is why a Chinese
   * seller gets English transactional mail. Do not copy that.
   */
  lang: string;
  team_invite_code?: string;
};

export type SellerSignupResult = {
  userId: number;
  token?: string;
  refreshToken?: string;
  name?: string;
  company?: string;
};

export async function signupSellerV2(
  payload: SellerSignupPayload,
): Promise<SellerSignupResult> {
  assertConfigured();
  try {
    const res = await greenbidz.post<{ success?: boolean; message?: string; data?: any }>(
      '/user/signup-with-link-v2',
      payload,
    );
    const d = res.data?.data;
    const userId = Number(d?.userId ?? d?.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      // Without a userId every later step silently writes nothing — see the
      // `!userId` hole documented in Docs/v2/authv2/02-account.md. Fail loudly
      // here rather than walking the wizard against no account.
      throw new OnboardingError(
        'UNKNOWN',
        'Signup succeeded but returned no user id',
        ONBOARDING_ERROR_KEYS.noUserId,
      );
    }
    return {
      userId,
      token: d?.token,
      refreshToken: d?.refreshToken,
      name: d?.user?.name ?? d?.user?.username,
      company: d?.company && d.company !== 'null' ? d.company : undefined,
    };
  } catch (err) {
    if (err instanceof OnboardingError) throw err;
    throw toOnboardingError(err, ONBOARDING_ERROR_KEYS.createAccount);
  }
}

/* ── The onboarding-details row ─────────────────────────────────────────── */

/**
 * Snake_case on purpose — this is the wire shape the controller destructures
 * (`authV3.controller.js:1449`). Every field is optional; the controller only
 * writes the keys that are present, so a step can save just its own answer.
 */
export type OnboardingDetailsPatch = {
  seller_type?: 'reseller' | 'company';
  monthly_volume?: string;
  calibration?: string;
  website?: string;
  biz_role?: string;
  biz_phone?: string;
  marketing_opt_in?: boolean;
  onboarding_completed?: boolean;
};

export async function saveOnboardingDetails(
  userId: number,
  patch: OnboardingDetailsPatch,
): Promise<void> {
  assertConfigured();
  try {
    await greenbidz.post('/user/onboarding-details', { user_id: userId, ...patch });
  } catch (err) {
    throw toOnboardingError(err, ONBOARDING_ERROR_KEYS.saveAnswers);
  }
}

export type OnboardingDetails = {
  sellerType: string | null;
  monthlyVolume: string | null;
  onboardingCompleted: boolean;
  website: string | null;
  bizRole: string | null;
  bizPhone: string | null;
  calibration: string | null;
};

export async function fetchOnboardingDetails(userId: number): Promise<OnboardingDetails> {
  assertConfigured();
  try {
    const res = await greenbidz.get<{ success?: boolean; data?: Partial<OnboardingDetails> }>(
      '/user/onboarding-details',
      { params: { userId } },
    );
    const d = res.data?.data ?? {};
    return {
      sellerType: d.sellerType ?? null,
      monthlyVolume: d.monthlyVolume ?? null,
      onboardingCompleted: !!d.onboardingCompleted,
      website: d.website ?? null,
      bizRole: d.bizRole ?? null,
      bizPhone: d.bizPhone ?? null,
      calibration: d.calibration ?? null,
    };
  } catch (err) {
    throw toOnboardingError(err, ONBOARDING_ERROR_KEYS.loadProgress);
  }
}

/**
 * The completion flag, and the one call that must NOT be best-effort.
 *
 * ⚠️ The web wraps this in `try {} catch {}` and redirects regardless
 * (`SellerOnboarding.tsx:733`, `:744`). The dashboard gate then bounces anyone
 * still marked incomplete back into the wizard, so one failed request puts the
 * seller in a loop with nothing on screen explaining it. Await it, surface the
 * failure, and offer a retry.
 *
 * It also VERIFIES by reading the row back: a 200 on the write is not proof the
 * flag persisted, and this is the single flag the gate depends on.
 */
export async function completeOnboarding(userId: number): Promise<void> {
  await saveOnboardingDetails(userId, { onboarding_completed: true });
  const stored = await fetchOnboardingDetails(userId);
  if (!stored.onboardingCompleted) {
    throw new OnboardingError(
      'UNKNOWN',
      'Saved, but the completion flag did not persist',
      ONBOARDING_ERROR_KEYS.completeNotPersisted,
    );
  }
}
