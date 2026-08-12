/**
 * Registration state machine — the RECOVERY paths, which are the ones that
 * decide whether a user gets stuck.
 *
 * The server keeps the pending signup in an in-memory Map with a 10-minute
 * expiry, so "No pending registration found. Please start over." is a routine
 * outcome (API restart, slow user), not an exotic error. It must land the user
 * back on step 1 with an explanation, because the password only ever existed in
 * that Map and cannot be recovered.
 */
import { renderHook, act } from '@testing-library/react-native';

// ⚠️ Do NOT `jest.requireActual` this module: the real one imports the axios
// client → mmkv → a Nitro native module, which cannot load under Jest. Declare
// the error class inside the factory instead. Both the hook and this test import
// it from the same mocked path, so `instanceof RegisterError` still matches.
// `__esModule: true` is required — without it Babel's interopRequireWildcard
// copies the namespace and the hook sees a different binding.
jest.mock('@/services/auth/register', () => {
  // NB: no TypeScript parameter properties (`public code: string`) here — Babel
  // compiles those through a _defineProperty helper, which the factory is not
  // allowed to reference. Assign the field by hand.
  class MockRegisterError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'RegisterError';
      this.code = code;
    }
  }
  return {
    __esModule: true,
    RegisterError: MockRegisterError,
    signupInitiate: jest.fn(),
    verifySignupCode: jest.fn(),
    resendVerificationCode: jest.fn(),
    completeSignup: jest.fn(),
  };
});

import {
  completeSignup,
  resendVerificationCode,
  signupInitiate,
  verifySignupCode,
  RegisterError,
} from '@/services/auth/register';
import { useRegistration } from '../useRegistration';

const mockInitiate = signupInitiate as jest.MockedFunction<typeof signupInitiate>;
const mockVerify = verifySignupCode as jest.MockedFunction<typeof verifySignupCode>;
const mockResend = resendVerificationCode as jest.MockedFunction<typeof resendVerificationCode>;
const mockComplete = completeSignup as jest.MockedFunction<typeof completeSignup>;

beforeEach(() => jest.clearAllMocks());

describe('useRegistration', () => {
  // Two steps, not three: verifying the code also creates the account. There is
  // no `submitProfile` — company/tax details moved to the seller application.
  it('walks credentials -> code -> done', async () => {
    mockInitiate.mockResolvedValue(undefined);
    mockVerify.mockResolvedValue(undefined);
    mockComplete.mockResolvedValue({ user_id: 42, email: 'a@b.com', name: 'A B' });

    const { result } = renderHook(() => useRegistration());
    expect(result.current.state.step).toBe('credentials');

    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'A B');
    });
    expect(result.current.state.step).toBe('code');
    expect(result.current.state.email).toBe('a@b.com');

    await act(async () => {
      await result.current.submitCode('123456');
    });
    expect(result.current.state.step).toBe('done');
    expect(result.current.state.result?.user_id).toBe(42);
  });

  it('registers a BUYER account (never a business/seller one)', async () => {
    mockInitiate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'A B');
    });
    // The service pins role: 'buyer'; assert the hook doesn't override it.
    expect(mockInitiate).toHaveBeenCalledWith('a@b.com', 'hunter2hunter2');
  });

  it('sends the user back to step 1 when the server forgot the signup', async () => {
    mockInitiate.mockResolvedValue(undefined);
    mockVerify.mockRejectedValue(
      new RegisterError('SESSION_LOST', 'No pending registration found. Please start over.'),
    );

    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'A B');
    });
    await act(async () => {
      await result.current.submitCode('123456');
    });

    expect(result.current.state.step).toBe('credentials');
    // `restarted` is what makes the screen explain the jump instead of just
    // silently resetting, which would read as a bug.
    expect(result.current.state.restarted).toBe(true);
    expect(result.current.state.error).toMatch(/start over/i);
  });

  it('keeps the user on the code step for a wrong code', async () => {
    mockInitiate.mockResolvedValue(undefined);
    mockVerify.mockRejectedValue(new RegisterError('INVALID_CODE', 'Invalid verification code'));

    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'A B');
    });
    await act(async () => {
      await result.current.submitCode('000000');
    });

    expect(result.current.state.step).toBe('code');
    expect(result.current.state.restarted).toBe(false);
    expect(result.current.state.error).toMatch(/invalid/i);
  });

  it('surfaces an already-registered email without advancing', async () => {
    mockInitiate.mockRejectedValue(new RegisterError('EMAIL_TAKEN', 'Email already registered'));

    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('taken@b.com', 'hunter2hunter2', 'A B');
    });

    expect(result.current.state.step).toBe('credentials');
    expect(result.current.state.error).toMatch(/already registered/i);
  });

  it('clears busy after a failure so the button is not stuck spinning', async () => {
    mockInitiate.mockRejectedValue(new RegisterError('NETWORK', 'Network error'));
    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'A B');
    });
    expect(result.current.state.busy).toBe(false);
  });

  it('resend keeps the user on the code step', async () => {
    mockInitiate.mockResolvedValue(undefined);
    mockResend.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'A B');
    });
    await act(async () => {
      await result.current.resend();
    });

    expect(mockResend).toHaveBeenCalledWith('a@b.com');
    expect(result.current.state.step).toBe('code');
  });

  it('splits one name field into first and last for the API', async () => {
    mockInitiate.mockResolvedValue(undefined);
    mockVerify.mockResolvedValue(undefined);
    mockComplete.mockResolvedValue({ user_id: 1, email: 'a@b.com', name: 'Ada Lovelace' });

    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'Ada Lovelace');
    });
    await act(async () => {
      await result.current.submitCode('123456');
    });

    expect(mockComplete).toHaveBeenCalledWith({
      email: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
    expect(result.current.state.step).toBe('done');
  });

  it('uses a single-word name for both fields', async () => {
    mockInitiate.mockResolvedValue(undefined);
    mockVerify.mockResolvedValue(undefined);
    mockComplete.mockResolvedValue({ user_id: 1, email: 'a@b.com', name: 'Ada' });
    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'Ada');
    });
    await act(async () => {
      await result.current.submitCode('123456');
    });
    // The server would otherwise fall back to the email prefix, which reads as broken in chat.
    expect(mockComplete).toHaveBeenCalledWith({
      email: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Ada',
    });
  });

  it('back() steps within the flow and clears the error', async () => {
    mockInitiate.mockResolvedValue(undefined);
    mockVerify.mockRejectedValue(new RegisterError('INVALID_CODE', 'Invalid verification code'));
    const { result } = renderHook(() => useRegistration());
    await act(async () => {
      await result.current.submitCredentials('a@b.com', 'hunter2hunter2', 'A B');
    });
    await act(async () => {
      await result.current.submitCode('000000');
    });
    expect(result.current.state.step).toBe('code');
    expect(result.current.state.error).toMatch(/invalid/i);

    // Only one step back now — `code` is the last step before the account
    // exists, so `done` is terminal and there is no `profile` step to leave.
    act(() => result.current.back());
    expect(result.current.state.step).toBe('credentials');
    expect(result.current.state.error).toBeNull();
  });
});
