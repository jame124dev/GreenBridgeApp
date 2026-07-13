// Pure mapper: `listing_draft` / `wtb_draft` data-frame payload → the Draft
// screen's view shape (the same `DraftData` that the static demo module uses,
// so `draft.tsx` renders one shape whether it's fed static or live data).
//
// Wiring context (NewVersion/dynamic/04-mobile-integration-plan.md §5.1): when
// LAB_CHAT_ENABLED, the Draft screen reads `useThread().turn.draft` — the last
// `data{type:'listing_draft'}` (sell) or `wtb_draft` (buy) payload folded in by
// `threadStore.applyFrame`. Frames arrive cumulatively (a field may be absent
// on an early frame and fill in on a later one), so this mapper is:
//   • total — never throws on a partial / unknown payload (returns a
//     best-effort partial view; the screen keeps the static fallback for gaps);
//   • replace-in-place — the caller re-runs it against the newest `turn.draft`
//     each render, so keyed rows update rather than re-appearing.
//
// The `listing_draft` payload shape (per the assistant chat_adapter) is
// `{ draft: { fields: { <name>: { value, confidence } }, ... } }`. The `wtb_draft`
// payload is flatter (`{ draft: { title, category, quantity, ... } }`). Both are
// defensively probed below — we never assume a key is present.
import type { ComposerMode } from '@/features/lab/stores/composerStore';
import type { DraftData, Spec } from '@/features/lab/data/demo';
import { DRAFT_DATA } from '@/features/lab/data/demo';

/* -------------------------------------------------------------------------- */
/*  Safe accessors — the frame is `unknown`; probe without ever throwing.      */
/* -------------------------------------------------------------------------- */

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Unwrap the `{ draft: {...} }` envelope; tolerate a bare draft object too. */
function unwrapDraft(frame: unknown): Dict | null {
  if (!isDict(frame)) return null;
  if (isDict(frame.draft)) return frame.draft;
  return frame;
}

/** Read a `{ value, confidence }` sell field, a plain scalar, or nested `.value`. */
function fieldValue(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  if (isDict(v) && 'value' in v) return fieldValue(v.value);
  return undefined;
}

/** First non-empty value among the given keys (checks `fields.<k>` then `<k>`). */
function pick(draft: Dict, fields: Dict | null, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const fromFields = fields ? fieldValue(fields[k]) : undefined;
    if (fromFields) return fromFields;
    const fromRoot = fieldValue(draft[k]);
    if (fromRoot) return fromRoot;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  Spec-row assembly (append a row only when its value resolves).             */
/* -------------------------------------------------------------------------- */

function specRow(rows: Spec[], k: string, v: string | undefined) {
  if (v) rows.push({ k, v });
}

/** Condition code → human label (mirrors the web `condLabel`). */
function condLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const map: Record<string, string> = {
    new: 'New',
    used: 'Used · Good',
    working: 'Working · Good',
    for_parts: 'For parts',
    refurbished: 'Refurbished',
  };
  return map[raw.toLowerCase()] ?? raw;
}

/* -------------------------------------------------------------------------- */
/*  Price formatting.                                                          */
/* -------------------------------------------------------------------------- */

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', THB: '฿' };

function formatPrice(amount: string | undefined, currency: string | undefined): string | undefined {
  if (!amount) return undefined;
  const num = Number(amount.replace(/[^0-9.]/g, ''));
  const sym = currency ? (CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency} `) : '$';
  if (Number.isFinite(num) && num > 0) return `${sym}${num.toLocaleString('en-US')}`;
  // Non-numeric or already-formatted string — surface as-is with a symbol guess.
  return amount.startsWith(sym) ? amount : `${sym}${amount}`;
}

/* -------------------------------------------------------------------------- */
/*  Demand copy from a preview match count.                                    */
/* -------------------------------------------------------------------------- */

function matchCount(draft: Dict, fields: Dict | null): number | undefined {
  const raw =
    fieldValue(draft.match_count) ??
    fieldValue(draft.preview_match_count) ??
    (Array.isArray(draft.preview_matches) ? String(draft.preview_matches.length) : undefined) ??
    (fields ? fieldValue(fields.match_count) : undefined);
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/* -------------------------------------------------------------------------- */
/*  Public mapper.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Map a `listing_draft` (sell) / `wtb_draft` (buy) frame payload onto `DraftData`.
 * Missing fields fall back to the static `DRAFT_DATA[mode]` copy for that slot, so
 * a half-streamed draft still renders a coherent card (fields fill in as frames
 * arrive). `mode` selects sell vs buy defaults and label copy.
 */
export function draftFromFrame(frame: unknown, mode: ComposerMode): DraftData {
  const base = DRAFT_DATA[mode];
  const draft = unwrapDraft(frame);
  if (!draft) return base; // nothing usable yet → static shell

  const fields = isDict(draft.fields) ? draft.fields : null;
  const sell = mode === 'sell';

  // ── Title / location ──────────────────────────────────────────────────
  const title = pick(draft, fields, 'product_title', 'title', 'name');
  const locationBase = pick(draft, fields, 'location', 'city');
  const country = pick(draft, fields, 'country');
  const location =
    locationBase && country && !locationBase.includes(country)
      ? `${locationBase}, ${country}`
      : locationBase ?? undefined;

  // ── Specs (append only resolved rows; keys are stable for keyed reveal) ──
  const specs: Spec[] = [];
  if (sell) {
    specRow(specs, 'Condition', condLabel(pick(draft, fields, 'item_condition', 'condition')));
    specRow(specs, 'Year', pick(draft, fields, 'year'));
    specRow(specs, 'Capacity', pick(draft, fields, 'capacity', 'dimensions'));
    specRow(specs, 'Category', pick(draft, fields, 'category'));
    specRow(specs, 'Brand', pick(draft, fields, 'brand'));
    specRow(specs, 'Model', pick(draft, fields, 'model'));
  } else {
    specRow(specs, 'Quantity', pick(draft, fields, 'quantity'));
    specRow(specs, 'Type', pick(draft, fields, 'category', 'type'));
    specRow(specs, 'Condition', condLabel(pick(draft, fields, 'condition_wanted', 'condition')));
    specRow(specs, 'Timeline', pick(draft, fields, 'timeline', 'needed_by'));
  }

  // ── Price ────────────────────────────────────────────────────────────
  let price: string | undefined;
  if (sell) {
    price = formatPrice(
      pick(draft, fields, 'price_per_unit', 'price'),
      pick(draft, fields, 'price_currency', 'currency'),
    );
  } else {
    const max = formatPrice(
      pick(draft, fields, 'max_price', 'budget'),
      pick(draft, fields, 'price_currency', 'currency'),
    );
    price = max ? `up to ${max}` : undefined;
  }
  const priceHint = pick(draft, fields, 'pricing_basis', 'price_hint');

  // ── Demand callout from a live preview match count, else static copy ────
  const count = matchCount(draft, fields);
  let demandTitle: string | undefined;
  if (count != null) {
    demandTitle = sell
      ? `${count} ${count === 1 ? 'buyer' : 'buyers'} already want this`
      : `${count} ${count === 1 ? 'seller' : 'sellers'} can supply this`;
  }

  // Merge over the static base so any unresolved slot keeps coherent copy.
  return {
    ...base,
    title: title ?? base.title,
    location: location ?? base.location,
    specs: specs.length > 0 ? specs : base.specs,
    price: price ?? base.price,
    priceHint: priceHint ?? base.priceHint,
    demandTitle: demandTitle ?? base.demandTitle,
    // priceLabel / demandSub / publishLabel / market / headline stay from base
    // (mode-static per §5.1 — "SUGGESTED PRICE" / "YOUR BUDGET" etc).
  };
}
