import { useCallback, useEffect, useState } from 'react';

import {
  ResetError,
  resetPassword,
  sendResetOtp,
  verifyResetOtp,
  type ResetErrorCode,
} from '@/services/auth/passwordReset';

export type ResetStep = 'email' | 'otp' | 'password';

const OTP_TTL = 600; // seconds — advisory (matches backend 10-min window)
const RESEND_COOLDOWN = 30; // seconds

export interface UseForgotPasswordResult {
  step: ResetStep;
  email: string;
  isPending: boolean;
  error: ResetErrorCode | null;
  secondsLeft: number;
  resendCooldown: number;
  submitEmail: (email: string) => Promise<void>;
  submitOtp: (otp: string) => Promise<void>;
  submitNewPassword: (newPassword: string) => Promise<void>;
  resend: () => Promise<void>;
  back: () => void;
  clearError: () => void;
}

export function useForgotPassword(): UseForgotPasswordResult {
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<ResetErrorCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // One ticker drives both countdowns; runs only while something is counting.
  useEffect(() => {
    if (secondsLeft <= 0 && resendCooldown <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft, resendCooldown]);

  const codeOf = (e: unknown): ResetErrorCode => (e instanceof ResetError ? e.code : 'UNKNOWN');

  const startTimers = () => {
    setSecondsLeft(OTP_TTL);
    setResendCooldown(RESEND_COOLDOWN);
  };

  const submitEmail = useCallback(async (raw: string) => {
    const trimmed = raw.trim(); // trim only — never lowercase (see spec §Edge cases)
    setIsPending(true);
    setError(null);
    try {
      await sendResetOtp(trimmed);
      setEmail(trimmed);
      setStep('otp');
      startTimers();
    } catch (e) {
      setError(codeOf(e));
    } finally {
      setIsPending(false);
    }
  }, []);

  const submitOtp = useCallback(async (code: string) => {
    setIsPending(true);
    setError(null);
    try {
      await verifyResetOtp(email, code);
      setOtp(code);
      setStep('password');
    } catch (e) {
      setError(codeOf(e));
    } finally {
      setIsPending(false);
    }
  }, [email]);

  const submitNewPassword = useCallback(async (newPassword: string) => {
    setIsPending(true);
    setError(null);
    try {
      await resetPassword(email, otp, newPassword);
      // success → caller navigates to login; nothing else to do here.
    } catch (e) {
      const code = codeOf(e);
      setError(code);
      if (code === 'INVALID_OTP') {
        // Code expired between verify and reset — send them back to re-request.
        setOtp('');
        setStep('otp');
      }
      throw e; // signal failure so the screen does NOT navigate
    } finally {
      setIsPending(false);
    }
  }, [email, otp]);

  const resend = useCallback(async () => {
    if (resendCooldown > 0) return;
    setIsPending(true);
    setError(null);
    try {
      await sendResetOtp(email);
      startTimers();
    } catch (e) {
      setError(codeOf(e));
    } finally {
      setIsPending(false);
    }
  }, [email, resendCooldown]);

  const back = useCallback(() => {
    setError(null);
    setStep((s) => (s === 'password' ? 'otp' : 'email'));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    step, email, isPending, error, secondsLeft, resendCooldown,
    submitEmail, submitOtp, submitNewPassword, resend, back, clearError,
  };
}
