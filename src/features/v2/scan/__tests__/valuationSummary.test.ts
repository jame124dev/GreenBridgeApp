/**
 * Valuation totals — the cases where a plausible implementation is wrong.
 *
 * The happy path barely needs a test. What needs one is every way a total can
 * be confidently incorrect: mixed currencies added together, a blank price
 * counted as zero, a range collapsed to a midpoint.
 */
import { describe, it, expect } from '@jest/globals';

import type { DraftItem } from '@/services/drafts/draftItemsApi';
import { formatBand, parseBand, summariseItems } from '../valuationSummary';

/** Minimal row; only the fields the summary reads are meaningful. */
function item(over: Partial<DraftItem>): DraftItem {
  return {
    id: 1,
    seq: 0,
    status: 'needs_review',
    title: 'x',
    price: null,
    currency: 'USD',
    marketplace: null,
    category_name: null,
    category_resolved: true,
    thumbnail_object: null,
    grade: null,
    fmv_used: null,
    scrap_value: null,
    value_tier: null,
    heat_tier: null,
    needs_clearer_photo: false,
    row_version: null,
    lot_group_id: null,
    identification_confidence: null,
    brand: null,
    model: null,
    year: null,
    condition: null,
    location: null,
    qty: null,
    demand_score: null,
    sell_weeks: null,
    ask: null,
    min_bid: null,
    ...over,
  };
}

describe('parseBand', () => {
  it('reads the real range format off a live draft', () => {
    expect(parseBand('1500-2500')).toEqual({ low: 1500, high: 2500 });
    expect(parseBand('100-200')).toEqual({ low: 100, high: 200 });
  });

  it('accepts spacing and thousands separators', () => {
    expect(parseBand('1,500 - 2,500')).toEqual({ low: 1500, high: 2500 });
  });

  it('treats a bare number as a zero-width band', () => {
    expect(parseBand('1800')).toEqual({ low: 1800, high: 1800 });
  });

  it('rejects junk rather than contributing a zero', () => {
    for (const bad of ['', '   ', 'n/a', 'TBD', '-', 'abc-def', null, undefined]) {
      expect(parseBand(bad as string)).toBeNull();
    }
  });

  it('repairs a reversed range instead of dropping the row', () => {
    expect(parseBand('2500-1500')).toEqual({ low: 1500, high: 2500 });
  });
});

describe('summariseItems', () => {
  it('sums asking prices and both ends of the bands', () => {
    const s = summariseItems([
      item({ id: 1, price: 1800, fmv_used: '1500-2500', scrap_value: '100-200' }),
      item({ id: 2, price: 200, fmv_used: '150-400', scrap_value: '20-40' }),
    ]);

    expect(s.counted).toBe(2);
    expect(s.askingTotal).toBe(2000);
    expect(s.fmv).toEqual({ low: 1650, high: 2900 });
    expect(s.scrap).toEqual({ low: 120, high: 240 });
    expect(s.currency).toBe('USD');
  });

  /** The one that would quietly produce a nonsense number. */
  it('REFUSES to total across mixed currencies', () => {
    const s = summariseItems([
      item({ id: 1, price: 1800, currency: 'USD' }),
      item({ id: 2, price: 50000, currency: 'TWD' }),
    ]);

    expect(s.currency).toBeNull();
    expect(s.mixedCurrency).toBe(true);
    expect(s.askingTotal).toBeNull();
    expect(s.fmv).toBeNull();
    expect(s.counted).toBe(2);
  });

  /**
   * Caught on screen 2026-09-17: three USD rows, one accepted and unpriced, and
   * the screen announced "these items are priced in different currencies". A
   * null currency means "no single one", which is ALSO what zero priced rows
   * gives you — so it cannot be the mixed test.
   */
  it('is NOT "mixed currency" when nothing counted is priced', () => {
    const s = summariseItems([
      item({ id: 1, price: null, currency: 'USD', status: 'accepted' }),
    ]);

    expect(s.currency).toBeNull();
    expect(s.mixedCurrency).toBe(false);
    expect(s.missingPrice).toBe(1);
  });

  it('counts a missing price as missing, not as zero', () => {
    const s = summariseItems([
      item({ id: 1, price: 1000 }),
      item({ id: 2, price: null }),
      item({ id: 3, price: null }),
    ]);

    expect(s.askingTotal).toBe(1000);
    expect(s.missingPrice).toBe(2);
  });

  it('totals ACCEPTED rows once anything has been accepted', () => {
    const s = summariseItems([
      item({ id: 1, price: 100, status: 'accepted' }),
      item({ id: 2, price: 999, status: 'needs_review' }),
    ]);

    expect(s.counted).toBe(1);
    expect(s.askingTotal).toBe(100);
  });

  it('falls back to everything in play before anything is accepted', () => {
    const s = summariseItems([
      item({ id: 1, price: 100 }),
      item({ id: 2, price: 200 }),
    ]);
    expect(s.counted).toBe(2);
    expect(s.askingTotal).toBe(300);
  });

  it('never counts a discarded row', () => {
    const s = summariseItems([
      item({ id: 1, price: 100 }),
      item({ id: 2, price: 999, status: 'discarded' }),
    ]);

    expect(s.counted).toBe(1);
    expect(s.askingTotal).toBe(100);
  });

  /**
   * Found by comparing against the web, which had already fixed it:
   * "deriving [the currency set] from every row let one unpriced row carrying a
   * stray currency null the amount and render 'your prices are in more than one
   * currency' — an assertion about prices that do not exist"
   * (`nextjs-port/.../scanv2Valuation.ts:845`).
   */
  it('ignores the currency of an UNPRICED row when deciding if a lot is mixed', () => {
    const s = summariseItems([
      item({ id: 1, price: 1800, currency: 'USD' }),
      item({ id: 2, price: 200, currency: 'USD' }),
      // No price, stray currency. Must not poison the total.
      item({ id: 3, price: null, currency: 'TWD' }),
    ]);

    expect(s.currency).toBe('USD');
    expect(s.askingTotal).toBe(2000);
    expect(s.missingPrice).toBe(1);
  });

  /** `price > 0`, matching the web. A zero is an empty cell, not a price. */
  it('treats a zero price as missing rather than as free', () => {
    const s = summariseItems([
      item({ id: 1, price: 1000 }),
      item({ id: 2, price: 0 }),
    ]);

    expect(s.askingTotal).toBe(1000);
    expect(s.missingPrice).toBe(1);
  });

  it('returns nulls, not zeroes, for an empty draft', () => {
    const s = summariseItems([]);
    expect(s.counted).toBe(0);
    expect(s.askingTotal).toBeNull();
    expect(s.fmv).toBeNull();
  });
});

describe('formatBand', () => {
  it('keeps a band a band', () => {
    expect(formatBand({ low: 1650, high: 2900 }, 'USD')).toBe('USD 1,650 – 2,900');
  });

  it('collapses a zero-width band to one figure', () => {
    expect(formatBand({ low: 1800, high: 1800 }, 'USD')).toBe('USD 1,800');
  });
});
