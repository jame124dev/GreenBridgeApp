/**
 * Resuming a half-finished onboarding — the step ladder and the prefill.
 *
 * The landing step MUST agree with the web's, because the same account can
 * leave on one surface and come back on the other. If they disagree, a seller
 * who answered three steps on the web reopens the app at step 1 and is asked
 * everything again (or worse, is dropped past a step they never answered).
 * These cases are transcribed from `SellerOnboarding.tsx:402-407`.
 *
 * The two endpoints are tested as independently failing, because that is how
 * `loadProgress` calls them: steps 2–4 live entirely in `/user/profile`, so a
 * profile outage must not silently mean "they answered nothing".
 */
import { describe, it, expect } from '@jest/globals';

import { buildResumeSnapshot, resumeIndex } from '../resume';
import type { OnboardingDetails } from '@/services/onboarding/sellerOnboarding';
import type { UserProfile } from '@/services/auth/userProfile';

const details = (over: Partial<OnboardingDetails> = {}): OnboardingDetails => ({
  sellerType: null,
  monthlyVolume: null,
  onboardingCompleted: false,
  website: null,
  bizRole: null,
  bizPhone: null,
  calibration: null,
  ...over,
});

const profile = (over: Partial<UserProfile['personalInfo']> = {}): UserProfile =>
  ({
    userId: 1200,
    email: 'a@b.com',
    displayName: 'A',
    personalInfo: {
      firstName: 'A',
      lastName: 'B',
      phone: '',
      company: '',
      companyTaxIdNumber: null,
      industry: '',
      interests: [],
      address: null,
      ...over,
    },
    languageRegion: { language: 'en', timezone: '', currency: '' },
    documents: null,
  }) as UserProfile;

const FULL_ADDRESS = {
  street: '1 Road',
  city: 'Taipei',
  district: 'Da-an',
  postalCode: '106',
  country: 'Taiwan',
};

describe('resumeIndex — the ladder', () => {
  const base = { sellerType: null, volume: null, calibration: null, categories: [], values: {} };

  it('0 — nothing answered', () => {
    expect(resumeIndex(base)).toBe(0);
  });

  it('1 — seller type only', () => {
    expect(resumeIndex({ ...base, sellerType: 'reseller' })).toBe(1);
  });

  it('1 — business name without a tax id is still incomplete', () => {
    expect(
      resumeIndex({ ...base, sellerType: 'reseller', values: { bizName: 'Acme' } }),
    ).toBe(1);
  });

  it('2 — business done, address missing', () => {
    expect(
      resumeIndex({
        ...base,
        sellerType: 'reseller',
        values: { bizName: 'Acme', taxId: 'T1' },
      }),
    ).toBe(2);
  });

  it('2 — a PARTIAL address does not count as answered', () => {
    // Every one of the five is required; the web checks all five individually.
    expect(
      resumeIndex({
        ...base,
        sellerType: 'reseller',
        values: { bizName: 'Acme', taxId: 'T1', street: '1 Road', city: 'Taipei' },
      }),
    ).toBe(2);
  });

  it('3 — address done, no categories', () => {
    expect(
      resumeIndex({
        ...base,
        sellerType: 'reseller',
        values: {
          bizName: 'Acme',
          taxId: 'T1',
          street: '1 Road',
          city: 'Taipei',
          region: 'Da-an',
          postal: '106',
          country: 'Taiwan',
        },
      }),
    ).toBe(3);
  });

  it('4 — categories done, no volume', () => {
    expect(
      resumeIndex({
        ...base,
        sellerType: 'reseller',
        categories: ['analytical'],
        values: {
          bizName: 'Acme',
          taxId: 'T1',
          street: '1 Road',
          city: 'Taipei',
          region: 'Da-an',
          postal: '106',
          country: 'Taiwan',
        },
      }),
    ).toBe(4);
  });

  it('5 — everything the server stores is answered', () => {
    expect(
      resumeIndex({
        ...base,
        sellerType: 'reseller',
        categories: ['analytical'],
        volume: 'b',
        values: {
          bizName: 'Acme',
          taxId: 'T1',
          street: '1 Road',
          city: 'Taipei',
          region: 'Da-an',
          postal: '106',
          country: 'Taiwan',
        },
      }),
    ).toBe(5);
  });

  it('never exceeds the last step', () => {
    // Calibration has no backend column, so it is the terminus — the ladder
    // must not run off the end of SELLER_STEPS into an empty render.
    expect(
      resumeIndex({
        ...base,
        sellerType: 'company',
        categories: ['x'],
        volume: 'c',
        calibration: 'none',
        values: {
          bizName: 'A',
          taxId: 'T',
          street: 's',
          city: 'c',
          region: 'r',
          postal: 'p',
          country: 'co',
        },
      }),
    ).toBe(5);
  });
});

describe('buildResumeSnapshot — prefill', () => {
  it('maps the real staging shape: sellerType saved, nothing else', () => {
    // Exactly what `GET /user/onboarding-details?userId=1200` returned for the
    // account the mobile app created on 2026-10-06.
    const s = buildResumeSnapshot(details({ sellerType: 'reseller' }), profile());
    expect(s.sellerType).toBe('reseller');
    expect(s.index).toBe(1);
    expect(s.categories).toEqual([]);
  });

  it('maps profile fields onto the wizard field ids', () => {
    const s = buildResumeSnapshot(
      details({ website: 'acme.com', bizRole: '10', bizPhone: '+886 1' }),
      profile({ company: 'Acme', companyTaxIdNumber: 'T1', address: FULL_ADDRESS }),
    );
    expect(s.values).toMatchObject({
      bizName: 'Acme',
      taxId: 'T1',
      street: '1 Road',
      city: 'Taipei',
      // `district` on the profile is `region` in the wizard — an easy silent swap.
      region: 'Da-an',
      postal: '106',
      country: 'Taiwan',
      website: 'acme.com',
      bizRole: '10',
      bizPhone: '+886 1',
    });
  });

  it('accepts interests as slugs OR as objects', () => {
    const asObjects = buildResumeSnapshot(
      details(),
      profile({ interests: [{ slug: 'analytical' }, { slug: 'microscopy' }] as never }),
    );
    const asStrings = buildResumeSnapshot(
      details(),
      profile({ interests: ['analytical', 'microscopy'] }),
    );
    expect(asObjects.categories).toEqual(['analytical', 'microscopy']);
    expect(asStrings.categories).toEqual(asObjects.categories);
  });

  it('drops empty and malformed values rather than prefilling blanks', () => {
    const s = buildResumeSnapshot(
      details({ website: '   ' }),
      profile({ company: '', interests: [null, '', { nope: 1 }] as never }),
    );
    expect(s.values.website).toBeUndefined();
    expect(s.values.bizName).toBeUndefined();
    expect(s.categories).toEqual([]);
  });

  it('refuses a stored value the wizard does not offer', () => {
    // These columns are free text shared with the web. A value none of the
    // radios match would render an unanswered-looking step that still reports
    // itself complete, so anything unrecognised must resolve to null.
    const s = buildResumeSnapshot(
      details({
        sellerType: 'wholesaler' as never,
        monthlyVolume: 'loads' as never,
        calibration: 'maybe' as never,
      }),
      profile(),
    );
    expect(s.sellerType).toBeNull();
    expect(s.volume).toBeNull();
    expect(s.calibration).toBeNull();
    expect(s.index).toBe(0);
  });

  it('survives the profile request failing on its own', () => {
    // Steps 2-4 live in the profile, so losing it must send the seller back to
    // business — not skip past steps it cannot confirm.
    const s = buildResumeSnapshot(details({ sellerType: 'company', monthlyVolume: 'a' }), null);
    expect(s.sellerType).toBe('company');
    expect(s.index).toBe(1);
  });

  it('survives the onboarding-details request failing on its own', () => {
    const s = buildResumeSnapshot(
      null,
      profile({ company: 'Acme', companyTaxIdNumber: 'T1', address: FULL_ADDRESS }),
    );
    expect(s.values.bizName).toBe('Acme');
    expect(s.sellerType).toBeNull();
    expect(s.index).toBe(0);
  });
});
