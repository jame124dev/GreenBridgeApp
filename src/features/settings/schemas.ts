import { z } from 'zod';

export const profileInfoSchema = z.object({
  firstName:     z.string().min(1, 'First name is required'),
  phone:         z.string(),
  company:       z.string(),
  industry:      z.string(),
  industryOther: z.string(),
  interests:     z.array(z.string()),
});

export const addressSchema = z.object({
  street:     z.string(),
  city:       z.string(),
  district:   z.string(),
  postalCode: z.string(),
  country:    z.string(),
});

export const securitySchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword:     z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const languageRegionSchema = z.object({
  language: z.string(),
  timezone: z.string(),
  currency: z.string(),
});

export type ProfileInfoValues    = z.infer<typeof profileInfoSchema>;
export type AddressValues        = z.infer<typeof addressSchema>;
export type SecurityValues       = z.infer<typeof securitySchema>;
export type LanguageRegionValues = z.infer<typeof languageRegionSchema>;
