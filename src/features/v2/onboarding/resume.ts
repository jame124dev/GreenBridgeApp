/**
 * Resuming a half-finished seller onboarding.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The account is created at the END OF THE FIRST SCREEN, not at the end of the
 * wizard. So from that moment there is a real, `pending` seller on the server
 * whose profile is incomplete — and until this module existed, mobile had no
 * way back in: the flow kept its answers in React state only, so a background
 * kill, a crash, or simply leaving stranded the person with an account they
 * could not finish and a wizard that always restarted at "I'm a buyer / I'm a
 * seller".
 *
 * Web has had this since the beginning: the seller dashboard's "Complete your
 * profile" banner links to `/auth2?resume=1`, which refills every field and
 * opens at the first unfinished step. Signing the mobile-created account in on
 * staging-lab on 2026-10-06 landed exactly there, which is what showed mobile
 * was missing it.
 *
 * ── THE SHAPE OF THE ANSWER IS SPLIT ACROSS TWO ENDPOINTS ──────────────────
 *
 * Deliberately mirrored from the web rather than invented, because the landing
 * step has to agree across surfaces or the two will disagree about how far
 * someone got:
 *
 *   · `GET /user/onboarding-details?userId=` — sellerType, monthlyVolume,
 *     calibration, website, bizRole, bizPhone.
 *     ⚠️ The query param is `userId`; the matching POST takes `user_id` in the
 *     BODY. They genuinely differ — do not "fix" one to match the other.
 *   · `GET /user/profile?userId=&type=` — company, tax id, address, interests.
 *
 * Neither alone can place the seller: steps 2–4 live entirely in the profile.
 *
 * Reference: `SellerOnboarding.tsx:369-408` in the web app (the `?resume=1`
 * effect). The cascade below is a transcription of its `screenKey` ladder, with
 * its screen keys 1–6 mapped onto `SELLER_STEPS` indices 0–5.
 */
import type { OnboardingDetails } from '@/services/onboarding/sellerOnboarding';
import type { UserProfile } from '@/services/auth/userProfile';
import type { Calibration, SellerType, Volume } from './mockState';

/** Everything the wizard can be re-seeded with. */
export type ResumeSnapshot = {
  sellerType: SellerType | null;
  volume: Volume | null;
  calibration: Calibration | null;
  categories: string[];
  /** Keyed by the same field ids the wizard uses (`bizName`, `street`, …). */
  values: Record<string, string>;
  /** Index into `SELLER_STEPS` — the first step still unanswered. */
  index: number;
};

/*
 * ⚠️ Every stored value is validated against the set the wizard actually
 * offers, never cast. These columns are free-form text shared with the web, so
 * an unrecognised string is entirely possible — and a bad cast would hand the
 * radio group a value none of its options match, rendering a step that looks
 * unanswered but reports `canAdvance`. Anything unknown resolves to `null`,
 * which makes the ladder re-ask that step: the safe direction.
 */
const SELLER_TYPES: readonly string[] = ['reseller', 'company'];
const VOLUMES: readonly string[] = ['a', 'b', 'c'];
const CALIBRATIONS: readonly string[] = ['most', 'some', 'none'];

/** `null` unless the stored string is one the wizard actually offers. */
function asSellerType(v: unknown): SellerType | null {
  return typeof v === 'string' && SELLER_TYPES.includes(v) ? (v as SellerType) : null;
}

function asVolume(v: unknown): Volume | null {
  return typeof v === 'string' && VOLUMES.includes(v) ? (v as Volume) : null;
}

function asCalibration(v: unknown): Calibration | null {
  return typeof v === 'string' && CALIBRATIONS.includes(v) ? (v as Calibration) : null;
}

/**
 * Interests arrive as either plain slugs or `{ slug }` objects depending on how
 * they were written — the web normalises both (`SellerOnboarding.tsx:384-386`)
 * and so must this, or a seller who picked categories on the web resumes on
 * mobile as though they had picked none.
 */
function asCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i) => (typeof i === 'string' ? i : ((i as { slug?: unknown })?.slug ?? null)))
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
}

/** Only non-empty strings are prefilled; `undefined` must not become "undefined". */
function put(into: Record<string, string>, key: string, v: unknown) {
  if (v === null || v === undefined) return;
  const s = String(v).trim();
  if (s) into[key] = s;
}

/**
 * Which step to open on.
 *
 * Reads as a ladder on purpose: each rung is the step whose answer is missing,
 * and the last rung means everything the server knows about is answered, so the
 * seller lands on calibration — the one step with no backend column of its own,
 * which is why it is the natural terminus rather than "done".
 */
export function resumeIndex(s: Omit<ResumeSnapshot, 'index'>): number {
  const v = s.values;
  if (!s.sellerType) return 0; // sellerType
  if (!v.bizName || !v.taxId) return 1; // business
  if (!v.street || !v.city || !v.postal || !v.region || !v.country) return 2; // location
  if (s.categories.length === 0) return 3; // categories
  if (!s.volume) return 4; // volume
  return 5; // calibration
}

/**
 * Fold both responses into one snapshot. Pure, so the ladder above can be
 * tested without a network or a React tree.
 *
 * Either side may be `null` — each request is independently best-effort, since
 * a resume that loses the address is far better than a resume that refuses to
 * open at all.
 */
export function buildResumeSnapshot(
  details: OnboardingDetails | null,
  profile: UserProfile | null,
): ResumeSnapshot {
  const pi = profile?.personalInfo;
  const addr = pi?.address ?? null;

  const values: Record<string, string> = {};
  put(values, 'bizName', pi?.company);
  put(values, 'taxId', pi?.companyTaxIdNumber);
  put(values, 'street', addr?.street);
  put(values, 'city', addr?.city);
  put(values, 'region', addr?.district);
  put(values, 'postal', addr?.postalCode);
  put(values, 'country', addr?.country);
  put(values, 'website', details?.website);
  put(values, 'bizRole', details?.bizRole);
  put(values, 'bizPhone', details?.bizPhone);

  const partial = {
    sellerType: asSellerType(details?.sellerType),
    volume: asVolume(details?.monthlyVolume),
    calibration: asCalibration(details?.calibration),
    categories: asCategories(pi?.interests),
    values,
  };

  return { ...partial, index: resumeIndex(partial) };
}
