/**
 * What the Valuation screen is allowed to say.
 *
 * Task: `todo/SCANV2_V2UI_12_VALUATION.md`.
 *
 * `valuationSummary.ts` already does the arithmetic and has its own tests. This
 * gate is about the SCREEN's decisions — the three places where a valuation
 * screen can lie:
 *
 *   1. **Totalling across currencies.** `USD 14,000 + TWD 912,000` is not a
 *      number. The summary returns `askingTotal: null` for that case; the screen
 *      must show per-currency subtotals instead of synthesising one.
 *   2. **Counting an unpriced row as priced.** "Items priced 4 of 4" above a
 *      warning that one has no price is the screen contradicting itself — the
 *      exact defect in one of the two Stitch mocks.
 *   3. **Rendering step chrome with nothing to total.** The v2-screen skill's
 *      worked example is a review step showing "STEP 3 OF 4 · PRICING — 75%"
 *      above "There is no item to review". Chrome belonging to a state must not
 *      render outside that state.
 *
 * ⚠️ These are **server rows** (`@/services/drafts/draftItemsApi`), not the
 * local `scanDraftStore` item. Two types share the name `DraftItem`; the first
 * draft of this module used the wrong one, compiled, and returned `null` totals
 * for every single-currency batch. This fixture is the server shape on purpose.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import type { DraftItem } from '@/services/drafts/draftItemsApi';

import { buildValuationView } from '../valuationView';

let seq = 0;

/** Only the fields the valuation path reads; the rest of the DTO is noise here. */
function row(over: Partial<DraftItem>): DraftItem {
  seq += 1;
  return {
    id: over.id ?? seq,
    seq,
    status: over.status ?? 'needs_review',
    title: over.title ?? 'Untitled',
    price: over.price ?? null,
    currency: over.currency ?? 'USD',
    ...over,
  } as DraftItem;
}

beforeEach(() => {
  seq = 0;
});

describe('valuation view', () => {
  it('totals a single-currency batch', () => {
    const view = buildValuationView([
      row({ price: 14000, currency: 'USD' }),
      row({ price: 9500, currency: 'USD' }),
    ]);

    expect(view.hasItems).toBe(true);
    expect(view.askingTotal).toContain('23,500');
    expect(view.subtotals).toBeNull();
    expect(view.unpriced).toEqual([]);
    expect(view.pricedLabel).toBe('2 of 2');
  });

  /** ⚑ A single figure across two currencies would be a fabricated number. */
  it('refuses to total a mixed-currency batch and shows subtotals instead', () => {
    const view = buildValuationView([
      row({ price: 14000, currency: 'USD' }),
      row({ price: 912000, currency: 'TWD' }),
    ]);

    expect(view.askingTotal).toBeNull();
    expect(view.subtotals).not.toBeNull();
    expect(view.subtotals?.map((s) => s.currency)).toEqual(['TWD', 'USD']);
  });

  /**
   * ⚑ THE THIRD REASON A TOTAL CAN BE ABSENT, and the one that was conflated.
   *
   * `summariseItems` returns `askingTotal: null` for **two** different
   * situations: a mixed-currency batch (`valuationSummary.ts:158`) and a batch
   * where nothing is priced at all (`askingTotal` simply never leaves its
   * initial `null` at `:135`). The view decided "show subtotals" from
   * `askingTotal === null`, so an entirely unpriced single-currency batch took
   * the mixed-currency branch and produced a non-null but EMPTY `subtotals`
   * array — while the contract says subtotals are present only for the mixed
   * case.
   *
   * That is precisely the defect `valuationSummary.ts:47-54` was written to
   * prevent ("`mixedCurrency` is the test, not `currency === null`"),
   * reintroduced one layer up. `summary.mixedCurrency` was available and unused.
   */
  it('does not mistake an unpriced batch for a mixed-currency one', () => {
    const view = buildValuationView([
      row({ title: 'Waters Alliance e2695', price: null, currency: 'USD' }),
      row({ title: 'FANUC M-20iA', price: null, currency: 'USD' }),
    ]);

    expect(view.askingTotal).toBeNull();
    // One currency, nothing priced — there is nothing to break down.
    expect(view.subtotals).toBeNull();
    expect(view.pricedLabel).toBe('0 of 2');
    expect(view.unpriced).toHaveLength(2);
  });

  /**
   * ⚑ THE SCREEN MUST ACTUALLY USE THIS.
   *
   * `valuationView` sat unused for a day while `app/v2/scan/items.tsx`
   * hand-rolled a thinner version from `summariseItems` directly — so a
   * mixed-currency batch was told "these cannot be totalled" with no breakdown,
   * and unpriced rows were counted but never named. Both facts were computed
   * here and thrown away.
   *
   * Asserted as source, because "the module is correct but nothing calls it" is
   * exactly the failure the unit tests above cannot see. A screen that renders
   * its own copy of this logic is the drift `valuationSummary`'s exports were
   * centralised to prevent.
   */
  it('is actually consumed by the items screen', () => {
    const screen = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'app', 'v2', 'scan', 'items.tsx'),
      'utf8',
    );

    expect(screen).toMatch(/buildValuationView/);
    // The two facts it exists to add over the old hand-rolled block.
    expect(screen).toMatch(/subtotals/);
    expect(screen).toMatch(/unpriced/);
  });

  /** ⚑ The count and the warning must agree. */
  it('excludes an unpriced row from the priced count and names it', () => {
    const view = buildValuationView([
      row({ title: 'Waters Alliance e2695', price: 14000 }),
      row({ title: 'FANUC M-20iA', price: null }),
    ]);

    expect(view.pricedLabel).toBe('1 of 2');
    expect(view.unpriced.map((u) => u.title)).toEqual(['FANUC M-20iA']);
  });

  /**
   * ⚑ MONEY MUST NOT VANISH BETWEEN TWO LINES OF THE SAME BLOCK.
   *
   * `subtotalsFor` used to `continue` past any priced row with no currency,
   * while `pricedCount` counted it — so the screen could read "Priced 15 of 18"
   * above a breakdown covering 13, with nothing saying where the other two
   * went. Found by a fresh-eyes pass, not by the earlier tests.
   */
  it('every priced row lands in some subtotal, even with no currency', () => {
    const view = buildValuationView([
      row({ price: 100, currency: 'USD' }),
      row({ price: 200, currency: 'TWD' }),
      row({ price: 50, currency: null }),
    ]);

    expect(view.subtotals).not.toBeNull();

    const covered = (view.subtotals ?? []).reduce((n, s) => n + s.count, 0);
    expect(covered).toBe(view.pricedCount);
  });

  /** The unlabelled bucket must not be written as money with an invented code. */
  it('does not invent a currency code for a row that has none', () => {
    const view = buildValuationView([
      row({ price: 100, currency: 'USD' }),
      row({ price: 200, currency: 'TWD' }),
      row({ price: 50, currency: null }),
    ]);

    const none = (view.subtotals ?? []).find((s) => s.currency === '');
    expect(none).toBeDefined();
    expect(none?.total).not.toMatch(/[A-Z]{3}/);
  });

  /** The counts a screen renders must not need parsing back out of a label. */
  it('exposes the priced counts as numbers, agreeing with the label', () => {
    const view = buildValuationView([
      row({ price: 14000, currency: 'USD' }),
      row({ price: null, currency: 'USD' }),
    ]);

    expect(view.pricedLabel).toBe(`${view.pricedCount} of ${view.countedCount}`);
    expect(view.countedCount - view.pricedCount).toBe(view.unpriced.length);
  });

  /** A zero price is not a price — it must not escape the unpriced count. */
  it('treats a zero price as no price', () => {
    const view = buildValuationView([
      row({ price: 14000 }),
      row({ title: 'Zeroed', price: 0 }),
    ]);

    expect(view.pricedLabel).toBe('1 of 2');
    expect(view.unpriced.map((u) => u.title)).toEqual(['Zeroed']);
  });

  /** An untitled row still has to be nameable, or the warning points at nothing. */
  it('falls back to the sequence number when a row has no title', () => {
    const view = buildValuationView([row({ title: null, price: null })]);

    expect(view.unpriced[0]?.title).toBe('Item 1');
  });

  /** Discarded rows are not part of the batch and must not be totalled or warned about. */
  it('ignores discarded rows', () => {
    const view = buildValuationView([
      row({ status: 'accepted', price: 14000 }),
      row({ status: 'discarded', title: 'Thrown away', price: null }),
    ]);

    expect(view.pricedLabel).toBe('1 of 1');
    expect(view.unpriced).toEqual([]);
  });

  /** ⚑ Nothing to total ⇒ no step chrome, no totals, no contradiction. */
  it('renders no chrome and no totals when there is nothing to value', () => {
    const view = buildValuationView([]);

    expect(view.hasItems).toBe(false);
    expect(view.askingTotal).toBeNull();
    expect(view.subtotals).toBeNull();
    expect(view.unpriced).toEqual([]);
  });
});
