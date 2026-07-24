# Native In-App Forgot Password — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the login screen's web hand-off with a native, localized, 3-step (email → 6-digit code → new password) in-app forgot-password flow against the existing backend OTP endpoints.

**Architecture:** One `(auth)` route hosts a 3-step wizard. A thin service (`passwordReset.ts`) wraps three existing `POST /api/v1/user/forgot-password/*` endpoints; a hook (`useForgotPassword`) owns the step machine + timers; a reusable `OtpInput` handles the code entry; the screen is presentational. Frontend-only — no backend/DB changes.

**Tech Stack:** Expo / expo-router, React Native, `react-hook-form` + `zod`, the shared `greenbidz` axios client, `sonner-native` toasts, `react-i18next`, `@testing-library/react-native` (v13, incl. `renderHook`) + jest.

**Spec:** [Docs/FORGOT_PASSWORD_MOBILE_DESIGN.md](./FORGOT_PASSWORD_MOBILE_DESIGN.md)

## Global Constraints

- **Frontend-only.** No changes to `101recycle-greenbidz-backend`. Endpoints already exist on `dev` + prod.
- **Do NOT lowercase the email.** Trim only (defensive). Casing must match login, which posts as-typed.
- **`x-platform` is NOT a per-call arg** — the `greenbidz` client already sends `x-platform: LabGreenbidz` as a default header. Never pass it in a request body/headers here.
- **Chinese is in-scope:** every `mobile.auth.reset.*` key ships in `en.json`, `zh-Hant.json`, and `zh-Hans.json` (draft translations from the spec table; flag for native proofread).
- **Password policy:** min 8 chars; new + confirm must match.
- **OTP countdown is advisory:** never hard-disable Verify at 0:00 — the server's 400 is the authority.
- **Per task:** run `npx tsc --noEmit` (0 errors) and `npx jest` (all pass) before committing. Commit to **both** branches:
  ```bash
  git add <exact files>
  git commit -m "<msg>"
  git push origin feat/other-subcategory-brand
  git push origin feat/other-subcategory-brand:feat/mobile-ai-drafts-background
  ```
  (When echoing push output, redact any tokens: pipe through `grep -viE "https?://[^ ]*@"`.)
- All commands run from `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/services/auth/passwordReset.ts` (new) | 3 typed endpoint wrappers + `ResetError` (status→code mapping) |
| `src/features/auth/useForgotPassword.ts` (new) | Step machine, timers (expiry + resend cooldown), transition actions |
| `src/components/ui/OtpInput.tsx` (new) | Reusable 6-digit segmented code input |
| `src/features/auth/schema.ts` (modify) | Add `resetEmailSchema` + `newPasswordSchema` |
| `app/(auth)/forgot-password.tsx` (new) | Presentational 3-step wizard screen |
| `app/(auth)/login.tsx` (modify) | Repoint "Forgot?" to the native route; prefill email from param |
| `src/i18n/locales/{en,zh-Hant,zh-Hans}.json` (modify) | `mobile.auth.reset.*` keys |

Build order = dependency order: **i18n → service → OtpInput → hook → screen (+schema) → login repoint.**

---

### Task 1: i18n keys (en + zh-Hant + zh-Hans)

**Files:**
- Modify: `src/i18n/locales/en.json` (under `mobile.auth`)
- Modify: `src/i18n/locales/zh-Hant.json` (under `mobile.auth`)
- Modify: `src/i18n/locales/zh-Hans.json` (under `mobile.auth`)
- Test: `src/i18n/__tests__/resetKeys.test.ts` (new)

**Interfaces:**
- Produces: the key set `mobile.auth.reset.{emailTitle,emailSubtitle,emailLabel,sendCode,codeSent,noAccount,otpTitle,otpSubtitle,verify,resend,resendIn,useRecentCode,codeExpired,invalidCode,newCodeSent,passwordTitle,newPassword,confirmPassword,passwordTooShort,passwordMismatch,resetPassword,resetSuccess,networkError}` present in all three locales.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/__tests__/resetKeys.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest resetKeys`
Expected: FAIL — `reset` keys undefined in all three locales.

- [ ] **Step 3: Add the keys**

In `src/i18n/locales/en.json`, inside the existing `mobile.auth` object, add a `reset` block:
```json
"reset": {
  "emailTitle": "Reset your password",
  "emailSubtitle": "Enter your account email and we'll send you a 6-digit code.",
  "emailLabel": "Email address",
  "sendCode": "Send code",
  "codeSent": "Code sent — check your email.",
  "noAccount": "No account found with that email.",
  "otpTitle": "Enter the code",
  "otpSubtitle": "We sent a 6-digit code to {{email}}.",
  "verify": "Verify",
  "resend": "Resend code",
  "resendIn": "Resend in {{seconds}}s",
  "useRecentCode": "Enter the most recent code we sent.",
  "codeExpired": "That code may have expired. Request a new one.",
  "invalidCode": "Invalid or expired code. Request a new one.",
  "newCodeSent": "New code sent.",
  "passwordTitle": "Set a new password",
  "newPassword": "New password",
  "confirmPassword": "Confirm password",
  "passwordTooShort": "Use at least 8 characters.",
  "passwordMismatch": "Passwords don't match.",
  "resetPassword": "Reset password",
  "resetSuccess": "Password updated — sign in with your new password.",
  "networkError": "Network error — check your connection."
}
```
In `src/i18n/locales/zh-Hant.json`, inside `mobile.auth`, add:
```json
"reset": {
  "emailTitle": "重設您的密碼",
  "emailSubtitle": "輸入您的帳戶電子郵件，我們會寄送 6 位數驗證碼。",
  "emailLabel": "電子郵件",
  "sendCode": "傳送驗證碼",
  "codeSent": "驗證碼已寄出，請查看您的電子郵件。",
  "noAccount": "找不到使用此電子郵件的帳戶。",
  "otpTitle": "輸入驗證碼",
  "otpSubtitle": "我們已將 6 位數驗證碼寄至 {{email}}。",
  "verify": "驗證",
  "resend": "重新傳送驗證碼",
  "resendIn": "{{seconds}} 秒後可重新傳送",
  "useRecentCode": "請輸入我們最近寄送的驗證碼。",
  "codeExpired": "驗證碼可能已過期，請重新取得。",
  "invalidCode": "驗證碼無效或已過期，請重新取得。",
  "newCodeSent": "已傳送新的驗證碼。",
  "passwordTitle": "設定新密碼",
  "newPassword": "新密碼",
  "confirmPassword": "確認密碼",
  "passwordTooShort": "請至少使用 8 個字元。",
  "passwordMismatch": "兩次輸入的密碼不一致。",
  "resetPassword": "重設密碼",
  "resetSuccess": "密碼已更新，請使用新密碼登入。",
  "networkError": "網路錯誤，請檢查您的連線。"
}
```
In `src/i18n/locales/zh-Hans.json`, inside `mobile.auth`, add:
```json
"reset": {
  "emailTitle": "重置您的密码",
  "emailSubtitle": "输入您的账户电子邮件，我们会发送 6 位数验证码。",
  "emailLabel": "电子邮件",
  "sendCode": "发送验证码",
  "codeSent": "验证码已发送，请查看您的电子邮件。",
  "noAccount": "找不到使用此电子邮件的账户。",
  "otpTitle": "输入验证码",
  "otpSubtitle": "我们已将 6 位数验证码发送至 {{email}}。",
  "verify": "验证",
  "resend": "重新发送验证码",
  "resendIn": "{{seconds}} 秒后可重新发送",
  "useRecentCode": "请输入我们最近发送的验证码。",
  "codeExpired": "验证码可能已过期，请重新获取。",
  "invalidCode": "验证码无效或已过期，请重新获取。",
  "newCodeSent": "已发送新的验证码。",
  "passwordTitle": "设置新密码",
  "newPassword": "新密码",
  "confirmPassword": "确认密码",
  "passwordTooShort": "请至少使用 8 个字符。",
  "passwordMismatch": "两次输入的密码不一致。",
  "resetPassword": "重置密码",
  "resetSuccess": "密码已更新，请使用新密码登录。",
  "networkError": "网络错误，请检查您的连接。"
}
```
> If any locale JSON lacks a `mobile.auth` object, add `reset` at the correct nesting so the path is `mobile.auth.reset`. Validate each file parses: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))"` (repeat per file).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest resetKeys` → Expected: PASS (both tests). Then `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**
```bash
git add src/i18n/locales/en.json src/i18n/locales/zh-Hant.json src/i18n/locales/zh-Hans.json src/i18n/__tests__/resetKeys.test.ts
git commit -m "i18n: add forgot-password reset keys (en + zh-Hant + zh-Hans)"
git push origin feat/other-subcategory-brand
git push origin feat/other-subcategory-brand:feat/mobile-ai-drafts-background
```

---

### Task 2: `passwordReset.ts` service + `ResetError`

**Files:**
- Create: `src/services/auth/passwordReset.ts`
- Test: `src/services/auth/__tests__/passwordReset.test.ts`

**Interfaces:**
- Consumes: `greenbidz` from `@/api/greenbidzClient`.
- Produces:
  - `type ResetErrorCode = 'NO_ACCOUNT' | 'INVALID_OTP' | 'NETWORK' | 'UNKNOWN'`
  - `class ResetError extends Error { code: ResetErrorCode }`
  - `sendResetOtp(email: string): Promise<void>`
  - `verifyResetOtp(email: string, otp: string): Promise<void>`
  - `resetPassword(email: string, otp: string, newPassword: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/services/auth/__tests__/passwordReset.test.ts` (mirrors the `draftApi.test.ts` mock pattern — create the `jest.fn()` INSIDE the factory, grab a reference after import):
```ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn() },
}));

import { greenbidz } from '@/api/greenbidzClient';
import { sendResetOtp, verifyResetOtp, resetPassword, ResetError } from '@/services/auth/passwordReset';

type AxiosLikeMock = jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
const mockPost = greenbidz.post as AxiosLikeMock;

const axiosError = (status: number, message = 'x') => ({ response: { status, data: { success: false, message } } });

beforeEach(() => mockPost.mockReset());

describe('passwordReset service', () => {
  it('sendResetOtp posts email to the send-otp endpoint (no x-platform arg)', async () => {
    mockPost.mockResolvedValue({ data: { message: 'OTP sent to email' } });
    await sendResetOtp('a@b.com');
    expect(mockPost).toHaveBeenCalledWith('/user/forgot-password/send-otp', { email: 'a@b.com' });
  });

  it('verifyResetOtp posts email+otp', async () => {
    mockPost.mockResolvedValue({ data: { verified: true } });
    await verifyResetOtp('a@b.com', '123456');
    expect(mockPost).toHaveBeenCalledWith('/user/forgot-password/verify-otp', { email: 'a@b.com', otp: '123456' });
  });

  it('resetPassword posts email+otp+newPassword', async () => {
    mockPost.mockResolvedValue({ data: { message: 'Password reset successful' } });
    await resetPassword('a@b.com', '123456', 'supersecret');
    expect(mockPost).toHaveBeenCalledWith('/user/forgot-password/reset', { email: 'a@b.com', otp: '123456', newPassword: 'supersecret' });
  });

  it('maps 404 → NO_ACCOUNT', async () => {
    mockPost.mockRejectedValue(axiosError(404, 'User not found'));
    await expect(sendResetOtp('x@y.com')).rejects.toMatchObject({ code: 'NO_ACCOUNT' });
  });

  it('maps 400 → INVALID_OTP', async () => {
    mockPost.mockRejectedValue(axiosError(400, 'Invalid OTP'));
    await expect(verifyResetOtp('x@y.com', '000000')).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('maps no-response → NETWORK', async () => {
    mockPost.mockRejectedValue({}); // no `response`
    await expect(sendResetOtp('x@y.com')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('maps other status → UNKNOWN', async () => {
    mockPost.mockRejectedValue(axiosError(500, 'boom'));
    await expect(sendResetOtp('x@y.com')).rejects.toBeInstanceOf(ResetError);
    await expect(sendResetOtp('x@y.com')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest passwordReset` → Expected: FAIL — module `@/services/auth/passwordReset` not found.

- [ ] **Step 3: Implement the service**

Create `src/services/auth/passwordReset.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest passwordReset` → Expected: PASS (all cases). Then `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**
```bash
git add src/services/auth/passwordReset.ts src/services/auth/__tests__/passwordReset.test.ts
git commit -m "feat(auth): password-reset service (send/verify/reset OTP + ResetError)"
git push origin feat/other-subcategory-brand
git push origin feat/other-subcategory-brand:feat/mobile-ai-drafts-background
```

---

### Task 3: `OtpInput` component

**Files:**
- Create: `src/components/ui/OtpInput.tsx`
- Test: `src/components/ui/__tests__/OtpInput.test.tsx`

**Interfaces:**
- Produces: `OtpInput` — props `{ value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; length?: number }` (default `length = 6`). Renders `testID="otp-input"` on the backing `TextInput`.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/OtpInput.test.tsx`:
```tsx
import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';
import { OtpInput } from '@/components/ui/OtpInput';

describe('OtpInput', () => {
  it('reports each keystroke via onChange and strips non-digits', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<OtpInput value="" onChange={onChange} />);
    fireEvent.changeText(getByTestId('otp-input'), '12a3');
    expect(onChange).toHaveBeenCalledWith('123');
  });

  it('fires onComplete once the full 6 digits are entered', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OtpInput value="12345" onChange={() => {}} onComplete={onComplete} />);
    fireEvent.changeText(getByTestId('otp-input'), '123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('does not fire onComplete before the code is full', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OtpInput value="" onChange={() => {}} onComplete={onComplete} />);
    fireEvent.changeText(getByTestId('otp-input'), '12');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest OtpInput` → Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/ui/OtpInput.tsx`:
```tsx
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fonts, greenDarkest, lab, radius } from '@/constants/theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
};

// Six styled cells backed by ONE hidden numeric TextInput. Tapping anywhere
// focuses the input; the OS one-time-code autofill lands in the same field.
export function OtpInput({ value, onChange, onComplete, length = 6 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const cells = Array.from({ length });

  const handleChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      {cells.map((_, i) => {
        const active = i === value.length;
        const filled = i < value.length;
        return (
          <View key={i} style={[styles.cell, (active || filled) && styles.cellActive]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        testID="otp-input"
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        style={styles.hiddenInput}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  cell: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: lab.hairline,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: greenDarkest },
  digit: { fontFamily: fonts.bold, fontSize: 22, color: lab.ink },
  // Full-bleed transparent input over the cells: captures typing + paste + autofill.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
});
```
> If `lab.ink` / `lab.hairline` are not exported from `@/constants/theme`, substitute the nearest existing tokens (grep `export const lab` in `src/constants/theme.ts`); do not invent new tokens.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest OtpInput` → Expected: PASS (3 cases). Then `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**
```bash
git add src/components/ui/OtpInput.tsx src/components/ui/__tests__/OtpInput.test.tsx
git commit -m "feat(ui): reusable OtpInput (6-digit segmented code input)"
git push origin feat/other-subcategory-brand
git push origin feat/other-subcategory-brand:feat/mobile-ai-drafts-background
```

---

### Task 4: `useForgotPassword` hook

**Files:**
- Create: `src/features/auth/useForgotPassword.ts`
- Test: `src/features/auth/__tests__/useForgotPassword.test.tsx`

**Interfaces:**
- Consumes: `sendResetOtp`, `verifyResetOtp`, `resetPassword`, `ResetError`, `ResetErrorCode` from `@/services/auth/passwordReset` (Task 2).
- Produces: `useForgotPassword(): UseForgotPasswordResult` with:
  - `step: 'email' | 'otp' | 'password'`, `email: string`, `isPending: boolean`, `error: ResetErrorCode | null`, `secondsLeft: number`, `resendCooldown: number`
  - `submitEmail(email): Promise<void>` — trims, on success → step `otp`, starts 600s + 30s timers
  - `submitOtp(otp): Promise<void>` — on success → step `password`
  - `submitNewPassword(newPassword): Promise<void>` — resolves on success (caller navigates); on `INVALID_OTP` sets error + returns to step `otp` and **rethrows**
  - `resend(): Promise<void>` — no-op while `resendCooldown > 0`; else re-sends + restarts timers
  - `back(): void`, `clearError(): void`

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/__tests__/useForgotPassword.test.tsx`:
```tsx
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('@/services/auth/passwordReset', () => {
  class ResetError extends Error {
    constructor(public code: string, message: string) { super(message); }
  }
  return {
    ResetError,
    sendResetOtp: jest.fn(),
    verifyResetOtp: jest.fn(),
    resetPassword: jest.fn(),
  };
});

import { sendResetOtp, verifyResetOtp, resetPassword, ResetError } from '@/services/auth/passwordReset';
import { useForgotPassword } from '@/features/auth/useForgotPassword';

const mockSend = sendResetOtp as jest.Mock;
const mockVerify = verifyResetOtp as jest.Mock;
const mockReset = resetPassword as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  mockSend.mockReset().mockResolvedValue(undefined);
  mockVerify.mockReset().mockResolvedValue(undefined);
  mockReset.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

describe('useForgotPassword', () => {
  it('advances email → otp on send success, trimming the email and starting timers', async () => {
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('  a@b.com  '); });
    expect(mockSend).toHaveBeenCalledWith('a@b.com');
    expect(result.current.step).toBe('otp');
    expect(result.current.email).toBe('a@b.com');
    expect(result.current.secondsLeft).toBe(600);
    expect(result.current.resendCooldown).toBe(30);
  });

  it('advances otp → password on verify success', async () => {
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('a@b.com'); });
    await act(async () => { await result.current.submitOtp('123456'); });
    expect(mockVerify).toHaveBeenCalledWith('a@b.com', '123456');
    expect(result.current.step).toBe('password');
  });

  it('surfaces NO_ACCOUNT without advancing when send-otp 404s', async () => {
    mockSend.mockRejectedValueOnce(new ResetError('NO_ACCOUNT', 'x'));
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('x@y.com'); });
    expect(result.current.step).toBe('email');
    expect(result.current.error).toBe('NO_ACCOUNT');
  });

  it('bounces back to otp and rethrows when reset returns INVALID_OTP', async () => {
    mockReset.mockRejectedValueOnce(new ResetError('INVALID_OTP', 'x'));
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
    expect(mockSend).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.resend(); }); // cooldown = 30 → no-op
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('counts the resend cooldown down each second', async () => {
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => { await result.current.submitEmail('a@b.com'); });
    expect(result.current.resendCooldown).toBe(30);
    act(() => { jest.advanceTimersByTime(3000); });
    await waitFor(() => expect(result.current.resendCooldown).toBe(27));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest useForgotPassword` → Expected: FAIL — hook module not found.

- [ ] **Step 3: Implement the hook**

Create `src/features/auth/useForgotPassword.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest useForgotPassword` → Expected: PASS (6 cases). Then `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**
```bash
git add src/features/auth/useForgotPassword.ts src/features/auth/__tests__/useForgotPassword.test.tsx
git commit -m "feat(auth): useForgotPassword step machine + timers"
git push origin feat/other-subcategory-brand
git push origin feat/other-subcategory-brand:feat/mobile-ai-drafts-background
```

---

### Task 5: `forgot-password.tsx` screen (+ schema)

**Files:**
- Modify: `src/features/auth/schema.ts` (add `resetEmailSchema`, `newPasswordSchema`)
- Create: `app/(auth)/forgot-password.tsx`
- Test: `app/(auth)/__tests__/forgot-password.test.tsx`

**Interfaces:**
- Consumes: `useForgotPassword` (Task 4), `OtpInput` (Task 3), reset i18n keys (Task 1), `resetEmailSchema`/`newPasswordSchema`.
- Produces: default-exported route component at `/(auth)/forgot-password` (file-based; auto-registered by `(auth)/_layout.tsx`).

- [ ] **Step 1: Write the failing test**

Create `app/(auth)/__tests__/forgot-password.test.tsx`:
```tsx
import { describe, it, expect, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() } }));
jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));

import ForgotPasswordScreen from '@/../app/(auth)/forgot-password';

describe('ForgotPasswordScreen', () => {
  it('renders the email step first (Send code visible, no OTP field yet)', () => {
    const { getByText, queryByTestId } = render(<ForgotPasswordScreen />);
    expect(getByText('Send code')).toBeTruthy();
    expect(queryByTestId('otp-input')).toBeNull();
  });
});
```
> The import path for a route file from a test may need adjusting to the repo's jest `moduleNameMapper`. If `@/../app/...` doesn't resolve, use a relative import from the test file: `import ForgotPasswordScreen from '../forgot-password';`. Match whatever existing `app/**/__tests__` tests do (e.g. `app/(lab)/deal/`), if present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest forgot-password` → Expected: FAIL — screen module not found.

- [ ] **Step 3a: Add the schemas**

Append to `src/features/auth/schema.ts`:
```ts
export const resetEmailSchema = z.object({
  email: z.string().email('Enter a valid email'),
});
export type ResetEmailInput = z.infer<typeof resetEmailSchema>;

export const newPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  });
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
```

- [ ] **Step 3b: Implement the screen**

Create `app/(auth)/forgot-password.tsx`:
```tsx
// Native 3-step forgot-password wizard (email → 6-digit code → new password),
// replacing the old web hand-off. Presentational: all flow logic lives in
// useForgotPassword; this maps error CODES → localized copy and renders the
// step. Styling mirrors the login screen (forest/eco-teal Stitch palette).
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { useForgotPassword } from '@/features/auth/useForgotPassword';
import {
  newPasswordSchema, resetEmailSchema,
  type NewPasswordInput, type ResetEmailInput,
} from '@/features/auth/schema';
import type { ResetErrorCode } from '@/services/auth/passwordReset';

const FOREST = '#14452f';
const TEXT_PRIMARY = '#1A1C1F';
const TEXT_SECONDARY = '#43474F';
const HAIRLINE = '#E1E5EC';

function mm(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Privacy: show a***@domain, not the full address, in the "code sent to" hint.
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  const first = user.slice(0, 1);
  return `${first}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const fp = useForgotPassword();

  // Map a hook error CODE → localized copy (keeps the hook i18n-free/testable).
  const errText = (code: ResetErrorCode | null): string | null => {
    if (!code) return null;
    if (code === 'NO_ACCOUNT') return t('mobile.auth.reset.noAccount');
    if (code === 'INVALID_OTP') return t('mobile.auth.reset.invalidCode');
    if (code === 'NETWORK') return t('mobile.auth.reset.networkError');
    return t('mobile.auth.reset.networkError');
  };

  // Hardware back: step within the flow; exit to login from the first step.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fp.step === 'email') { router.back(); return true; }
      fp.back();
      return true;
    });
    return () => sub.remove();
  }, [fp]);

  const goBack = () => {
    if (fp.step === 'email') router.back();
    else fp.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" style={styles.backBtn}>
        <ChevronLeft size={24} color={TEXT_PRIMARY} />
      </Pressable>

      {fp.step === 'email' && <EmailStep fp={fp} errText={errText} />}
      {fp.step === 'otp' && <OtpStep fp={fp} errText={errText} />}
      {fp.step === 'password' && <PasswordStep fp={fp} errText={errText} />}
    </View>
  );
}

type StepProps = {
  fp: ReturnType<typeof useForgotPassword>;
  errText: (c: ResetErrorCode | null) => string | null;
};

function EmailStep({ fp, errText }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<ResetEmailInput>({
    resolver: zodResolver(resetEmailSchema),
    defaultValues: { email: '' },
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    await fp.submitEmail(email);
    if (!fp.error) toast(t('mobile.auth.reset.codeSent'));
  });
  const serverErr = errText(fp.error);
  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.reset.emailTitle')}</RNText>
      <RNText style={styles.subtitle}>{t('mobile.auth.reset.emailSubtitle')}</RNText>
      <RNText style={styles.label}>{t('mobile.auth.reset.emailLabel')}</RNText>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="you@company.com"
            placeholderTextColor="#9aa1ad"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        )}
      />
      {errors.email ? <RNText style={styles.err}>{errors.email.message}</RNText> : null}
      {serverErr ? <RNText style={styles.err}>{serverErr}</RNText> : null}
      <Button label={t('mobile.auth.reset.sendCode')} onPress={onSubmit} loading={fp.isPending} fullWidth />
    </View>
  );
}

function OtpStep({ fp, errText }: StepProps) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const serverErr = errText(fp.error);
  // A wrong code clears the field (hook sets error, screen resets input).
  useEffect(() => {
    if (fp.error === 'INVALID_OTP') setOtp('');
  }, [fp.error]);
  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.reset.otpTitle')}</RNText>
      <RNText style={styles.subtitle}>{t('mobile.auth.reset.otpSubtitle', { email: maskEmail(fp.email) })}</RNText>
      <OtpInput value={otp} onChange={setOtp} onComplete={(v) => fp.submitOtp(v)} />
      <RNText style={styles.timer}>{mm(fp.secondsLeft)}</RNText>
      {serverErr ? <RNText style={styles.err}>{serverErr}</RNText> : null}
      <RNText style={styles.hint}>{t('mobile.auth.reset.useRecentCode')}</RNText>
      <Button label={t('mobile.auth.reset.verify')} onPress={() => fp.submitOtp(otp)} loading={fp.isPending} fullWidth />
      <Pressable
        disabled={fp.resendCooldown > 0}
        onPress={() => fp.resend().then(() => toast(t('mobile.auth.reset.newCodeSent')))}
        style={{ marginTop: 14, alignItems: 'center', opacity: fp.resendCooldown > 0 ? 0.5 : 1 }}
      >
        <RNText style={styles.resend}>
          {fp.resendCooldown > 0
            ? t('mobile.auth.reset.resendIn', { seconds: fp.resendCooldown })
            : t('mobile.auth.reset.resend')}
        </RNText>
      </Pressable>
    </View>
  );
}

function PasswordStep({ fp, errText }: StepProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const onSubmit = handleSubmit(async ({ newPassword }) => {
    try {
      await fp.submitNewPassword(newPassword);
      toast(t('mobile.auth.reset.resetSuccess'));
      router.replace({ pathname: '/(auth)/login', params: { email: fp.email } });
    } catch {
      /* hook already set the error + (for INVALID_OTP) bounced to the otp step */
    }
  });
  const serverErr = errText(fp.error);
  return (
    <View style={styles.body}>
      <RNText style={styles.title}>{t('mobile.auth.reset.passwordTitle')}</RNText>
      <RNText style={styles.label}>{t('mobile.auth.reset.newPassword')}</RNText>
      <Controller
        control={control}
        name="newPassword"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} secureTextEntry autoCapitalize="none" />
        )}
      />
      {errors.newPassword ? <RNText style={styles.err}>{errors.newPassword.message}</RNText> : null}
      <RNText style={styles.label}>{t('mobile.auth.reset.confirmPassword')}</RNText>
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput style={styles.input} value={value} onChangeText={onChange} onBlur={onBlur} secureTextEntry autoCapitalize="none" />
        )}
      />
      {errors.confirmPassword ? <RNText style={styles.err}>{errors.confirmPassword.message}</RNText> : null}
      {serverErr ? <RNText style={styles.err}>{serverErr}</RNText> : null}
      <Button label={t('mobile.auth.reset.resetPassword')} onPress={onSubmit} loading={fp.isPending} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 24 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: 16, gap: 12 },
  title: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 26, color: TEXT_PRIMARY },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY, marginBottom: 8 },
  label: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, letterSpacing: 0.6, color: TEXT_SECONDARY, textTransform: 'uppercase', marginTop: 4 },
  input: {
    minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: HAIRLINE,
    paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 15, color: TEXT_PRIMARY, backgroundColor: '#ffffff',
  },
  err: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#b42318' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: TEXT_SECONDARY, textAlign: 'center' },
  timer: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center' },
  resend: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: FOREST },
});
```
> Verify `Button` accepts `loading` + `fullWidth` (it does — see `src/components/ui/Button.tsx`). Confirm the loaded font family names against `app/_layout.tsx`'s `useFonts` map; substitute the exact loaded names if different.

- [ ] **Step 4: Run test + typecheck**

Run: `npx jest forgot-password` → Expected: PASS. Then `npx tsc --noEmit` → 0 errors. Then full `npx jest` → all pass.

- [ ] **Step 5: Commit**
```bash
git add "app/(auth)/forgot-password.tsx" "app/(auth)/__tests__/forgot-password.test.tsx" src/features/auth/schema.ts
git commit -m "feat(auth): native 3-step forgot-password screen"
git push origin feat/other-subcategory-brand
git push origin feat/other-subcategory-brand:feat/mobile-ai-drafts-background
```

---

### Task 6: Repoint login "Forgot?" + prefill email

**Files:**
- Modify: `app/(auth)/login.tsx`
- Test: `app/(auth)/__tests__/login.forgotLink.test.tsx` (new, light)

**Interfaces:**
- Consumes: the `/(auth)/forgot-password` route (Task 5).
- Produces: no new exports; behavior change only.

- [ ] **Step 1: Write the failing test**

Create `app/(auth)/__tests__/login.forgotLink.test.tsx`:
```tsx
import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';

const push = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push, back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));

import LoginScreen from '../login';

describe('login "Forgot?" link', () => {
  it('navigates to the native forgot-password route (no web browser)', () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Forgot?'));
    expect(push).toHaveBeenCalledWith('/(auth)/forgot-password');
  });
});
```
> Adjust the import path / mocks to match existing `app/(auth)` tests. If `login.tsx` uses other modules that need mocking to render in jest (e.g. `WebBrowser`), add minimal mocks so the render succeeds — the assertion is the navigation call.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest login.forgotLink` → Expected: FAIL — the link still calls `openInAppBrowser`, not `router.push`.

- [ ] **Step 3: Edit login.tsx**

1. Add the params import + read `email` for prefill. Near the top imports:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
```
Inside `LoginScreen`, before `useForm`:
```tsx
const params = useLocalSearchParams<{ email?: string }>();
```
Change the form defaults:
```tsx
defaultValues: { email: typeof params.email === 'string' ? params.email : '', password: '' },
```
2. Repoint the "Forgot?" `Pressable` `onPress` (currently `openInAppBrowser(withLang(FORGOT_PASSWORD_URL, i18n.language), …)`):
```tsx
onPress={() => router.push('/(auth)/forgot-password')}
```
3. Delete the now-unused `FORGOT_PASSWORD_URL` const (line ~27). **Keep** `CONTACT_URL`, `withLang`, and `openInAppBrowser` — the "Request an account" link still uses them.

- [ ] **Step 4: Run test + typecheck**

Run: `npx jest login.forgotLink` → Expected: PASS. Then `npx tsc --noEmit` → 0 errors (if `FORGOT_PASSWORD_URL` removal leaves `openInAppBrowser`/`withLang` used only by contact, that's fine — they're still referenced). Full `npx jest` → all pass.

- [ ] **Step 5: Commit**
```bash
git add "app/(auth)/login.tsx" "app/(auth)/__tests__/login.forgotLink.test.tsx"
git commit -m "feat(auth): repoint Forgot? to native flow + prefill email on return"
git push origin feat/other-subcategory-brand
git push origin feat/other-subcategory-brand:feat/mobile-ai-drafts-background
```

---

## Final verification (after Task 6)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx jest` → all suites pass
- [ ] Manual emulator pass **against the DEV backend** (switch `GREENBIDZ_API_URL` in `.env` to the dev API first — dev-first; never reset a real prod account): full happy path with a real inbox; unknown email → "No account found"; wrong code; resend then enter the old code (should fail); switch app language to 繁體中文/简体中文 and confirm all three steps render in Chinese.

## Spec coverage check

| Spec requirement | Task |
|---|---|
| 3 endpoints, status→code mapping, no per-call x-platform | Task 2 |
| Trim-only email (no lowercase) | Task 4 (`submitEmail`) |
| 3-step wizard, one route, Android back steps backward | Task 5 |
| OTP input 6-digit + autofill attrs | Task 3 |
| Advisory countdown (Verify not hard-disabled at 0) | Task 4 timer + Task 5 (Verify always tappable) |
| 30s resend cooldown | Task 4 |
| INVALID_OTP on reset bounces to step 2 | Task 4 (`submitNewPassword`) |
| Password min-8 + match | Task 5 (`newPasswordSchema`) |
| Prefill email on return to login | Task 6 |
| en + zh-Hant + zh-Hans keys | Task 1 |
| Replace web hand-off | Task 6 |
| Dev-first QA | Final verification |
```
