/**
 * State machine for the native two-step registration.
 *
 * Kept out of the screen so the transitions are testable without rendering:
 * the interesting behaviour here is the RECOVERY paths, not the happy path.
 *
 *   credentials --initiate--> code --verify+complete--> done
 *        ^                     |
 *        +-- SESSION_LOST -----+   (server's pending-signup Map is in-memory
 *                                   with a 10-min expiry, so this really happens)
 *
 * There is deliberately NO profile step: signup asks for email, password and a
 * name, nothing else. Company/tax/business details belong to the seller-upgrade
 * application, not to signing up — collecting them here is what reads as
 * "account registration for businesses and organizations" (Guideline 3.1.1).
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

export type RegistrationStep = 'credentials' | 'code' | 'done';

/** "Ada Lovelace" -> ['Ada','Lovelace']; "Ada" -> ['Ada','Ada'].
 *  Duplicating a single word beats letting the server fall back to the email
 *  prefix, which shows up as e.g. "abhay" in a seller's chat thread. */
function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts.slice(1).join(' ') : first;
  return [first, last];
}

export type RegistrationState = {
  step: RegistrationStep;
  /** Carried across steps — the API keys its pending record by email. */
  email: string;
  /** Carried from step 1 so `submitCode` can complete the signup in one go. */
  name: string;
  /**
   * Also carried from step 1, because `complete-signup` returns NO session — the
   * "Start browsing" button has to sign in with these credentials. Memory only:
   * never written to MMKV, and gone the moment the screen unmounts.
   */
  password: string;
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
  name: '',
  password: '',
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
    async (email: string, password: string, name: string) => {
      setState((s) => ({ ...s, busy: true, error: null, restarted: false }));
      try {
        await signupInitiate(email, password);
        setState((s) => ({ ...s, busy: false, step: 'code', email, name, password }));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [fail],
  );

  /** Step 2 → done. Verifies the code and creates the account in one go — there
   *  is no third step to send the user to. */
  const submitCode = useCallback(
    async (code: string) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        await verifySignupCode(state.email, code);
        const [first_name, last_name] = splitName(state.name);
        const result = await completeSignup({ email: state.email, first_name, last_name });
        setState((s) => ({ ...s, busy: false, step: 'done', result }));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [state.email, state.name, fail],
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

  /** Manual "go back a step" for the UI's back affordance. */
  const back = useCallback(() => {
    setState((s) => ({
      ...s,
      error: null,
      restarted: false,
      step: s.step === 'code' ? 'credentials' : s.step,
    }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, submitCredentials, submitCode, resend, back, reset };
}
