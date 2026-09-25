import { z } from 'zod';

/**
 * ⚠️ These are i18n KEYS, like every other schema in this file — they used to
 * be raw English (`'Enter a valid email'`, `'Password is required'`) and were
 * rendered verbatim, so the one screen every non-English user meets FIRST
 * validated at them in English. The screens run these through `t()`.
 *
 * `emailRequired` is separate from `emailInvalid` on purpose: zod's `.email()`
 * rejects `''` too, so a single message told someone who had typed nothing that
 * their address was malformed.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'mobile.auth.emailRequired')
    .email('mobile.auth.emailInvalid'),
  password: z.string().min(1, 'mobile.auth.passwordRequired'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const resetEmailSchema = z.object({
  email: z.string().email('mobile.auth.reset.emailInvalid'),
});
export type ResetEmailInput = z.infer<typeof resetEmailSchema>;

export const newPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'mobile.auth.reset.passwordTooShort'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'mobile.auth.reset.passwordMismatch',
    path: ['confirmPassword'],
  });
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

// ─── Registration (native, in-app) ──────────────────────────────────────────
// Messages are i18n KEYS, resolved by the screen — same convention as the reset
// schemas above. Split per step so each step validates only its own fields.

export const registerCredentialsSchema = z
  .object({
    email: z.string().email('mobile.auth.register.emailInvalid'),
    // One free-text name, split into first/last for the API. The signup form is
    // deliberately three fields — asking for company details up front is what
    // reads as business/organization registration (Guideline 3.1.1).
    name: z.string().trim().min(1, 'mobile.auth.register.nameRequired'),
    // Matches the reset flow's floor; the API itself imposes no minimum, so
    // this is the only place a weak password is caught.
    password: z.string().min(8, 'mobile.auth.register.passwordTooShort'),
    // ⚠️ `.min(1)` IS LOad-BEARING. Without it this was `z.string()`, and the
    // `.refine` below compares two values — so on an EMPTY form `'' === ''`
    // passed and Confirm password was the only one of four fields with no error
    // under it. Seen on device 2026-09-22: three red fields and a fourth that
    // looked fine and was not. A rule that validates a relationship still needs
    // each side to exist.
    confirmPassword: z.string().min(1, 'mobile.auth.register.confirmRequired'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'mobile.auth.register.passwordMismatch',
    path: ['confirmPassword'],
  });
export type RegisterCredentialsInput = z.infer<typeof registerCredentialsSchema>;

export const registerCodeSchema = z.object({
  // The server generates exactly 6 digits.
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'mobile.auth.register.codeInvalid'),
});
export type RegisterCodeInput = z.infer<typeof registerCodeSchema>;

// ⛔ `registerProfileSchema` (firstName/lastName/phone/**company**/country) was
// DELETED 2026-08-20. It had no consumer anywhere in the app — signup validates
// through `registerCredentialsSchema` above and never rendered these fields — so
// the only thing it did was keep a `company` key in a schema named "register",
// in a codebase whose iOS build has now been rejected TWICE under Guideline
// 3.1.1 for "account registration for businesses and organizations". Dead code
// that contradicts the compliance position is a liability, not a spare part.
// A signup step that collects company details must not come back; see the note
// at the top of `app/(lab)/sell/apply.tsx`.
//
// Editing `company` on an EXISTING profile is untouched and stays
// (`src/features/settings/components/ProfileInfoCard.tsx`) — that is account
// management for a customer who already has an account, not registration.
