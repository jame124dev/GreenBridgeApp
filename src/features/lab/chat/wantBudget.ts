/**
 * Budget maths for a "want to buy" draft — the quick-tier chips and their
 * labels.
 *
 * ── WHY THIS IS ITS OWN FILE ──
 *
 * It was three private functions inside `cards.tsx`, and v2 now needs the same
 * numbers for its own want card. Copying them would have produced two versions
 * of a rule the buyer sees as money, free to drift apart — the same trap the
 * valuation helpers were pulled out of. JSX-free, so it is testable without a
 * renderer, which the originals were not.
 *
 * Behaviour is unchanged: `cards.tsx` imports these instead of declaring them.
 * Ported from the web's `budgetQuickChips` / `nice()`.
 */

/** Round UP to a "nice" magnitude: 100→100, 4200→5000, 0→0. */
export function niceRound(v: number): number {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

/**
 * Three quick-budget tiers.
 *
 * Adaptive when the preview matches carry prices — a ceiling 20% above the
 * dearest, then a quarter and a half of it — so the chips are in the same
 * world as the equipment actually on offer. With nothing priced to read, the
 * static 1k/5k/25k fallback.
 *
 * De-duplicated, because rounding collapses tiers on small numbers (a £120 top
 * gives 100/100/200, and two identical chips read as a bug).
 */
export function budgetQuickChips(prices: number[]): number[] {
  const priced = prices.filter((n) => Number.isFinite(n) && n > 0);
  if (priced.length === 0) return [1000, 5000, 25000];
  const top = niceRound(Math.max(...priced) * 1.2);
  const tiers = [niceRound(top * 0.25), niceRound(top * 0.5), top];
  return [...new Set(tiers)].filter((n) => n > 0);
}

/** Compact money label for a budget chip: 25000→"25k", 1500000→"1.5m". */
export function fmtBudget(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(2)}m`;
  if (v >= 1000) return `${+(v / 1000).toFixed(2)}k`;
  return String(v);
}

/**
 * The condition codes a buyer can ask for, in the order they are offered.
 *
 * An EMPTY selection means "Any" — it is not a fourth code. The card sends
 * `condition_wanted: undefined` in that case, which is what the API reads as
 * unconstrained.
 */
export const WTB_CONDITION_CODES = ['new', 'refurbished', 'working'] as const;
