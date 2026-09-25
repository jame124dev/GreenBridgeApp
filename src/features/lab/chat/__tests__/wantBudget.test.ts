/**
 * The budget tiers a buyer taps when saving a want.
 *
 * These were three private functions inside `cards.tsx` with no tests, because
 * reaching them meant rendering a card. They are now importable, so the rules
 * can be pinned directly — and they are rules about MONEY shown to a buyer,
 * which is the category this workspace has already shipped wrong once.
 */
import {
  WTB_CONDITION_CODES,
  budgetQuickChips,
  fmtBudget,
  niceRound,
} from '../wantBudget';

describe('niceRound', () => {
  it.each([
    [100, 100],
    [4200, 5000],
    [1, 1],
    [999, 1000],
  ])('rounds %d up to %d', (input, expected) => {
    expect(niceRound(input)).toBe(expected);
  });

  /** Guards the `Math.log10` path: log10(0) is -Infinity, which would make the
   *  exponent NaN and hand a NaN tier to the UI. */
  it.each([0, -50])('returns 0 for %d rather than NaN', (input) => {
    expect(niceRound(input)).toBe(0);
  });
});

describe('budgetQuickChips', () => {
  it('falls back to 1k/5k/25k when nothing is priced', () => {
    expect(budgetQuickChips([])).toEqual([1000, 5000, 25000]);
  });

  /** Zero, NaN and negatives are not prices. A lot listed at 0 must not drag
   *  the tiers down to nothing — that is the whole reason for the filter. */
  it('ignores unpriced rows and still falls back', () => {
    expect(budgetQuickChips([0, -1, Number.NaN])).toEqual([1000, 5000, 25000]);
  });

  it('adapts to the dearest preview match', () => {
    // max 5000 → top = nice(5000 × 1.2) = 6000.
    // The quarter and half tiers are themselves rounded UP to the next multiple
    // of their own power of ten, so 1500 becomes 2000 — the tiers are always
    // round-looking numbers, never "£1,500 or £3,000 or £6,000".
    expect(budgetQuickChips([1200, 5000])).toEqual([2000, 3000, 6000]);
  });

  /**
   * ⚠️ The de-duplication is load-bearing, not tidiness. On small numbers the
   * rounding collapses tiers onto each other, and two identical chips side by
   * side read as a rendering bug.
   */
  it('never returns a duplicate tier', () => {
    const chips = budgetQuickChips([100]);
    expect(new Set(chips).size).toBe(chips.length);
  });

  it('never returns a zero tier', () => {
    expect(budgetQuickChips([1]).every((n) => n > 0)).toBe(true);
  });
});

describe('fmtBudget', () => {
  it.each([
    [500, '500'],
    [1000, '1k'],
    [25000, '25k'],
    [1_500_000, '1.5m'],
  ])('formats %d as %s', (input, expected) => {
    expect(fmtBudget(input)).toBe(expected);
  });

  /** `+(…).toFixed(2)` exists to drop trailing zeros — "1.5k", never "1.50k". */
  it('drops trailing zeros', () => {
    expect(fmtBudget(1500)).toBe('1.5k');
  });
});

describe('WTB_CONDITION_CODES', () => {
  /**
   * "Any" is the EMPTY selection, never a fourth code. If it ever becomes one,
   * the card would post `condition_wanted: ['any']` and the API would filter
   * every listing out instead of none.
   */
  it('does not contain an "any" code', () => {
    expect(WTB_CONDITION_CODES).not.toContain('any');
  });

  it('is the three the web offers, in order', () => {
    expect(WTB_CONDITION_CODES).toEqual(['new', 'refurbished', 'working']);
  });
});
