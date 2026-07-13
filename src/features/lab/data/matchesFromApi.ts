// matchesFromApi.ts — PURE mappers: WTB API payload → the static demo view shapes.
//
// The screens (Matches feed, Match Detail) render off the static `MatchCard` /
// `MatchDetailFixture` shapes from `demo.ts`. These mappers turn a live WTB match
// row (+ its parent want) INTO those exact shapes so the JSX renders identically
// whether the source is static fixtures or the live assistant — the Phase-2 swap
// is only a data-source change (NewVersion/dynamic/04 §7.1, §8.1).
//
// Everything here is a pure, null-safe function (no I/O, no React) so it stays
// unit-testable and side-effect-free. Number/blank/undefined all degrade to safe
// display fallbacks — never "undefined", never a throw.
import { greenMedium, warnAmber } from '@/constants/theme';
import type { MatchCard, MatchDetailFixture } from '@/features/lab/data/demo';
import type {
  WtbMatch,
  WtbProductSnapshot,
  WtbRequestSummary,
} from '@/features/lab/data/wtbApi';

/* ── Score helpers ───────────────────────────────────────────────────────── */

/** boosted_score (0..1) → integer percent (0..100), clamped. Null/NaN/∞ → null
 *  so the caller renders no badge (mirrors web `scoreToPercent`). Prefers
 *  `boosted_score`, falling back to the raw `score` when the boosted one is absent. */
export function matchPercent(m: WtbMatch | null | undefined): number | null {
  const raw = m?.boosted_score ?? m?.score;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

/** Feed/detail chip variant from the score band (04 §7.1: retrieval floor 0.4,
 *  notify floor 0.8 → "New match" ≥80%, else "Worth a look"). */
export type MatchBand = 'new-match' | 'worth-a-look';
export function scoreBand(pct: number | null): MatchBand {
  return pct != null && pct >= 80 ? 'new-match' : 'worth-a-look';
}

/* ── Snapshot / price / relative-time formatting (null-safe) ─────────────── */

const snap = (m?: WtbMatch | null): WtbProductSnapshot => m?.product_snapshot ?? {};

/** Coerce a snapshot price (number | numeric string | absent) → finite number | null. */
function priceNum(p: WtbProductSnapshot['price']): number | null {
  if (p == null) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : null;
}

/** "$13,400" / "$1.2m" style compact price label; null price → "Price on request". */
export function priceLabel(p: number | null | undefined, currency?: string): string {
  if (p == null || !Number.isFinite(p) || p <= 0) return 'Price on request';
  const sym = currency && currency !== 'USD' ? `${currency} ` : '$';
  try {
    return `${sym}${Math.round(p).toLocaleString('en-US')}`;
  } catch {
    return `${sym}${Math.round(p)}`;
  }
}

/** Short "$13.4k" / "$1.9m" style used in the compact feed sub-line. */
function compactPrice(p: number | null): string | null {
  if (p == null || p <= 0) return null;
  if (p >= 1_000_000) return `$${+(p / 1_000_000).toFixed(1)}m`;
  if (p >= 1000) return `$${+(p / 1000).toFixed(1)}k`;
  return `$${Math.round(p)}`;
}

/** ISO → "2h ago" style. Pure + null-safe: missing/invalid → "recently".
 *  (The screen may replace this with date-fns `formatDistanceToNowStrict`;
 *   kept dependency-free here so the mapper stays pure.) */
export function relativeTime(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return 'recently';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'recently';
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Compose the want's "context" line (category · budget). */
function wantContext(want?: WtbRequestSummary | null): string {
  const parts: string[] = [];
  const cat = (want?.category_name ?? '').trim();
  if (cat) parts.push(cat);
  const budget = want?.max_price;
  if (budget != null && Number.isFinite(Number(budget)) && Number(budget) > 0) {
    const cp = compactPrice(Number(budget));
    if (cp) parts.push(cp);
  }
  return parts.join(' · ');
}

/* ── Demo `MatchCard` (Matches feed) ──────────────────────────────────────── */

// Chip tokens on the static card. `toMatchVM` (matchesView.ts) re-derives the
// ring colors from the label, so these mirror its existing green/amber choice.
const NEW_MATCH = { tag: 'New match', tagColor: greenMedium, tagBg: '#EAF6EE' } as const;
const WORTH_A_LOOK = { tag: 'Worth a look', tagColor: warnAmber, tagBg: '#FBF1DD' } as const;

/**
 * Map one WTB match row (+ its parent want) → the demo `MatchCard` shape the
 * Matches feed consumes (04 §7.1). `id` prefers the stable `wtb_id:product_id`
 * pair so it round-trips to `useMatchDetail`. Null-safe throughout.
 */
export function matchToMatchCard(m: WtbMatch, want?: WtbRequestSummary | null): MatchCard {
  const s = snap(m);
  const pct = matchPercent(m) ?? 0;
  const band = scoreBand(matchPercent(m));
  const chip = band === 'new-match' ? NEW_MATCH : WORTH_A_LOOK;

  const sellName = (s.name && String(s.name).trim()) || 'Matching item';
  const country = (s.country ?? '').trim();
  const price = compactPrice(priceNum(s.price));
  const sellSub = [country, price].filter(Boolean).join(' · ') || 'Details on request';

  return {
    id: `${m.wtb_id ?? 0}:${m.product_id ?? 0}`,
    tag: chip.tag,
    time: relativeTime(m.matched_at),
    tagColor: chip.tagColor,
    tagBg: chip.tagBg,
    sell: sellName,
    sellSub,
    pct,
    want: (want?.title && want.title.trim()) || 'Your want',
    wantSub: wantContext(want) || 'saved want',
  };
}

/**
 * Flatten a set of (want, matches) pairs into a single feed, newest first
 * (by `matched_at`, then descending score). This is the "union of recent
 * matches across all active wants" the feed shows (04 §7).
 */
export function matchesToFeed(
  groups: { want: WtbRequestSummary; matches: WtbMatch[] }[],
): MatchCard[] {
  const rows: { card: MatchCard; ts: number; pct: number }[] = [];
  for (const g of groups) {
    for (const m of g.matches) {
      const ts = m.matched_at ? Date.parse(m.matched_at) : NaN;
      rows.push({
        card: matchToMatchCard(m, g.want),
        ts: Number.isFinite(ts) ? ts : 0,
        pct: matchPercent(m) ?? 0,
      });
    }
  }
  rows.sort((a, b) => b.ts - a.ts || b.pct - a.pct);
  return rows.map((r) => r.card);
}

/* ── Demo `MatchDetailFixture` (Match Detail) ─────────────────────────────── */

/**
 * Compose a `MatchDetailFixture` from a WTB match row + its parent want (04 §8.1).
 *
 * Honest gaps (no server producer today, so derived / static):
 *   - `reasons` are DERIVED from the score band + budget delta + shared category.
 *   - `trust` chips are the static managed-marketplace promise.
 *   - `dealId` has no server source; it defaults to the composed match id and is
 *     the "open/create a conversation on demand" seam for the Deal Room CTA (§9).
 */
export function matchToDetail(
  m: WtbMatch,
  want?: WtbRequestSummary | null,
  opts?: { dealId?: string },
): MatchDetailFixture {
  const s = snap(m);
  const pct = matchPercent(m) ?? 0;
  const band = scoreBand(matchPercent(m));
  const id = `${m.wtb_id ?? 0}:${m.product_id ?? 0}`;

  const productPrice = priceNum(s.price);
  const budget = want?.max_price != null ? Number(want.max_price) : null;

  return {
    id,
    // No server deal/conversation id — the CTA mints one when it opens the room.
    dealId: opts?.dealId ?? id,
    confidence: pct,
    // `MatchDetailFixture.tag` uses 'new' | 'worth-a-look' (the feed uses
    // 'new-match'); map the band to the detail vocabulary.
    tag: band === 'new-match' ? 'new' : 'worth-a-look',
    wts: {
      id: String(s.batch_id ?? m.product_id ?? ''),
      title: (s.name && String(s.name).trim()) || 'Matching item',
      // The snapshot has no seller org today → country stands in as the source.
      org: (s.country ?? '').trim() || 'Verified seller',
      location: (s.country ?? '').trim() || '',
      priceLabel: priceLabel(productPrice, s.currency),
      // Carry the listing owner's id through when the snapshot provides it, so
      // "Contact seller" can open the exact seller thread. Null today (the
      // backend snapshot doesn't emit seller_id yet) → the CTA falls back to the
      // Messages inbox until the assistant enriches the snapshot.
      sellerId: typeof s.seller_id === 'number' ? s.seller_id : null,
    },
    wtb: {
      id: String(want?.id ?? m.wtb_id ?? ''),
      title: (want?.title && want.title.trim()) || 'Your want',
      // "You ·" / "Buyer ·" prefix is derived at render from composerStore.mode.
      context: (want?.category_name ?? '').trim() || 'your request',
      budgetLabel:
        budget != null && Number.isFinite(budget) && budget > 0
          ? `up to ${priceLabel(budget, want?.price_currency)}`
          : 'open budget',
    },
    reasons: deriveReasons(pct, productPrice, budget, s, want),
    // No server trust signal today — static managed-marketplace chips.
    trust: { verifiedSeller: true, escrow: true },
  };
}

/** Derive human "why matched" reasons from the data we actually have. */
function deriveReasons(
  pct: number,
  productPrice: number | null,
  budget: number | null,
  s: WtbProductSnapshot,
  want?: WtbRequestSummary | null,
): string[] {
  const reasons: string[] = [];
  if (pct > 0) reasons.push(`${pct}% match on your saved criteria.`);
  if (productPrice != null && budget != null && budget > 0 && productPrice <= budget) {
    const under = Math.round(((budget - productPrice) / budget) * 100);
    reasons.push(
      under > 0
        ? `${priceLabel(productPrice, s.currency)} sits ${under}% under your ${priceLabel(budget, want?.price_currency)} budget.`
        : `Within your ${priceLabel(budget, want?.price_currency)} budget.`,
    );
  }
  const cat = (s.category ?? want?.category_name ?? '').trim();
  if (cat) reasons.push(`Same category — ${cat}.`);
  if (reasons.length === 0) reasons.push('Surfaced from your active want.');
  return reasons;
}
