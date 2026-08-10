/**
 * State machine for the native three-step registration.
 *
 * Kept out of the screen so the transitions are testable without rendering:
 * the interesting behaviour here is the RECOVERY paths, not the happy path.
 *
 *   credentials --initiate--> code --verify--> profile --complete--> done
 *        ^                     |
 *        +-- SESSION_LOST -----+   (server's pending-signup Map is in-memory
 *                                   with a 10-min expiry, so this really happens)
 *
 * See src/services/auth/register.ts for why the flow is native rather than a
 * web hand-off (App Store Guideline 3.1.1).
 */
import { useCallback, useState } from 'react';

import {
  completeSignup,
  resendVerificationCode,
  signupInitiate,
  verifySignupCode,
  RegisterError,
  type CompleteSignupResult,
} from '@/services/auth/register';

export type RegistrationStep = 'credentials' | 'code' | 'profile' | 'done';

export type RegistrationState = {
  step: RegistrationStep;
  /** Carried across steps — the API keys its pending record by email. */
  email: string;
  busy: boolean;
  /** i18n-ready message for the current failure, or null. */
  error: string | null;
  /** Set when the failure means "start over" so the UI can say why. */
  restarted: boolean;
  result: CompleteSignupResult | null;
};

const INITIAL: RegistrationState = {
  step: 'credentials',
  email: '',
  busy: false,
  error: null,
  restarted: false,
  result: null,
};

export function useRegistration() {
  const [state, setState] = useState<RegistrationState>(INITIAL);

  const fail = useCallback((err: unknown) => {
    const e = err instanceof RegisterError ? err : null;
    const code = e?.code ?? 'UNKNOWN';
    // A lost server-side session is unrecoverable in place: the password was
    // only ever held in that Map, so the user must re-enter step 1.
    const sessionLost = code === 'SESSION_LOST';
    setState((s) => ({
      ...s,
      busy: false,
      error: e?.message ?? 'Something went wrong',
      step: sessionLost ? 'credentials' : s.step,
      restarted: sessionLost,
    }));
    return code;
  }, []);

  /** Step 1 → 2. Returns true when the code was sent. */
  const submitCredentials = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, busy: true, error: null, restarted: false }));
      try {
        await signupInitiate(email, password);
        setState((s) => ({ ...s, busy: false, step: 'code', email }));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [fail],
  );

  /** Step 2 → 3. */
  const submitCode = useCallback(
    async (code: string) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        await verifySignupCode(state.email, code);
        setState((s) => ({ ...s, busy: false, step: 'profile' }));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [state.email, fail],
  );

  const resend = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      await resendVerificationCode(state.email);
      setState((s) => ({ ...s, busy: false }));
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }, [state.email, fail]);

  /** Step 3 → done. The account is created PENDING admin approval. */
  const submitProfile = useCallback(
    async (profile: {
      firstName: string;
      lastName: string;
      phone?: string;
      company?: string;
      country?: string;
    }) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        const result = await completeSignup({
          email: state.email,
          first_name: profile.firstName,
          last_name: profile.lastName,
          phone: profile.phone,
          company: profile.company,
          country: profile.country,
        });
        setState((s) => ({ ...s, busy: false, step: 'done', result }));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [state.email, fail],
  );

  /** Manual "go back a step" for the UI's back affordance. */
  const back = useCallback(() => {
    setState((s) => ({
      ...s,
      error: null,
      restarted: false,
      step: s.step === 'profile' ? 'code' : s.step === 'code' ? 'credentials' : s.step,
    }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, submitCredentials, submitCode, resend, submitProfile, back, reset };
}
