import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';

const KEYS = [
  'emailTitle', 'emailSubtitle', 'emailLabel', 'sendCode', 'codeSent', 'noAccount',
  'otpTitle', 'otpSubtitle', 'verify', 'resend', 'resendIn', 'useRecentCode',
  'codeExpired', 'invalidCode', 'newCodeSent', 'passwordTitle', 'newPassword',
  'confirmPassword', 'passwordTooShort', 'passwordMismatch', 'resetPassword',
  'resetSuccess', 'networkError',
] as const;

const reset = (bundle: any) => bundle?.mobile?.auth?.reset ?? {};

describe('forgot-password i18n keys', () => {
  it.each([['en', en], ['zh-Hant', zhHant], ['zh-Hans', zhHans]])(
    '%s has every reset key (non-empty)',
    (_locale, bundle) => {
      const r = reset(bundle);
      for (const k of KEYS) {
        expect(typeof r[k]).toBe('string');
        expect((r[k] as string).length).toBeGreaterThan(0);
      }
    },
  );

  it('zh translations are not identical to English (i.e. actually translated)', () => {
    const e = reset(en), t = reset(zhHant), s = reset(zhHans);
    // A representative sample must differ from EN (guards against fallback-only).
    for (const k of ['emailTitle', 'sendCode', 'verify', 'resetPassword'] as const) {
      expect(t[k]).not.toBe(e[k]);
      expect(s[k]).not.toBe(e[k]);
    }
  });
});
