/**
 * Seller onboarding — MOCK STATE. No network, by instruction.
 *
 * ⚠️ NOTHING HERE CALLS AN API, AND THAT IS DELIBERATE (owner, 2026-10-05):
 * "just make ui mock don't intregate api untill I give you permission". Every
 * value lives in component state and is thrown away on unmount. When the API
 * is wired, the three endpoints are `POST /user/signup-with-link-v2`,
 * `POST/GET /user/onboarding-details` and `PUT /user/settings` — see
 * `Docs/v2/authv2/00-introduction.md`.
 *
 * ⚠️ CATEGORIES ARE A FIXED LIST HERE, AND MUST NOT STAY THAT WAY. The real
 * taxonomy comes from `useLanguageAwareCategories()`, which fetches — so it is
 * excluded under the no-API instruction. The web flow's own source comments
 * that it replaced a hardcoded design list with real slugs precisely because
 * the stored value has to be a slug the rest of the system knows
 * (`SellerOnboarding.tsx:254-256`). These strings are placeholders for layout
 * only; do not let them reach a submit payload.
 *
 * ── THE SPINE IS BUILT, NOT FIXED ──
 *
 * `useOnboardingMock().steps` is derived, and the rail reads its length. The
 * app's own design system forbids a padded count: "Never 'Step 4 of 4' when the
 * draft does not have four steps… The count is exactly the steps that will
 * render, numbered contiguously from 1." A buyer renders none of these; a
 * seller renders what their answers actually require.
 */
import { useMemo, useState } from 'react';

export type Role = 'buyer' | 'seller';
export type SellerType = 'reseller' | 'company';
export type Volume = 'a' | 'b' | 'c';
export type Calibration = 'most' | 'some' | 'none';

/** Which wizard steps exist, in order. Derived — never a literal 5 or 6. */
export type StepKey =
  | 'sellerType'
  | 'business'
  | 'location'
  | 'categories'
  | 'volume'
  | 'calibration';

/**
 * ⚠️ `business` and `location` collect COMPANY NAME, TAX ID and a registered
 * address — the category App Review rejected this app for twice under
 * Guideline 3.1.1. They exist here only behind the `__DEV__` route and MUST NOT
 * be wired into a shipped flow until that question is answered. Read
 * `app/(lab)/sell/apply.tsx:12-48` before moving them.
 */
const SELLER_STEPS: readonly StepKey[] = [
  'sellerType',
  'business',
  'location',
  'categories',
  'volume',
  'calibration',
];

/* ── Validation, copied rule-for-rule from the web source ───────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PERSON_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
const PLACE_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.,'’()/-]*$/u;
const TAX_ID_RE = /^[A-Za-z0-9][A-Za-z0-9 ./-]{2,29}$/;
const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;
const TITLE_RE = /^[\p{L}\p{N}\s.,&'’/()-]+$/u;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

const validWebsite = (v: string): boolean => {
  if (/\s/.test(v)) return false;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    return (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      /^[^.]+(\.[^.]+)*\.[A-Za-z]{2,}$/.test(u.hostname)
    );
  } catch {
    return false;
  }
};

/**
 * ⚠️ VALIDATION RETURNS A KEY, NOT A SENTENCE.
 *
 * `validateField` is a plain module function — it has no `t`, and it runs
 * inside a `useMemo` that would freeze any string it built. Returning English
 * prose from here is exactly how a message stays English in all six languages
 * however well the screen above it is translated. So it returns the i18n key
 * plus its interpolation params, and the component that renders the field is
 * the one that calls `t`.
 *
 * The bounds (2, 120, 80 …) are passed as params rather than baked into the
 * copy: `{{min}}`/`{{max}}` named interpolation, NOT i18next `count` plurals.
 * `count` would need a `_one`/`_other` pair per key in all six files, and five
 * of the six languages have no plural forms at all — the pair is noise there
 * and a silent fallback hazard if one half is missed.
 */
export type ValidationMessage = { key: string; params?: Record<string, string | number> };

const V = 'mobile.auth.onboarding.validation.';
const msg = (k: string, params?: Record<string, string | number>): ValidationMessage => ({
  key: V + k,
  params,
});

/** `null` means valid. Rules are the web's, verbatim; only the copy is keyed. */
export function validateField(
  id: string,
  raw: string,
  isReseller: boolean,
): ValidationMessage | null {
  const v = (raw || '').trim();
  switch (id) {
    case 'bizName':
      if (!v) return msg(isReseller ? 'bizNameRequiredReseller' : 'bizNameRequiredCompany');
      if (v.length < 2) return msg('minChars', { min: 2 });
      if (v.length > 120) return msg('maxChars', { max: 120 });
      return HAS_LETTER_OR_DIGIT.test(v) ? null : msg('nameInvalid');
    case 'website':
      if (!v) return null;
      return validWebsite(v) ? null : msg('websiteInvalid');
    case 'taxId':
      if (!v) return msg('taxIdRequired');
      return TAX_ID_RE.test(v) ? null : msg('taxIdFormat');
    case 'bizRole':
      if (!v) return null;
      if (isReseller) return /^\d{1,2}$/.test(v) ? null : msg('yearsInvalid');
      if (v.length > 80) return msg('maxChars', { max: 80 });
      return TITLE_RE.test(v) ? null : msg('jobTitleInvalid');
    case 'street':
      if (!v) return msg('streetRequired');
      if (v.length < 5) return msg('streetTooShort');
      if (v.length > 150) return msg('maxChars', { max: 150 });
      return HAS_LETTER_OR_DIGIT.test(v) ? null : msg('streetInvalid');
    case 'city':
      if (!v) return msg('cityRequired');
      if (v.length < 2 || v.length > 80) return msg('cityLength', { min: 2, max: 80 });
      return PLACE_RE.test(v) ? null : msg('cityInvalid');
    case 'postal':
      if (!v) return msg('postalRequired');
      return POSTAL_RE.test(v) ? null : msg('postalFormat');
    case 'region':
      if (!v) return msg('regionRequired');
      if (v.length < 2 || v.length > 80) return msg('regionLength', { min: 2, max: 80 });
      return PLACE_RE.test(v) ? null : msg('regionInvalid');
    case 'country':
      return v ? null : msg('countryRequired');
    default:
      return null;
  }
}

/**
 * Account-screen rules, from the web's `acctErrors` (`SellerOnboarding.tsx:441-464`).
 *
 * ⚠️ The web's table in `02-account.md` listed ONE message per field; the source
 * has 13. All of them are here — an incomplete set is how a user hits a block
 * with no message.
 *
 * Note this screen collects email / name / phone / password ONLY. No company,
 * no tax ID, no business type, no certificate — that is the Guideline 3.1.1
 * category and it lives on the later steps, which stay `__DEV__`-gated.
 */
export const ACCOUNT_FIELDS = ['email', 'fullName', 'phone', 'password', 'confirmPassword'] as const;

export function validateAccountField(
  id: string,
  raw: string,
  password: string,
): ValidationMessage | null {
  const v = (raw || '').trim();
  switch (id) {
    case 'email':
      if (!v) return msg('emailRequired');
      if (v.length > 254 || !EMAIL_RE.test(v)) return msg('emailInvalid');
      return null;
    case 'fullName':
      if (!v) return msg('fullNameRequired');
      if (v.length < 2) return msg('fullNameTooShort');
      if (v.length > 100) return msg('maxChars', { max: 100 });
      return PERSON_NAME_RE.test(v) ? null : msg('fullNameInvalid');
    case 'phone':
      // The web uses libphonenumber's `isValidPhoneNumber`. Mobile has no phone
      // input component yet (`register.tsx` has no phone field at all), so this
      // is a deliberately weaker check — <VERIFY> before this ships.
      if (!v) return msg('phoneRequired');
      return /^[+]?[\d\s()-]{7,20}$/.test(v) ? null : msg('phoneInvalid');
    case 'password':
      if (!raw) return msg('passwordRequired');
      if (raw.length < 8) return msg('passwordTooShort', { min: 8 });
      if (raw.length > 72) return msg('passwordTooLong', { max: 72 });
      if (!/[A-Za-z]/.test(raw) || !/\d/.test(raw)) return msg('passwordWeak');
      return null;
    case 'confirmPassword':
      if (!raw) return msg('confirmRequired');
      return raw === password ? null : msg('confirmMismatch');
    default:
      return null;
  }
}

export const BUSINESS_FIELDS = ['bizName', 'website', 'taxId', 'bizRole', 'bizPhone'] as const;
export const LOCATION_FIELDS = ['street', 'city', 'postal', 'region', 'country'] as const;
/** Required set, shared by both field steps — `REQUIRED_FIELDS` on web. */
export const REQUIRED_FIELDS = ['bizName', 'taxId', 'street', 'city', 'postal', 'region', 'country'];

/**
 * Placeholder taxonomy — see the header. Shape matches the real hook's
 * `{ slug, name }` so swapping it in later is a one-line change.
 */
export const MOCK_CATEGORIES: readonly { slug: string; name: string }[] = [
  { slug: 'analytical-instruments', name: 'Analytical instruments' },
  { slug: 'life-science', name: 'Life science' },
  { slug: 'test-measurement', name: 'Test & measurement' },
  { slug: 'chromatography', name: 'Chromatography' },
  { slug: 'spectroscopy', name: 'Spectroscopy' },
  { slug: 'microscopy', name: 'Microscopy' },
  { slug: 'lab-furniture', name: 'Lab furniture' },
  { slug: 'centrifuges', name: 'Centrifuges' },
  { slug: 'sample-preparation', name: 'Sample preparation' },
  { slug: 'clean-room', name: 'Clean room' },
];

/**
 * The volume question is asked differently of a reseller and a company, and
 * **the stored value is the same `a` / `b` / `c` either way**. So `b` means
 * "25–100 items" for a reseller and "a lab clear-out" for a company: the value
 * is meaningless without `sellerType`. Kept identical to web on purpose — the
 * column is shared and the two clients must agree — but anything reading it
 * must read `sellerType` alongside.
 *
 * ⚠️ THESE CARRY KEYS, NOT SENTENCES. A module-level const array of translated
 * strings is built at IMPORT time — before i18next has resolved the stored
 * language — so it freezes on whatever was loaded first and never changes
 * again when the user switches language. The `value` stays a literal: it is
 * the stored column, shared with web, and translating it would corrupt the
 * saved answer.
 */
const O = 'mobile.auth.onboarding.';

export const VOLUME_OPTIONS: Record<
  SellerType,
  readonly { value: Volume; titleKey: string; descriptionKey: string }[]
> = {
  reseller: [
    { value: 'a', titleKey: `${O}volume.reseller.aTitle`, descriptionKey: `${O}volume.reseller.aDescription` },
    { value: 'b', titleKey: `${O}volume.reseller.bTitle`, descriptionKey: `${O}volume.reseller.bDescription` },
    { value: 'c', titleKey: `${O}volume.reseller.cTitle`, descriptionKey: `${O}volume.reseller.cDescription` },
  ],
  company: [
    { value: 'a', titleKey: `${O}volume.company.aTitle`, descriptionKey: `${O}volume.company.aDescription` },
    { value: 'b', titleKey: `${O}volume.company.bTitle`, descriptionKey: `${O}volume.company.bDescription` },
    { value: 'c', titleKey: `${O}volume.company.cTitle`, descriptionKey: `${O}volume.company.cDescription` },
  ],
};

export const CALIBRATION_OPTIONS: readonly {
  value: Calibration;
  titleKey: string;
  descriptionKey: string;
}[] = [
  { value: 'most', titleKey: `${O}calibration.mostTitle`, descriptionKey: `${O}calibration.mostDescription` },
  { value: 'some', titleKey: `${O}calibration.someTitle`, descriptionKey: `${O}calibration.someDescription` },
  { value: 'none', titleKey: `${O}calibration.noneTitle`, descriptionKey: `${O}calibration.noneDescription` },
];

export function useOnboardingMock() {
  const [role, setRole] = useState<Role | null>(null);
  /**
   * Whether the role screen's Continue has been pressed.
   *
   * ⚠️ Without this the wizard renders the moment a SELLER is selected, because
   * the old guard keyed off `steps.length` — which becomes non-empty on
   * selection, not on confirmation. The role screen's own Continue was dead for
   * sellers and live for buyers. Found on-device 2026-10-05; invisible in the
   * browser because the next tap happened to be Continue anyway.
   */
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  /** The account screen is done — an account exists (or would, live). */
  const [accountCreated, setAccountCreated] = useState(false);
  const [sellerType, setSellerType] = useState<SellerType | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  /** Free-text answers for the two field steps, keyed by field id. */
  const [values, setValues] = useState<Record<string, string>>({});
  /** A field shows its error once it has been left, not while first typing. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  /** Set by a failed Continue — then every error shows at once. */
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [volume, setVolume] = useState<Volume | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  /**
   * Seller Platform Terms acceptance. Gates the final submit.
   *
   * On web this sits on the account screen and gates "Agree and continue", so
   * the account cannot exist unaccepted. That screen is blocked here (3.1.1),
   * and the seller's real commitment point in this flow is "Submit for review"
   * — so the gate moves to the last step rather than being dropped. Buyers
   * never see it, same as web.
   *
   * ⚠️ When this is wired for real, record `SELLER_TERMS_VERSION` alongside the
   * boolean. The web posts `legal-documents/accept`; an acceptance with no
   * version against it is not evidence of anything.
   */
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  /** Buyers render no wizard at all, so the spine is empty for them. */
  const steps = useMemo<readonly StepKey[]>(
    () => (role === 'seller' ? SELLER_STEPS : []),
    [role],
  );

  const current = steps[index] ?? null;

  const isReseller = sellerType === 'reseller';

  /** Live errors for the fields on the step being shown. `''` = valid. */
  const fieldErrors = useMemo(() => {
    const ids =
      current === 'business'
        ? BUSINESS_FIELDS
        : current === 'location'
          ? LOCATION_FIELDS
          : [];
    const out: Record<string, ValidationMessage> = {};
    for (const id of ids) {
      const m = validateField(id, values[id] ?? '', isReseller);
      if (m) out[id] = m;
    }
    return out;
  }, [current, values, isReseller]);

  /** Per-step completeness. Drives the Continue button, nothing else. */
  const canAdvance = useMemo(() => {
    switch (current) {
      case 'sellerType':
        return sellerType !== null;
      case 'business':
      case 'location':
        return Object.keys(fieldErrors).length === 0;
      case 'categories':
        return categories.length > 0;
      case 'volume':
        return volume !== null;
      case 'calibration':
        // Both: the answer AND the terms. This is the submit.
        return calibration !== null && termsAccepted;
      default:
        return false;
    }
  }, [current, sellerType, categories, volume, calibration, termsAccepted, fieldErrors]);

  /** Account-screen errors, same touched/showAll rules as the wizard steps. */
  const accountErrors = useMemo(() => {
    const out: Record<string, ValidationMessage> = {};
    for (const id of ACCOUNT_FIELDS) {
      const m = validateAccountField(id, values[id] ?? '', values.password ?? '');
      if (m) out[id] = m;
    }
    return out;
  }, [values]);

  const accountValid = Object.keys(accountErrors).length === 0;

  const accountErrorFor = (id: string): ValidationMessage | undefined =>
    showAllErrors || touched[id] ? accountErrors[id] : undefined;

  const setValue = (id: string, v: string) => setValues((p) => ({ ...p, [id]: v }));
  const touch = (id: string) => setTouched((p) => (p[id] ? p : { ...p, [id]: true }));
  /** Visible only once the field has been left, or after a failed Continue. */
  const errorFor = (id: string): ValidationMessage | undefined =>
    showAllErrors || touched[id] ? fieldErrors[id] : undefined;

  const toggleCategory = (slug: string) =>
    setCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  /** Refuses to advance while the step has errors, and reveals them all. */
  const next = () => {
    if (!canAdvance) {
      setShowAllErrors(true);
      return;
    }
    setShowAllErrors(false);
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else setDone(true);
  };

  /** Returns false when there is nowhere further back — the caller leaves. */
  const back = (): boolean => {
    if (index > 0) {
      setIndex((i) => i - 1);
      return true;
    }
    return false;
  };

  /**
   * Re-seed the wizard from what the server already has — see `resume.ts`.
   *
   * Sets `role`/`roleConfirmed`/`accountCreated` together because all three are
   * implied by the snapshot existing at all: an onboarding row only exists for
   * a seller whose account was created. Seeding `roleConfirmed` without `role`
   * produced an empty step spine and a blank screen once before, so they move
   * as one.
   *
   * `values` MERGES over whatever is on screen rather than replacing it: a
   * resume can race a keystroke, and the person's own typing must win.
   */
  const restore = (s: {
    sellerType: SellerType | null;
    volume: Volume | null;
    calibration: Calibration | null;
    categories: string[];
    values: Record<string, string>;
    index: number;
  }) => {
    setRole('seller');
    setRoleConfirmed(true);
    setAccountCreated(true);
    setSellerType(s.sellerType);
    setVolume(s.volume);
    setCalibration(s.calibration);
    setCategories(s.categories);
    setValues((prev) => ({ ...s.values, ...prev }));
    setTouched({});
    setShowAllErrors(false);
    setIndex(Math.max(0, Math.min(s.index, SELLER_STEPS.length - 1)));
    setDone(false);
  };

  const reset = () => {
    setRole(null);
    setRoleConfirmed(false);
    setAccountCreated(false);
    setSellerType(null);
    setCategories([]);
    setValues({});
    setTouched({});
    setShowAllErrors(false);
    setVolume(null);
    setCalibration(null);
    setTermsAccepted(false);
    setIndex(0);
    setDone(false);
  };

  return {
    role,
    setRole,
    roleConfirmed,
    confirmRole: () => setRoleConfirmed(true),
    accountCreated,
    setAccountCreated,
    accountValid,
    accountErrorFor,
    revealErrors: () => setShowAllErrors(true),
    sellerType,
    setSellerType,
    isReseller,
    categories,
    toggleCategory,
    values,
    setValue,
    touch,
    errorFor,
    volume,
    setVolume,
    calibration,
    setCalibration,
    termsAccepted,
    toggleTerms: () => setTermsAccepted((v) => !v),
    acceptTerms: () => setTermsAccepted(true),
    steps,
    index,
    current,
    canAdvance,
    done,
    setDone,
    next,
    back,
    restore,
    reset,
  };
}
