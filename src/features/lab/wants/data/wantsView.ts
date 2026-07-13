// wantsView.ts — PURE display helpers for the "My Wants" dashboard (the mobile
// port of the web `101lab-2/src/components/ai/wtb.ts` + MyWants.tsx display
// logic). JSX-free so the mapping stays unit-testable; all colors reference
// `@/constants/theme` tokens (never literal hexes in the components).
//
// The dashboard groups the buyer's saved wants (WtbRequestSummary) and, per
// want, its matched products (WtbMatch). This module turns those wire shapes
// into the small view-models the WantCard / MatchProductCard render, and owns
// the score→percent→tier logic that colour-grades each match by relevance.
import { greenDarkest, greenMedium, warnAmber } from '@/constants/theme';
import { condLabel, countryLabel } from '@/features/lab/chat/cardKit';
import { priceLabel } from '@/features/lab/data/matchesFromApi';
import type {
  WtbMatch,
  WtbProductSnapshot,
  WtbRequestSummary,
} from '@/features/lab/data/wtbApi';

/* ── Notify cadence ───────────────────────────────────────────────────────── */

export type NotifyFrequency = 'instant' | 'daily' | 'off';
export const NOTIFY_FREQUENCIES: NotifyFrequency[] = ['instant', 'daily', 'off'];

/** Minimal i18n translator shape — kept local so this pure module needn't import
 *  react-i18next. Callers pass their `t`; omit it for the English fallback. */
type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** Friendly label for a want's notification cadence (display only). Pass `t` to
 *  translate (mobile.labWants.notify.*); omit for the English fallback. */
export function frequencyLabel(f?: string | null, t?: TFn): string {
  const key = f === 'daily' ? 'daily' : f === 'off' ? 'off' : 'instant';
  if (t) return t(`mobile.labWants.notify.${key}`);
  return f === 'daily' ? 'Daily digest' : f === 'off' ? 'Off' : 'Instant';
}

/** Friendly label for a want's lifecycle status (display only; no mutation).
 *  Pass `t` to translate (mobile.labWants.wantStatus.*); omit for English. */
export function statusLabel(status?: string | null, t?: TFn): string {
  const key =
    status === 'paused' ? 'paused' :
    status === 'fulfilled' ? 'fulfilled' :
    status === 'expired' ? 'expired' :
    status === 'deleted' ? 'deleted' : 'active';
  if (t) return t(`mobile.labWants.wantStatus.${key}`);
  switch (status) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'fulfilled':
      return 'Fulfilled';
    case 'expired':
      return 'Expired';
    case 'deleted':
      return 'Deleted';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active';
  }
}

/** Active = the only state where the want is alerting; drives the green dot. */
export function isActiveStatus(status?: string | null): boolean {
  return (status ?? 'active').toLowerCase() === 'active';
}

/** Format a want's created date. Null-safe: missing/invalid → '' (card omits it). */
export function formatWantDate(iso?: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  try {
    return new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/* ── Relevance score → percent → colour tier ──────────────────────────────────
 * Mirrors the web MyWants MatchCard: the badge shows the RAW hybrid relevance
 * score (`score`), NOT the boosted alert-eligibility score. Null/NaN/∞ → null
 * so the caller renders no badge. Sorting elsewhere uses `boosted_score`. */

export type MatchTier = 'strong' | 'good' | 'low';

/** RAW relevance `score` (0..1) → integer percent (0..100), clamped; null-safe. */
export function relevancePercent(m: WtbMatch | null | undefined): number | null {
  const raw = m?.score;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

export function tierOf(pct: number): MatchTier {
  return pct >= 80 ? 'strong' : pct >= 50 ? 'good' : 'low';
}

/** Low tier neutrals — the foundation has no slate token, so name them here. */
const LOW_TEXT = '#64748B';
const LOW_BAR = '#94A3B8';
const STRONG_BG = '#EAF6EE';
const GOOD_BG = '#FBF1DD';
const LOW_BG = '#F1F5F9';

export interface TierStyle {
  text: string;
  bar: string;
  chipBg: string;
}

/** Colour set per tier so a buyer can scan relevance at a glance. */
export function tierStyle(tier: MatchTier): TierStyle {
  switch (tier) {
    case 'strong':
      return { text: greenDarkest, bar: greenMedium, chipBg: STRONG_BG };
    case 'good':
      return { text: warnAmber, bar: warnAmber, chipBg: GOOD_BG };
    default:
      return { text: LOW_TEXT, bar: LOW_BAR, chipBg: LOW_BG };
  }
}

/* ── Per-match product view-model ─────────────────────────────────────────── */

const snap = (m?: WtbMatch | null): WtbProductSnapshot => m?.product_snapshot ?? {};

function priceNum(p: WtbProductSnapshot['price']): number | null {
  if (p == null) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : null;
}

export interface MatchProductVM {
  /** `${wtb_id}:${product_id}` — round-trips to the Match Detail route. */
  matchId: string;
  productId: number;
  name: string;
  image: string | null;
  /** Localised "$1,234" or the "Price on request" fallback. */
  priceText: string;
  condition: string;
  country: string;
  /** RAW relevance percent (null → no badge). */
  pct: number | null;
  tier: MatchTier;
}

/** Map one WTB match row → the card view-model. Null-safe throughout. */
export function matchToProductVM(m: WtbMatch): MatchProductVM {
  const s = snap(m);
  const pct = relevancePercent(m);
  return {
    matchId: `${m.wtb_id ?? 0}:${m.product_id ?? 0}`,
    productId: m.product_id ?? 0,
    name: (s.name && String(s.name).trim()) || 'Matching item',
    image: (s.image_url && String(s.image_url).trim()) || null,
    priceText: priceLabel(priceNum(s.price), s.currency),
    condition: condLabel(s.condition),
    country: countryLabel(s.country),
    pct,
    tier: pct != null ? tierOf(pct) : 'low',
  };
}

/** Sort a want's matches strongest-first (by boosted_score, then raw score). */
export function sortMatchesStrongest(matches: WtbMatch[]): WtbMatch[] {
  return [...matches].sort(
    (a, b) => (b.boosted_score ?? b.score ?? 0) - (a.boosted_score ?? a.score ?? 0),
  );
}

/* ── Want header view helpers ─────────────────────────────────────────────── */

/** The keyword + category chips shown under a want's title ("Searching …"). */
export function wantSearchChips(want: WtbRequestSummary): { category: string; keywords: string[] } {
  const category = (want.category_name ?? '').trim();
  const keywords = Array.isArray(want.keywords)
    ? want.keywords.map((k) => String(k).trim()).filter(Boolean)
    : [];
  return { category, keywords };
}

/** Comma text ⇆ keyword array (for the edit form). Both null-safe. */
export const keywordsToText = (kw?: string[] | null): string =>
  Array.isArray(kw) ? kw.filter(Boolean).join(', ') : '';
export const textToKeywords = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
