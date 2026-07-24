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
