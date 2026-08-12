import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
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
    confirmPassword: z.string(),
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

export const registerProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'mobile.auth.register.firstNameRequired'),
  lastName: z.string().trim().min(1, 'mobile.auth.register.lastNameRequired'),
  phone: z.string().trim().optional(),
  // ⚠️ Company MUST stay optional. A required company field turns this screen
  // into business/organization registration, which is what App Review rejected
  // build 14 for under Guideline 3.1.1.
  company: z.string().trim().optional(),
  country: z.string().trim().optional(),
});
export type RegisterProfileInput = z.infer<typeof registerProfileSchema>;
