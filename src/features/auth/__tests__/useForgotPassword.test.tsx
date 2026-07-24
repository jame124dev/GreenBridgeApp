import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock the passwordReset service with a factory function
let mockSendResetOtp: jest.Mock;
let mockVerifyResetOtp: jest.Mock;
let mockResetPassword: jest.Mock;
let ResetErrorClass: any;

jest.mock('@/services/auth/passwordReset', () => {
  mockSendResetOtp = jest.fn();
  mockVerifyResetOtp = jest.fn();
  mockResetPassword = jest.fn();

  class ResetError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'ResetError';
    }
  }
  ResetErrorClass = ResetError;

  return {
    ResetError,
    sendResetOtp: mockSendResetOtp,
    verifyResetOtp: mockVerifyResetOtp,
    resetPassword: mockResetPassword,
  };
});

import { useForgotPassword } from '@/features/auth/useForgotPassword';

beforeEach(() => {
  jest.useFakeTimers();
  mockSendResetOtp.mockReset();
  // @ts-expect-error jest mock type inference
  mockSendResetOtp.mockResolvedValue(undefined);
  mockVerifyResetOtp.mockReset();
  // @ts-expect-error jest mock type inference
  mockVerifyResetOtp.mockResolvedValue(undefined);
  mockResetPassword.mockReset();
  // @ts-expect-error jest mock type inference
  mockResetPassword.mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useForgotPassword', () => {
  it('advances email → otp on send success, trimming the email and starting timers', async () => {
    const { result } = renderHook(() => useForgotPassword());
    let resolved: boolean | undefined;
    await act(async () => { resolved = await result.current.submitEmail('  a@b.com  '); });
    expect(mockSendResetOtp).toHaveBeenCalledWith('a@b.com');
    expect(result.current.step).toBe('otp');
    expect(result.current.email).toBe('a@b.com');
    expect(result.current.secondsLeft).toBe(600);
    expect(result.current.resendCooldown).toBe(30);
    expect(resolved).toBe(true);
  });

  it('advances otp → password on verify success', async () => {
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('a@b.com'); });
    await act(async () => { await result.current.submitOtp('123456'); });
    expect(mockVerifyResetOtp).toHaveBeenCalledWith('a@b.com', '123456');
    expect(result.current.step).toBe('password');
  });

  it('surfaces NO_ACCOUNT without advancing when send-otp 404s', async () => {
    // @ts-expect-error jest mock type inference
    mockSendResetOtp.mockRejectedValueOnce(new ResetErrorClass('NO_ACCOUNT', 'x'));
    const { result } = renderHook(() => useForgotPassword());
    let resolved: boolean | undefined;
    await act(async () => { resolved = await result.current.submitEmail('x@y.com'); });
    expect(result.current.step).toBe('email');
    expect(result.current.error).toBe('NO_ACCOUNT');
    expect(resolved).toBe(false);
  });

  it('bounces back to otp and rethrows when reset returns INVALID_OTP', async () => {
    // @ts-expect-error jest mock type inference
    mockResetPassword.mockRejectedValueOnce(new ResetErrorClass('INVALID_OTP', 'x'));
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('a@b.com'); });
    await act(async () => { await result.current.submitOtp('123456'); });
    await act(async () => {
      await expect(result.current.submitNewPassword('supersecret')).rejects.toBeTruthy();
    });
    expect(result.current.step).toBe('otp');
    expect(result.current.error).toBe('INVALID_OTP');
  });

  it('ignores resend while the cooldown is active', async () => {
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('a@b.com'); });
    expect(mockSendResetOtp).toHaveBeenCalledTimes(1);
    let resolved: boolean | undefined;
    await act(async () => { resolved = await result.current.resend(); }); // cooldown = 30 → no-op
    expect(mockSendResetOtp).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);
  });

  it('counts the resend cooldown down each second', async () => {
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('a@b.com'); });
    expect(result.current.resendCooldown).toBe(30);
    act(() => { jest.advanceTimersByTime(3000); });
    await waitFor(() => expect(result.current.resendCooldown).toBe(27));
  });
});
