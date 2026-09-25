/**
 * The step spine is BUILT, never fixed.
 *
 * Task: `todo/SCANV2_V2UI_01_SPINE.md`.
 *
 * The failure this gate exists to prevent is the one the web already fixed and
 * wrote down: chrome that describes a journey the seller is not on. On mobile it
 * has THREE shapes, and the third is the one that is easy to miss —
 *
 *   • one item   → Capture · Review item                      (2 steps)
 *   • N items    → Capture · Items · Valuation · Review        (4 steps)
 *   • not yet known → NO TOTAL AT ALL
 *
 * That last case is not cosmetic. Capture and Analyzing run BEFORE the AI has
 * counted anything, so "of 2" is a promise the app may break the moment the scan
 * returns eighteen items. The spine therefore has to be able to say "I do not
 * know yet" — which is why `v2StepProgress` returns `null` rather than a number
 * with a guessed denominator.
 *
 * Route and Inspection are deliberately absent: a scrap lot is composed on the
 * web, not on mobile (WEB-PARITY).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  resolveV2Steps,
  v2ReviewProgress,
  v2SpineForDraft,
  v2StepProgress,
  type V2StepKey,
} from '../spine';

const ROOT = join(__dirname, '..', '..', '..', '..', '..', '..');

function keysOf(spine: readonly { key: V2StepKey }[]): V2StepKey[] {
  return spine.map((s) => s.key);
}

describe('v2 scan step spine', () => {
  it('walks a single-item draft through Capture and Review item', () => {
    const spine = v2SpineForDraft(1);

    expect(keysOf(spine)).toEqual(['capture', 'reviewItem']);
    expect(v2StepProgress('reviewItem', spine)).toEqual({ active: 2, total: 2 });
  });

  it('walks a multi-item draft through Capture, Items, Valuation and Review', () => {
    const spine = v2SpineForDraft(18);

    expect(keysOf(spine)).toEqual(['capture', 'items', 'valuation', 'review']);
    expect(v2StepProgress('items', spine)).toEqual({ active: 2, total: 4 });
    expect(v2StepProgress('review', spine)).toEqual({ active: 4, total: 4 });
  });

  /**
   * ⚑ THE ONE THAT MATTERS. Before detection returns, the count is unknowable,
   * so there is no honest denominator. `null` is the only correct answer — a
   * number here is a guess the chrome would present as fact.
   */
  it('refuses to invent a total before the item count is known', () => {
    const spine = v2SpineForDraft(null);

    expect(spine).toEqual([]);
    expect(v2StepProgress('capture', spine)).toBeNull();
  });

  it('numbers contiguously from 1, with no gaps', () => {
    for (const count of [1, 4, 18]) {
      const spine = v2SpineForDraft(count);
      expect(spine.map((s) => s.index)).toEqual(spine.map((_, i) => i + 1));
    }
  });

  it('never includes Route or Inspection — those are composed on the web', () => {
    for (const count of [1, 2, 50]) {
      const keys = keysOf(v2SpineForDraft(count)) as string[];
      expect(keys).not.toContain('route');
      expect(keys).not.toContain('inspection');
    }
  });

  it('stamps done / current / todo against the position', () => {
    const spine = v2SpineForDraft(18);
    const steps = resolveV2Steps('valuation', spine);

    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo']);
  });

  it('marks every step done once the flow is complete', () => {
    const spine = v2SpineForDraft(1);
    expect(resolveV2Steps('complete', spine).every((s) => s.state === 'done')).toBe(true);
  });
});

/**
 * The spine is only honest if nothing bypasses it. `REVIEW_STEP_TOTAL` is the
 * old fixed count; a screen that reads it is rendering "of 4" regardless of what
 * the draft holds, which is exactly the bug.
 */
describe('nothing under app/v2/scan renders a fixed total', () => {
  function tsxUnder(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
      for (const entry of readdirSync(d)) {
        const p = join(d, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(p);
      }
    };
    walk(dir);
    return out;
  }

  it('does not import REVIEW_STEP_TOTAL', () => {
    const offenders = tsxUnder(join(ROOT, 'app', 'v2', 'scan'))
      .filter((p) => /REVIEW_STEP_TOTAL/.test(readFileSync(p, 'utf8')))
      .map((p) => p.slice(ROOT.length + 1).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});

/**
 * Reviewing three items is TWELVE screens, not three runs of four.
 *
 * The header counted each item's pass on its own, so finishing item 1 sent the
 * bar from 100% back to 25% — twice, for a three-item draft. Found by a review
 * pass; a render test cannot see it because every individual frame is correct.
 */
describe('v2ReviewProgress', () => {
  it('never goes backwards across a multi-item review', () => {
    const seen: number[] = [];
    for (let item = 0; item < 3; item += 1) {
      for (let step = 1; step <= 4; step += 1) {
        seen.push(
          v2ReviewProgress({ stepNumber: step, stepTotal: 4, itemIndex: item, itemTotal: 3 })
            .percent,
        );
      }
    }

    // Strictly increasing — the property the old maths broke.
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    expect(seen[seen.length - 1]).toBe(100);
  });

  it('counts finished items, not just the current one', () => {
    // Item 2 of 3, on Pricing (3 of 4) ⇒ 7 of 12.
    const p = v2ReviewProgress({ stepNumber: 3, stepTotal: 4, itemIndex: 1, itemTotal: 3 });

    expect(p.value).toBe(7);
    expect(p.total).toBe(12);
    expect(p.percent).toBe(58);
  });

  /** The common case must be untouched: one item reduces to the old numbers. */
  it('is unchanged for a single-item draft', () => {
    const p = v2ReviewProgress({ stepNumber: 3, stepTotal: 4, itemIndex: -1, itemTotal: 1 });

    expect(p.value).toBe(3);
    expect(p.total).toBe(4);
    expect(p.percent).toBe(75);
  });

  it('clamps nonsense instead of reporting over 100%', () => {
    const p = v2ReviewProgress({ stepNumber: 99, stepTotal: 4, itemIndex: 99, itemTotal: 3 });

    expect(p.percent).toBe(100);
    expect(p.value).toBeLessThanOrEqual(p.total);
  });
});
