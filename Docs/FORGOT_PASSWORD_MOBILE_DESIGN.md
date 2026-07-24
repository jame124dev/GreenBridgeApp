# Native In-App Forgot Password — Design Spec

**Date:** 2026-07-24
**App:** GreenBridgeApp (Expo / expo-router) — customer/lab fork (`EXPO_PUBLIC_USER_TYPE=customer`)
**Status:** Design approved; ready for implementation plan
**Addresses:** [Docs/Issues/app_issues.md](./Issues/app_issues.md) — client report: "clicking Forgot Password switches the Chinese page to English."

---

## Goal

Replace the current web hand-off (the login screen's "Forgot?" link opens `https://seller.greenbidz.com/forgot-password` in an in-app browser, which renders in English regardless of the app's language) with a **native, in-app, localized** forgot-password flow that keeps the user inside the app.

## Architecture (one sentence)

A single new `(auth)` route drives a **three-step wizard** (email → 6-digit code → new password) against **three password-reset endpoints that already exist on the production backend** — so this is a **frontend-only** change; no backend or database work.

## Tech stack / patterns to mirror

Reuse the exact conventions already in [app/(auth)/login.tsx](../app/(auth)/login.tsx) and [src/services/auth/login.ts](../src/services/auth/login.ts):

- **Networking:** the shared `greenbidz` axios client (`@/api/greenbidzClient`), base URL = `GREENBIDZ_API_URL` (`…/api/v1`).
- **Forms:** `react-hook-form` + `zod` (`@hookform/resolvers/zod`).
- **UI:** `Button` (`@/components/ui/Button`), themed `TextInput`, the Stitch login palette (forest `#14452f`, eco-teal `#00B289`), `sonner-native` `toast`.
- **i18n:** `react-i18next` `t('mobile.auth.reset.*', { defaultValue })`.
- **Typed errors:** a `ResetError` class mirroring `LoginError` (code + message), so the screen maps codes → localized copy.

---

## Global constraints

- **Frontend-only.** No changes to `101recycle-greenbidz-backend`. The endpoints already exist (on the backend `dev` branch and in production; the web uses them).
- **QA against the DEV backend, not prod** (dev-first policy). The routes are on the backend `dev` branch (confirmed). Point `GREENBIDZ_API_URL` at the dev API (`testapi…` / :6000) for testing — the mobile `.env` currently points at prod (`api.101recycle.greenbidz.com`), so switch it for QA. Use a **real, registered** test email that can receive the OTP; never complete a reset on an account you don't own.
- **Chinese is a first-class deliverable of this ticket** — the client is Chinese-speaking, so an English-only native flow only half-fixes the complaint. Add `zh-Hant` + `zh-Hans` for every `mobile.auth.reset.*` key as part of this work (draft table below; native proofread before ship). `ja`/`th`/`vi` stay English-fallback, consistent with existing debt.
- Keep files small and single-purpose (service / hook / screen / OTP component split).

---

## Backend API contract (existing — verbatim)

All routes are **public** (no auth middleware) and mounted under `/api/v1/user`
(`101recycle-greenbidz-backend/routes/userRoutes.js`, `controller/otpController.js` — singular `controller/`,
service `otpService.js`). The `greenbidz` client base already includes `/api/v1`,
so the client-relative paths are `/user/forgot-password/*`.

### 1. Send OTP
`POST /api/v1/user/forgot-password/send-otp`

| | |
|---|---|
| **Body** | `{ "email": string }` |
| **Platform** | The `greenbidz` client **already** sends `x-platform: LabGreenbidz` as a default header on every request (`greenbidzClient.ts:8-11`) → backend key `labgreenbidz` → OTP email branded **"101lab"** (confirmed, `brandingConfig.js:29-34`). The service adds **no** per-call header, and it is never omitted, so the "default `recycle`" path never applies. |
| **200** | `{ "message": "OTP sent to email" }` |
| **404** | `{ "message": "User not found" }` — email is not registered |
| **Behavior** | generates a **6-digit** numeric OTP, **10-minute** expiry, deletes any previous OTP for that email, emails a branded template. |

### 2. Verify OTP
`POST /api/v1/user/forgot-password/verify-otp`

| | |
|---|---|
| **Body** | `{ "email": string, "otp": string }` |
| **200** | `{ "verified": true }` |
| **400** | `{ "message": "Invalid OTP" }` (no match) or `{ "message": "OTP expired" }` |

### 3. Reset password
`POST /api/v1/user/forgot-password/reset`

| | |
|---|---|
| **Body** | `{ "email": string, "otp": string, "newPassword": string }` |
| **200** | `{ "message": "Password reset successful" }` |
| **400** | `{ "message": "Invalid OTP" }` or `{ "message": "OTP expired" }` |
| **404** | `{ "message": "User not found" }` |
| **Behavior** | re-validates the OTP, hashes `newPassword` with the WordPress hash (same scheme login verifies against), saves, deletes the OTP. |

**Error body shape:** the backend error middleware serializes to `{ success: false, message }`
keyed off the HTTP status (`error.middleware.js:19-22`; the login service already reads
`error.response?.data?.message`). The service keys its typed error codes off the HTTP
**status**, using the server `message` only as a human-string fallback.

**Note — verify-otp is advisory.** `reset` re-validates the OTP independently, so step 2
is a UX gate (fail fast before the user types a password), not a security dependency.

---

## User flow — three steps, one route

New route **`app/(auth)/forgot-password.tsx`** holds `step: 'email' | 'otp' | 'password'`
in local state and carries `email` + the verified `otp` in state (no params passed *between the wizard's own steps* — the only route param anywhere is the `email` handed to `login` on success, for pre-fill).
`(auth)/_layout.tsx` is a file-based `<Stack>`, so adding the file auto-registers the route.

### Step 1 — Email
- Header: "Reset your password" + subtitle "Enter your account email and we'll send a 6-digit code."
- One email field (zod email validation), primary **"Send code"** button (spinner while pending).
- On `send-otp` 200 → store `email`, go to `step:'otp'`, toast "Code sent."
- On **404** → inline field error + toast: **"No account found with that email."**
- On network error → toast "Network error — check your connection." (state preserved)

### Step 2 — Enter code
- Header: "Enter the code" + hint with masked email ("Sent to `a***@company.com`").
- **`OtpInput`** — 6-digit segmented input (see Components). Auto-advances; supports paste and iOS SMS-autofill (`textContentType="oneTimeCode"`, `autoComplete="sms-otp"` / `"one-time-code"`).
- **Countdown 10:00** — **advisory only**. Do NOT hard-disable Verify at 0:00: client/server clock drift or a backgrounded app can make a still-valid code un-submittable. Keep Verify tappable and let the **server's 400** be the authority; at 0:00 just show a "code may have expired — resend" hint.
- **"Resend code"** — disabled for a **30s** cooldown after each send; re-calls `send-otp`, resets timer, toast "New code sent." A short hint tells the user to enter the **most recent** code — a resend invalidates the previous one (`otpService.js:18` deletes before insert).
- Primary **"Verify"** button (enabled at 6 digits) → `verify-otp`.
  - `{verified:true}` → store `otp`, go to `step:'password'`.
  - **400** → inline error "Invalid or expired code. Request a new one." + clear the input.
- Back → returns to `step:'email'` (does not leave the flow).

### Step 3 — New password
- Header: "Set a new password."
- **New password** + **Confirm password** fields, each with a show/hide eye (reuse the login screen's eye pattern).
- Validation (zod): min **8** chars; the two must match. (Backend enforces nothing; the app owns the policy. 8 is a reasonable floor; adjust if a signup policy is later standardized.)
- Primary **"Reset password"** → `reset` with `{ email, otp, newPassword }`.
  - **200** → success toast "Password updated — sign in with your new password." → `router.replace({ pathname: '/(auth)/login', params: { email } })` so the email is **pre-filled** on return (login reads the param into its form default; saves a retype).
  - **400** (OTP expired between steps) → toast + jump back to `step:'otp'` to re-request.
- Back → returns to `step:'otp'`.

### Login screen change
In [app/(auth)/login.tsx](../app/(auth)/login.tsx), the "Forgot?" `Pressable` `onPress`
changes from `openInAppBrowser(withLang(FORGOT_PASSWORD_URL, …))` to
`router.push('/(auth)/forgot-password')`. The now-unused `FORGOT_PASSWORD_URL` and its
`openInAppBrowser` call are removed (the `withLang` helper + `CONTACT_URL` stay — still
used by the "Request an account" link).

---

## Components & files

**New**
- `src/services/auth/passwordReset.ts` — three typed async functions + `ResetError`:
  - `sendResetOtp(email: string): Promise<void>` → `POST /user/forgot-password/send-otp` (no per-call header — the `greenbidz` client already carries `x-platform: LabGreenbidz`).
  - `verifyResetOtp(email, otp): Promise<void>` (throws `ResetError('INVALID_OTP')` on 400).
  - `resetPassword(email, otp, newPassword): Promise<void>`.
  - Error mapping: 400→`INVALID_OTP`, 404→`NO_ACCOUNT`, no-response→`NETWORK`, else→`UNKNOWN`.
- `src/features/auth/useForgotPassword.ts` — hook owning `step`, `email`, `otp`, per-step
  `isPending`/`error`, the resend cooldown + expiry countdown timers, and the three
  transition actions (`submitEmail`, `submitOtp`, `submitNewPassword`, `resend`). Screen stays presentational.
- `src/components/ui/OtpInput.tsx` — controlled 6-digit segmented input: one hidden/borderless
  `TextInput` (numeric, `maxLength=6`) backing six styled cells; exposes `value`/`onChange`/`onComplete`;
  autofocus; paste-aware; OTP-autofill attributes. Reusable (also usable by the signup verify flow later).
- `app/(auth)/forgot-password.tsx` — the wizard screen; renders one of three step views by `step`;
  Stitch styling matching login; Android hardware-back steps backward (and exits to login from step 1).

**Modified**
- `app/(auth)/login.tsx` — three changes: (1) repoint "Forgot?" to the native route; (2) drop `FORGOT_PASSWORD_URL` + its browser call; (3) **read an optional `email` route param** (`useLocalSearchParams`) and seed it into the form default so a completed reset pre-fills the field — today the form is `defaultValues: { email: '', password: '' }` (`login.tsx:83`) and reads no params, so without this the Step 3 pre-fill (above) is a no-op.
- `src/i18n/locales/en.json` — add the `mobile.auth.reset.*` block (below).

**No change:** `(auth)/_layout.tsx` (file-based route auto-registers); `_layout.tsx` AuthGuard
(logged-out users already live in the `(auth)` group).

---

## Data flow

```
Step1  email ──sendResetOtp──▶ POST /user/forgot-password/send-otp {email}  (client default x-platform)
                              ◀── 200 {message}                     (or 404 → NO_ACCOUNT)
Step2  email+otp ─verifyResetOtp▶ POST /verify-otp {email,otp}
                              ◀── 200 {verified:true}               (or 400 → INVALID_OTP)
Step3  email+otp+newPassword ─resetPassword▶ POST /reset {email,otp,newPassword}
                              ◀── 200 {message}  → router.replace('/(auth)/login', params:{email})  // email pre-filled
```

State lives in `useForgotPassword`; nothing is persisted to MMKV/secure-store (a reset is
ephemeral and must not survive an app kill).

---

## Error handling matrix

| Situation | HTTP | Code | User sees |
|---|---|---|---|
| Email not registered | 404 (send-otp) | `NO_ACCOUNT` | Inline + toast: "No account found with that email." |
| Wrong / expired code | 400 (verify) | `INVALID_OTP` | Inline: "Invalid or expired code. Request a new one." + clear input |
| Code expired between step 2 and 3 | 400 (reset) | `INVALID_OTP` | Toast + jump back to Step 2 |
| Passwords don't match / <8 | — (client) | — | Inline field error; submit disabled |
| Offline / server down | no response | `NETWORK` | Toast: "Network error — check your connection." State preserved. |
| Unexpected | other | `UNKNOWN` | Toast with server `message` fallback |

**Interceptor note:** `greenbidz`'s response interceptor logs out on **401** — these endpoints
return **400/404**, never 401, so the reset flow can't trigger an accidental logout.

---

## Edge cases

- **Resend spam:** the backend has no rate-limit; the client enforces a 30s resend cooldown (button disabled + countdown).
- **Expiry:** 10:00 countdown mirrors the backend's 10-minute window but is **advisory** (see Step 2) — at 0:00, keep Verify tappable and just show a "may have expired — resend" hint; the server's 400 is the authority.
- **Android back:** steps backward within the flow; from Step 1, exits to Login.
- **Email casing/whitespace:** **do NOT lowercase.** The lookup is exact-match on `user_email` (`otpService.js:10`), and login sends the email as-typed — `loginSchema` only validates it (no trim, no lowercase) and `login.ts:52` posts it verbatim. Lowercasing here could turn a valid `John@Co.com` into a false 404 on a case-sensitive collation. A defensive `.trim()` is fine (whitespace is never part of a real address); casing must be preserved to stay consistent with login.
- **Keyboard:** `KeyboardAvoidingView` (login already uses the pattern) so inputs aren't covered.

---

## i18n keys (add to `en.json` under `mobile.auth`)

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

### Chinese translations (in-scope deliverable — draft, native proofread before ship)

Add the same key set to `zh-Hant.json` and `zh-Hans.json` under `mobile.auth.reset`:

| key | zh-Hant (Traditional) | zh-Hans (Simplified) |
|---|---|---|
| emailTitle | 重設您的密碼 | 重置您的密码 |
| emailSubtitle | 輸入您的帳戶電子郵件，我們會寄送 6 位數驗證碼。 | 输入您的账户电子邮件，我们会发送 6 位数验证码。 |
| emailLabel | 電子郵件 | 电子邮件 |
| sendCode | 傳送驗證碼 | 发送验证码 |
| codeSent | 驗證碼已寄出，請查看您的電子郵件。 | 验证码已发送，请查看您的电子邮件。 |
| noAccount | 找不到使用此電子郵件的帳戶。 | 找不到使用此电子邮件的账户。 |
| otpTitle | 輸入驗證碼 | 输入验证码 |
| otpSubtitle | 我們已將 6 位數驗證碼寄至 {{email}}。 | 我们已将 6 位数验证码发送至 {{email}}。 |
| verify | 驗證 | 验证 |
| resend | 重新傳送驗證碼 | 重新发送验证码 |
| resendIn | {{seconds}} 秒後可重新傳送 | {{seconds}} 秒后可重新发送 |
| useRecentCode | 請輸入我們最近寄送的驗證碼。 | 请输入我们最近发送的验证码。 |
| codeExpired | 驗證碼可能已過期，請重新取得。 | 验证码可能已过期，请重新获取。 |
| invalidCode | 驗證碼無效或已過期，請重新取得。 | 验证码无效或已过期，请重新获取。 |
| newCodeSent | 已傳送新的驗證碼。 | 已发送新的验证码。 |
| passwordTitle | 設定新密碼 | 设置新密码 |
| newPassword | 新密碼 | 新密码 |
| confirmPassword | 確認密碼 | 确认密码 |
| passwordTooShort | 請至少使用 8 個字元。 | 请至少使用 8 个字符。 |
| passwordMismatch | 兩次輸入的密碼不一致。 | 两次输入的密码不一致。 |
| resetPassword | 重設密碼 | 重置密码 |
| resetSuccess | 密碼已更新，請使用新密碼登入。 | 密码已更新，请使用新密码登录。 |
| networkError | 網路錯誤，請檢查您的連線。 | 网络错误，请检查您的连接。 |

Also re-check the **mobile i18n zh gotcha** (lowercase locale codes, no `supportedLngs` drop) when adding these, so they don't silently fall back to English.

---

## Testing

**Unit (jest)**
- `passwordReset.ts`: each function maps 200 → resolve; 404 → `NO_ACCOUNT`; 400 → `INVALID_OTP`; no-response → `NETWORK`. Mock `greenbidz`; assert each function hits the right path with the right body. (`x-platform` is a **default on the shared client instance**, not a per-call arg, so it belongs to a `greenbidzClient` config test — don't assert it here.)
- `useForgotPassword.ts`: step machine — `submitEmail` success advances to `otp`; `submitOtp` success advances to `password`; a reset 400 bounces back to `otp`; resend cooldown blocks a second send within 30s.

**Render (characterization)**
- One snapshot per step (email / otp / password) confirming the right controls render and Verify is gated on 6 digits.

**Manual (emulator, real test email — against the DEV backend)**
- Point `GREENBIDZ_API_URL` at the dev API first (dev-first policy — do not reset real prod accounts).
- Full happy path with a real inbox; wrong code; expired code (wait >10 min or reuse an old code); unknown email → `NO_ACCOUNT`; offline behavior; resend then enter the *old* code (should fail with the "most recent code" hint).
- **Language check:** switch the app to 繁體中文 / 简体中文 and confirm all three screens render in Chinese (guards against the very fallback bug this feature exists to fix).

---

## Out of scope (documented, not built here)

- **Backend changes** of any kind (endpoints already exist).
- **Rate-limiting** on `send-otp` (backend concern; client cooldown is the interim guard).
- **Email-enumeration hardening.** `send-otp` returns **404** for unknown emails, which reveals
  whether an email is registered. This spec surfaces a clear "No account found" (better UX for a
  B2B app where accounts are team-approved). If enumeration becomes a concern, a future backend
  change would return **200** for all emails and the app would always advance to Step 2.
- **OTP brute-force cap.** `verify-otp` / `reset` look up `(email, otp)` with no attempt limit or
  lockout (`otpService.js`) — a 6-digit code is brute-forceable in principle. Backend concern (out
  of scope here); the existing `loginLimiter` in the codebase could be applied to
  `send-otp` / `verify-otp` cheaply later.
- **The web page's `?lang`** support (separate web task; the app already appends `?lang`).
- **Signup / registration** (tracked separately as issue #2).

## Risks / open items

- **Platform branding:** ✅ resolved — `SITE_TYPE=LabGreenbidz` → `labgreenbidz` → "101lab"
  (`brandingConfig.js:29-34`), and the `greenbidz` client already sends the header. No action needed.
- **Password policy:** min-8 is chosen here; align with a signup policy if one is standardized later.
- **Dev backend availability:** the routes are committed on the backend `dev` branch **and**
  `origin/main` (both confirmed via git), so prod and dev both carry them — no dev/main gap here.
  Before QA, just confirm the running **dev server deploy** is caught up to the `dev` branch commit
  (a deployed server can lag its branch in this codebase) and is reachable.
```
