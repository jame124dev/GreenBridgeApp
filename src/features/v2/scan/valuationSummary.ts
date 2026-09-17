/**
 * Valuation totals for a multi-item draft — the mobile half of the web's
 * "Valuation" step (`Docs/v2/WEB-PARITY.md` #3).
 *
 * Pure: no React, no network. Everything here is derived from the item rows
 * `GET /drafts/:id/items` already returns, so this needs no new endpoint and no
 * server change.
 *
 * ── THE TWO THINGS THIS REFUSES TO DO ──────────────────────────────────────
 *
 * 1. **It never sums across currencies.** A draft extracted from a real
 *    spreadsheet can hold USD and TWD rows together, and adding those numbers
 *    produces a total that is not money in any currency. When the accepted rows
 *    disagree, `currency` comes back `null` and the caller must say so instead
 *    of printing a figure.
 *
 * 2. **It never invents a point price from a range.** `fmv_used` is a RANGE
 *    string (`"1500-2500"`, measured on a live draft), and the web is careful
 *    to show bands rather than a midpoint. Totals stay ranges: low with low,
 *    high with high.
 *
 * Rows with nothing usable are counted in `missingPrice` rather than treated as
 * zero — a spreadsheet row with an empty price column is unknown, not free.
 */
import type { DraftItem } from '@/services/drafts/draftItemsApi';

/** A low–high band. Both ends are real numbers or the band is absent. */
export interface Band {
  low: number;
  high: number;
}

export interface ValuationSummary {
  /** Rows the totals are computed over — accepted, or everything not discarded. */
  counted: number;
  /** Rows in `counted` that carry no usable price. */
  missingPrice: number;
  /**
   * The shared currency of the PRICED rows, or `null` when there is no single
   * one. `null` has TWO causes and they are not the same message.
   */
  currency: string | null;
  /**
   * The priced rows disagree — the only case where "these are in different
   * currencies" is a true thing to say.
   *
   * ⚠️ THIS EXISTS BECAUSE `currency === null` IS NOT THAT TEST, and the screen
   * used it as one. Observed in the browser 2026-09-17: three rows, all USD,
   * one accepted and unpriced — the screen announced "these items are priced in
   * different currencies", about one item, in one currency, with no price. Zero
   * priced rows also yields a null currency, and saying nothing is the honest
   * answer there. The web keeps the same pair for the same reason
   * (`scanv2Valuation.ts:858`, `mixedCurrency`).
   */
  mixedCurrency: boolean;
  /** Sum of the asking prices. `null` when there is nothing to add. */
  askingTotal: number | null;
  /** Summed fair-market band across rows that have one. */
  fmv: Band | null;
  /** Summed scrap floor across rows that have one. */
  scrap: Band | null;
}

/**
 * Parse `"1500-2500"`, `"1500 - 2500"`, or a bare `"1800"`.
 *
 * Returns `null` for anything else — including an empty string and a malformed
 * range — so a bad cell cannot quietly contribute a zero to a total.
 */
export function parseBand(raw: string | null | undefined): Band | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[, ]/g, '');
  if (!cleaned) return null;

  const range = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(cleaned);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    // A reversed range is a data error, not a reason to drop the row.
    return low <= high ? { low, high } : { low: high, high: low };
  }

  const single = Number(cleaned);
  return Number.isFinite(single) ? { low: single, high: single } : null;
}

/** Which rows a total should cover. */
function countedRows(items: readonly DraftItem[]): DraftItem[] {
  const accepted = items.filter((i) => i.status === 'accepted');
  // Before anyone has accepted anything, a total over nothing is useless — so
  // fall back to everything still in play. Discarded rows never count.
  return accepted.length > 0 ? accepted : items.filter((i) => i.status !== 'discarded');
}

/** Add two bands, treating a missing one as "nothing to add". */
function addBand(acc: Band | null, next: Band | null): Band | null {
  if (!next) return acc;
  if (!acc) return { ...next };
  return { low: acc.low + next.low, high: acc.high + next.high };
}

/**
 * Does this row carry a real asking price?
 *
 * `> 0`, matching the web's `summarizeAskTotal`
 * (`nextjs-port/.../scanv2Valuation.ts:854`). A zero is not a price a seller
 * set — it is an empty cell that survived extraction as a number — and adding
 * it to a total while NOT counting it as missing hides it twice over.
 */
function isPriced(r: DraftItem): boolean {
  return typeof r.price === 'number' && Number.isFinite(r.price) && r.price > 0;
}

export function summariseItems(items: readonly DraftItem[]): ValuationSummary {
  const rows = countedRows(items);

  /**
   * ⚠️ CURRENCIES COME FROM THE PRICED ROWS ONLY.
   *
   * This used to read every counted row, and the web fixed exactly that bug
   * before us — its comment is worth quoting: deriving the set from every row
   * "let one unpriced row carrying a stray currency null the amount and render
   * 'your prices are in more than one currency' — an assertion about prices
   * that do not exist" (`scanv2Valuation.ts:845-851`). The total is the sum of
   * the PRICED rows, so only their currencies can make it ambiguous.
   */
  const priced = rows.filter(isPriced);
  const currencies = new Set(
    priced.map((r) => r.currency).filter((c): c is string => typeof c === 'string' && !!c),
  );
  // One currency, or none at all (in which case there is nothing to mislabel).
  const currency = currencies.size === 1 ? [...currencies][0] : null;

  let askingTotal: number | null = null;
  let missingPrice = 0;
  let fmv: Band | null = null;
  let scrap: Band | null = null;

  for (const r of rows) {
    if (isPriced(r)) {
      askingTotal = (askingTotal ?? 0) + (r.price as number);
    } else {
      missingPrice += 1;
    }
    fmv = addBand(fmv, parseBand(r.fmv_used));
    scrap = addBand(scrap, parseBand(r.scrap_value));
  }

  // Mixed currencies ⇒ the money figures are meaningless. Drop them rather
  // than hand the caller a number it might render.
  if (currencies.size > 1) {
    return {
      counted: rows.length,
      missingPrice,
      currency: null,
      mixedCurrency: true,
      askingTotal: null,
      fmv: null,
      scrap: null,
    };
  }

  return { counted: rows.length, missingPrice, currency, mixedCurrency: false, askingTotal, fmv, scrap };
}

/** "USD 1,800" / "USD 1,500 – 2,500". Never a bare number without its currency. */
export function formatMoney(value: number, currency: string | null): string {
  const n = Math.round(value).toLocaleString('en-US');
  return currency ? `${currency} ${n}` : n;
}

export function formatBand(band: Band, currency: string | null): string {
  if (band.low === band.high) return formatMoney(band.low, currency);
  return `${formatMoney(band.low, currency)} – ${Math.round(band.high).toLocaleString('en-US')}`;
}
