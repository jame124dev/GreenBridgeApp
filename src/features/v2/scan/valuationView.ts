/**
 * `valuationView` — what the Valuation screen is allowed to say, derived from
 * the draft's rows.
 *
 * `valuationSummary.ts` does the arithmetic (and has its own tests). This module
 * is the thin layer between that and the screen, and it exists so the three ways
 * a valuation screen can lie are decided in one testable place rather than
 * inside JSX:
 *
 *   1. **Never total across currencies.** `summariseItems` already returns
 *      `askingTotal: null` when `mixedCurrency` — this turns that into
 *      per-currency subtotals so the screen has something honest to render
 *      instead of a fabricated single figure.
 *   2. **The count and the warning must agree.** One of the two Stitch mocks
 *      showed "Items priced 4 of 4" directly above "1 item has no price". To
 *      make that impossible, the priced count and the unpriced list are derived
 *      from `countedRows` + `isPriced` — the SAME helpers `summariseItems` uses,
 *      exported from it for exactly this reason rather than re-implemented here.
 *   3. **Nothing to total ⇒ no chrome.** `hasItems` is false for an empty batch,
 *      and the screen must not draw step chrome or totals around it. The
 *      v2-screen skill's worked example is a review step rendering
 *      "STEP 3 OF 4 · PRICING — 75%" above "There is no item to review".
 *
 * ⚠️ **This operates on the SERVER row** — `DraftItem` from
 * `@/services/drafts/draftItemsApi` (`status`, `price: number | null`,
 * `currency`), **not** the local `DraftItem` from `@/stores/scanDraftStore`
 * (`pricePerUnit: string`, `priceCurrency`). Two different types share that
 * name, and wiring the wrong one compiles and returns `null` totals forever.
 *
 * Pure module: no React, no store access, no side effects.
 */
import type { DraftItem } from '@/services/drafts/draftItemsApi';

import { countedRows, formatBand, formatMoney, isPriced, summariseItems } from './valuationSummary';

export type ValuationSubtotal = {
  /** ISO code, or `''` for priced rows that carry no currency at all. */
  currency: string;
  /** How many rows this subtotal covers — so the parts visibly add up. */
  count: number;
  total: string;
};

export type UnpricedItem = { id: number; title: string };

export type ValuationView = {
  /** False when there is nothing to value. The screen draws no chrome and no totals. */
  hasItems: boolean;
  /** The one figure — or `null` when the batch spans currencies. Never invented. */
  askingTotal: string | null;
  /** Present ONLY when `askingTotal` is null, so the screen still says something true. */
  subtotals: ValuationSubtotal[] | null;
  /** e.g. `"3 of 4"`. Agrees with `unpriced` by construction. */
  pricedLabel: string;
  /**
   * The same two numbers, unformatted.
   *
   * `pricedLabel` is one phrasing of them; a screen that wants to say it
   * differently ("3 still need a price") should not have to parse that string
   * back apart, because a second phrasing derived by parsing is a second source
   * of truth waiting to drift.
   */
  pricedCount: number;
  countedCount: number;
  /** Every row the seller must price before this batch can publish. */
  unpriced: UnpricedItem[];
  fmv: string | null;
  scrap: string | null;
};

const EMPTY: ValuationView = {
  hasItems: false,
  askingTotal: null,
  subtotals: null,
  pricedLabel: '0 of 0',
  pricedCount: 0,
  countedCount: 0,
  unpriced: [],
  fmv: null,
  scrap: null,
};

/** An untitled row still has to be identifiable, or the warning names nothing. */
function titleOf(row: DraftItem): string {
  const t = (row.title ?? '').trim();
  return t.length > 0 ? t : `Item ${row.seq}`;
}

function subtotalsFor(rows: readonly DraftItem[]): ValuationSubtotal[] {
  const byCurrency = new Map<string, { sum: number; count: number }>();

  for (const r of rows) {
    if (!isPriced(r)) continue;
    /**
     * ⚠️ A priced row with NO currency is still counted — under `''`.
     *
     * It used to be skipped, silently. That broke the one guarantee this module
     * exists for: `pricedCount` counted the row, the subtotals did not, so the
     * screen could read "Priced 15 of 18" above a breakdown covering 13 — with
     * nothing saying where the other two went. Money that vanishes between two
     * lines of the same block is exactly the class of defect `valuationSummary`
     * was centralised to prevent.
     *
     * The bucket surfaces instead of disappearing; the screen labels it.
     */
    const currency = r.currency ?? '';
    const bucket = byCurrency.get(currency) ?? { sum: 0, count: 0 };
    bucket.sum += r.price as number;
    bucket.count += 1;
    byCurrency.set(currency, bucket);
  }

  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, { sum, count }]) => ({
      currency,
      count,
      // An unknown currency must not be written as money with a made-up code.
      total: currency ? formatMoney(sum, currency) : String(sum),
    }));
}

export function buildValuationView(items: readonly DraftItem[]): ValuationView {
  const rows = countedRows(items);
  if (rows.length === 0) return EMPTY;

  const summary = summariseItems(items);

  // Same rows, same predicate as the summary — so the count and the warning
  // cannot disagree.
  const unpriced = rows
    .filter((r) => !isPriced(r))
    .map((r) => ({ id: r.id, title: titleOf(r) }));

  const priced = rows.length - unpriced.length;

  return {
    hasItems: true,
    askingTotal:
      summary.askingTotal === null ? null : formatMoney(summary.askingTotal, summary.currency),
    /**
     * ⚠️ `mixedCurrency` IS THE TEST — not `askingTotal === null`.
     *
     * `summariseItems` returns a null total for TWO different reasons: a batch
     * spanning currencies (`valuationSummary.ts:158`), and a batch where
     * nothing is priced at all (the total never leaves its initial `null`).
     * Branching on the null therefore sent an entirely unpriced single-currency
     * batch down the mixed-currency path, where `subtotalsFor` returns `[]` —
     * a non-null empty array, against a contract that says subtotals exist only
     * for the mixed case. A consumer would render a currency breakdown for a
     * batch that has no prices in it.
     *
     * `valuationSummary.ts:47-54` already carries this exact warning one layer
     * down ("`mixedCurrency` is the test"); this is the same mistake made again
     * on top of it.
     */
    subtotals: summary.mixedCurrency ? subtotalsFor(rows) : null,
    pricedLabel: `${priced} of ${rows.length}`,
    pricedCount: priced,
    countedCount: rows.length,
    unpriced,
    fmv: summary.fmv ? formatBand(summary.fmv, summary.currency) : null,
    scrap: summary.scrap ? formatBand(summary.scrap, summary.currency) : null,
  };
}
