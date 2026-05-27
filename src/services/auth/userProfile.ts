import { greenbidz } from '@/api/greenbidzClient';
import { getSiteType } from '@/services/scanner/buildFormData';

// Mirrors 101lab-2/src/rtk/slices/apiSlice.ts → getUserProfile + updateUserSettings.
// Web sends `?userId=<id>&type=<siteType>` and accepts a JSON body of any subset
// of editable fields. Both endpoints return `{ success, message, data? }`.

export type UserAddress = {
  street: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
};

export type UserDocuments = {
  wasteDisposalPermit: string[] | null;
  businessRegCertificate: string[] | null;
};

export type LanguageRegion = {
  language: string;
  timezone: string;
  currency: string;
};

export type UserPersonalInfo = {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  companyTaxIdNumber: string | null;
  industry: string;
  interests: string[];
  address: UserAddress | null;
};

export type UserProfile = {
  userId: number;
  email: string;
  displayName: string;
  personalInfo: UserPersonalInfo;
  languageRegion: LanguageRegion;
  documents: UserDocuments | null;
};

export type UpdateUserSettingsPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyTaxIdNumber?: string | null;
  industry?: string;
  interests?: string[];
  address?: UserAddress;
  currentPassword?: string;
  newPassword?: string;
  language?: string;
  timezone?: string;
  currency?: string;
};

type RawResponse = {
  success: boolean;
  message?: string;
  data?: Partial<{
    email: string;
    displayName: string;
    personalInfo: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      company: string;
      companyTaxIdNumber: string | null;
      industry: string;
      interests: unknown[];
      address: Partial<UserAddress>;
    }>;
    languageRegion: Partial<LanguageRegion>;
    documents: Partial<UserDocuments>;
  }>;
};

function normalize(raw: RawResponse['data'], userId: number): UserProfile {
  const personal = raw?.personalInfo ?? {};
  const lang = raw?.languageRegion ?? {};
  const docs = raw?.documents ?? null;

  return {
    userId,
    email: raw?.email ?? '',
    displayName: raw?.displayName ?? '',
    personalInfo: {
      firstName: personal.firstName ?? raw?.displayName ?? '',
      lastName: personal.lastName ?? '',
      phone: personal.phone ?? '',
      company: personal.company ?? '',
      companyTaxIdNumber: personal.companyTaxIdNumber ?? null,
      industry: personal.industry ?? '',
      interests: Array.isArray(personal.interests)
        ? (personal.interests.filter((i) => typeof i === 'string') as string[])
        : [],
      address: personal.address
        ? {
            street: personal.address.street ?? '',
            city: personal.address.city ?? '',
            district: personal.address.district ?? '',
            postalCode: personal.address.postalCode ?? '',
            country: personal.address.country ?? '',
          }
        : null,
    },
    languageRegion: {
      language: lang.language ?? 'en',
      timezone: lang.timezone ?? 'Asia/Taipei',
      currency: lang.currency ?? 'USD',
    },
    documents: docs
      ? {
          wasteDisposalPermit: docs.wasteDisposalPermit ?? null,
          businessRegCertificate: docs.businessRegCertificate ?? null,
        }
      : null,
  };
}

export async function fetchUserProfile(userId: number): Promise<UserProfile> {
  const siteType = getSiteType();
  const res = await greenbidz.get<RawResponse>('/user/profile', {
    params: { userId, type: siteType },
  });
  if (!res.data?.success) {
    throw new Error(res.data?.message ?? 'Could not load profile');
  }
  return normalize(res.data.data, userId);
}

export async function updateUserSettings(
  userId: number,
  payload: UpdateUserSettingsPayload,
): Promise<void> {
  const siteType = getSiteType();
  const res = await greenbidz.put<RawResponse>('/user/settings', payload, {
    params: { userId, type: siteType },
  });
  if (!res.data?.success) {
    throw new Error(res.data?.message ?? 'Could not save changes');
  }
}
