/**
 * The onboarding flow's write path — per-step saves against the real API.
 *
 * ⚠️ OFF BY DEFAULT, AND THAT IS A SAFETY INTERLOCK, NOT A TODO.
 *
 * `signupSellerV2` creates a real user row, and the app's `.env` points at
 * **prod** (`api.101recycle.greenbidz.com`, DB `greenbidz`). CLAUDE.md
 * § "dev/staging first" forbids that without an explicit go. So nothing fires
 * until `EXPO_PUBLIC_ONBOARDING_API=1` is set AND the API URL is the dev one
 * — `isLive` checks both, so flipping the flag while still pointed at prod
 * does nothing.
 *
 * `EXPO_PUBLIC_*` is inlined at bundle time, so changing either needs a Metro
 * restart, not a reload.
 *
 * ── WHAT EACH STEP WRITES ──
 *
 *   account      POST /user/signup-with-link-v2   → userId (+ session)
 *   sellerType   POST /user/onboarding-details     seller_type, marketing_opt_in
 *   business     PUT  /user/settings               company, companyTaxIdNumber
 *                POST /user/onboarding-details     website, biz_role, biz_phone
 *   location     PUT  /user/settings               address
 *   categories   PUT  /user/settings               interests
 *   volume       POST /user/onboarding-details     monthly_volume
 *   calibration  POST /user/onboarding-details     calibration   ← web never saves this
 *   finish       POST + GET to verify onboarding_completed
 *
 * ── TWO DELIBERATE DIFFERENCES FROM WEB ──
 *
 * 1. **Calibration is saved.** On web the handler returns before reaching that
 *    step's save, so the answer is collected and discarded while the column
 *    exists and is read back on resume. See `Docs/v2/authv2/08-calibration.md`.
 *
 * 2. **The session is stored as soon as the account exists**, not withheld
 *    until the wizard finishes. Web holds the token in memory through the whole
 *    flow; a browser tab survives that, a backgrounded Android app does not —
 *    and when it dies the `userId` goes with it, after which every `save*`
 *    silently writes nothing (each opens `if (!userId) return`, and the web's
 *    `advance` treats the returned `undefined` as success). Gating the
 *    dashboard on `onboarding_completed` achieves the same thing without
 *    putting the only copy of the credential in RAM.
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { establishSessionAfterSignup } from '@/services/auth/login';
import { getGreenbidzApiUrl } from '@/lib/env';
import { useAuth } from '@/stores/authStore';
import { updateUserSettings } from '@/services/auth/userProfile';
import {
  OnboardingError,
  completeOnboarding,
  fetchOnboardingDetails,
  saveOnboardingDetails,
  signupSellerV2,
  type SellerSignupPayload,
} from '@/services/onboarding/sellerOnboarding';
import { fetchUserProfile } from '@/services/auth/userProfile';
import { buildResumeSnapshot } from './resume';

import type { StepKey } from './mockState';

/** The dev backend. Anything else and the write path stays inert. */
const DEV_API = 'testapi.greenbidz.com';

/**
 * Both halves of the interlock, and they are read from DIFFERENT places on
 * purpose — getting that wrong silently disarms the whole thing.
 *
 * ⚠️ `GREENBIDZ_API_URL` must come from `expoConfig.extra`, NOT `process.env`.
 * Expo inlines only `EXPO_PUBLIC_*` into the client bundle; every other key in
 * `.env` reaches the app solely because `app.config.ts` copies it into `extra`.
 * This originally read `process.env.GREENBIDZ_API_URL`, which is `undefined` on
 * a device — so the check was `''.includes('testapi…')`, the function returned
 * false for every possible configuration, and the entire write path was dead
 * while appearing armed. The flow still advanced screen to screen, because each
 * write returns `true` when inert, so nothing looked wrong. Caught 2026-10-06 by
 * re-POSTing the signup the app had supposedly just made and watching the server
 * create the account for the first time.
 *
 * `getGreenbidzApiUrl()` is the one helper the rest of the app reads this
 * through (`src/lib/env.ts:8`) — stay on it rather than reaching into `extra`
 * here.
 */
export function isOnboardingApiLive(): boolean {
  if (process.env.EXPO_PUBLIC_ONBOARDING_API !== '1') return false;
  return getGreenbidzApiUrl().includes(DEV_API);
}

/** What a step needs to write. Mirrors the mock's state, flattened. */
export type OnboardingAnswers = {
  sellerType: 'reseller' | 'company' | null;
  values: Record<string, string>;
  categories: string[];
  volume: string | null;
  calibration: string | null;
};

/** Keys for the failures this hook raises itself, rather than re-throwing. */
const E = 'mobile.auth.onboarding.errors.';

export function useOnboardingApi() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ⚠️ THE ERROR BOX IS THE ONE PLACE A SERVICE-LAYER STRING REACHES THE USER.
   *
   * `OnboardingFlow` renders `api.error` verbatim, so whatever lands in it is
   * final — there is no later translation step. An `OnboardingError` that
   * carries a `messageKey` is OUR copy and gets translated here; one that
   * carries only a `message` is the SERVER's sentence (a field complaint,
   * "email already registered") and is shown as sent, because no locale file
   * can hold it. Anything that is not an `OnboardingError` at all falls back
   * to this call site's own key.
   */
  const messageOf = useCallback(
    (e: unknown, fallbackKey: string): string => {
      if (e instanceof OnboardingError) {
        if (e.messageKey) return t(e.messageKey);
        if (e.message) return e.message;
      }
      return t(fallbackKey);
    },
    [t],
  );
  /** Set only by `createAccount`, for a signup with no stored session yet. */
  const createdIdRef = useRef<number | null>(null);

  /**
   * The account the steps write against, resolved at CALL time — never during
   * render, because `react-hooks/refs` forbids reading a ref while rendering
   * and the auth store hydrates asynchronously, so a value captured at first
   * render would usually be null anyway.
   *
   * Two ways in, and both are live:
   *   · `createdIdRef` — a fresh signup, set by `createAccount` on this screen.
   *   · the signed-in profile — the web's `?resume=1` mode, a seller who
   *     already has an account coming back to finish. See `resume.ts`.
   */
  const resolveUserId = (): number | null =>
    createdIdRef.current ?? useAuth.getState().profile?.id ?? null;

  const clearError = useCallback(() => setError(null), []);

  /**
   * Load a half-finished onboarding so the wizard can reopen where it stopped.
   *
   * Returns `null` when there is nothing to resume — no live API, no signed-in
   * account, or an onboarding already marked complete. The caller treats every
   * `null` the same way: start at the top, exactly as before this existed.
   *
   * ⚠️ BEST-EFFORT ON PURPOSE, and the two requests fail independently.
   * `Promise.all` would mean one unreachable endpoint loses the other's answers
   * too, so each is caught separately: resuming with the address missing beats
   * refusing to resume. Likewise a total failure returns `null` rather than
   * throwing — being unable to restore progress must not be a dead end, it is
   * just the old behaviour.
   */
  const loadProgress = useCallback(async () => {
    if (!isOnboardingApiLive()) return null;
    const userId = resolveUserId();
    if (!userId) return null;
    try {
      const [details, profile] = await Promise.all([
        fetchOnboardingDetails(userId).catch(() => null),
        fetchUserProfile(userId).catch(() => null),
      ]);
      // Nothing came back at all — do not claim a resume we cannot support.
      if (!details && !profile) return null;
      // Already finished: the wizard is not where this person belongs.
      if (details?.onboardingCompleted) return null;
      return buildResumeSnapshot(details, profile);
    } catch {
      return null;
    }
  }, []);

  const createAccount = useCallback(async (payload: SellerSignupPayload) => {
    if (!isOnboardingApiLive()) return true;
    setSaving(true);
    setError(null);
    try {
      const res = await signupSellerV2(payload);
      createdIdRef.current = res.userId;

      /*
        Establish the session NOW, the moment the account exists — see the
        header note. Web holds the token in memory until the wizard finishes;
        on a phone that loses the credential to a background kill. Reuses
        `establishSessionAfterSignup` so the tokens land in secure storage and
        the lab socket is reset, exactly as a normal sign-in does.

        Only when the signup actually returned one. Some flows answer with no
        token (verification-first), and that is not an error — it just means
        there is no session to establish yet.
      */
      if (res.token && res.refreshToken) {
        await establishSessionAfterSignup({
          token: res.token,
          refreshToken: res.refreshToken,
          userId: res.userId,
          email: payload.email,
          name: res.name ?? `${payload.first_name} ${payload.last_name}`.trim(),
          role: payload.role,
          company: res.company ?? null,
        });
      }
      return true;
    } catch (e) {
      setError(messageOf(e, `${E}createAccount`));
      return false;
    } finally {
      setSaving(false);
    }
  }, [messageOf]);

  /**
   * Save the step that is being left. Returns false to HOLD the user on it.
   *
   * The two `/user/settings` writes are awaited and blocking because they carry
   * the required fields; the onboarding-details extras are awaited too, so a
   * silent partial save cannot happen — web fires those unawaited and a user
   * can see "saved" while their website and job title were dropped.
   */
  const saveStep = useCallback(
    async (step: StepKey, a: OnboardingAnswers): Promise<boolean> => {
      if (!isOnboardingApiLive()) return true;
      const userId = resolveUserId();
      if (!userId) {
        // Never advance writing nothing — this is the hole that lets a whole
        // wizard complete against no account.
        setError(t(`${E}sessionLost`));
        return false;
      }

      setSaving(true);
      setError(null);
      try {
        switch (step) {
          case 'sellerType':
            await saveOnboardingDetails(userId, {
              seller_type: a.sellerType ?? undefined,
            });
            break;
          case 'business':
            await updateUserSettings(userId, {
              company: a.values.bizName,
              companyTaxIdNumber: a.values.taxId,
            });
            await saveOnboardingDetails(userId, {
              website: a.values.website ?? '',
              biz_role: a.values.bizRole ?? '',
              biz_phone: a.values.bizPhone ?? '',
            });
            break;
          case 'location':
            await updateUserSettings(userId, {
              address: {
                street: a.values.street ?? '',
                city: a.values.city ?? '',
                // ⚠️ `region` on screen, `district` on the wire. Getting this
                // wrong lands the state in the wrong column silently.
                district: a.values.region ?? '',
                postalCode: a.values.postal ?? '',
                country: a.values.country ?? '',
              },
            });
            break;
          case 'categories':
            await updateUserSettings(userId, { interests: a.categories });
            break;
          case 'volume':
            await saveOnboardingDetails(userId, {
              monthly_volume: a.volume ?? undefined,
            });
            break;
          case 'calibration':
            // Saved BEFORE the completion sequence — the web bug is that this
            // never runs at all.
            await saveOnboardingDetails(userId, { calibration: a.calibration ?? '' });
            break;
        }
        return true;
      } catch (e) {
        setError(messageOf(e, `${E}saveStep`));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [messageOf, t],
  );

  /** The completion flag, awaited and read back. Returns false to hold. */
  const finish = useCallback(async (): Promise<boolean> => {
    if (!isOnboardingApiLive()) return true;
    const userId = resolveUserId();
    if (!userId) {
      setError(t(`${E}sessionLost`));
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding(userId);
      return true;
    } catch (e) {
      setError(messageOf(e, `${E}completeFailed`));
      return false;
    } finally {
      setSaving(false);
    }
  }, [messageOf, t]);

  return { saving, error, clearError, createAccount, saveStep, finish, loadProgress, resolveUserId };
}
