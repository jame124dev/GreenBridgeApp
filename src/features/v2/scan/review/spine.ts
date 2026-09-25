/**
 * `spine` — THE step spine for the v2 scan flow. One definition, one order, one
 * resolver, consumed by every screen that draws step chrome.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * `wizardState.ts` declares FOUR steps and every review screen renders "Step N
 * of 4" from `REVIEW_STEP_TOTAL`. That is a fixed count, so the chrome describes
 * a journey the seller may not be on: a draft holding one item has nothing to
 * table and nothing to total, and a draft holding eighteen needs a screen the
 * four-step spine has no room for.
 *
 * The web hit this first and wrote the fix down
 * (`nextjs-port/.../components/scanv2/scanv2Steps.ts`): build the spine from what
 * the draft actually holds, number it contiguously from 1, and never render a
 * fixed total with greyed placeholders. This is that shape, ported.
 *
 * ── WHAT IS DIFFERENT ON MOBILE ────────────────────────────────────────────
 *
 * 1. **Route and Inspection do not exist here.** They configure a scrap lot,
 *    which is composed on the web. Mobile deliberately drops them (WEB-PARITY),
 *    so the batch spine is four steps, not six.
 *
 * 2. **There is a third shape: "not known yet".** This is the one the web does
 *    not need and mobile does. Capture and Analyzing run BEFORE detection has
 *    counted anything — at that moment the flow could resolve to two steps or to
 *    four, and any "of N" is a guess the chrome would present as fact. So
 *    `v2SpineForDraft(null)` returns an EMPTY spine and `v2StepProgress` returns
 *    `null`. A caller cannot accidentally render a denominator it does not have,
 *    because there is no number to render.
 *
 * Pure module: no React, no i18n instance, no side effects. Labels carry an
 * `i18nKey` with the English as the inline fallback, matching the web, because
 * the locale JSONs are owned elsewhere.
 */

/** The numbered steps a seller can walk on mobile. */
export type V2StepKey = 'capture' | 'items' | 'valuation' | 'review' | 'reviewItem';

/** Where the seller is. `'complete'` = past the last numbered step. */
export type V2StepPosition = V2StepKey | 'complete';

/**
 * No `'skipped'`. The web needs it because Route and Inspection exist in its
 * spine but do not apply to every draft; mobile only ever builds steps that will
 * actually render, so a step that does not apply is simply absent.
 */
export type V2StepState = 'done' | 'current' | 'todo';

export type V2StepDef = {
  key: V2StepKey;
  /** 1-based and contiguous. Never a gap, never a placeholder. */
  index: number;
  i18nKey: string;
  label: string;
};

export type V2Step = V2StepDef & { state: V2StepState };

/** The seller's own language for each step. One source for both label and key. */
const V2_STEP_META: Record<V2StepKey, { i18nKey: string; label: string }> = {
  capture: { i18nKey: 'scanv2.steps.intake', label: 'Capture' },
  items: { i18nKey: 'scanv2.steps.detected', label: 'Items' },
  valuation: { i18nKey: 'scanv2.steps.valuation', label: 'Valuation' },
  review: { i18nKey: 'scanv2.steps.review', label: 'Review' },
  reviewItem: { i18nKey: 'scanv2.steps.reviewItem', label: 'Review item' },
};

function buildSpine(keys: readonly V2StepKey[]): V2StepDef[] {
  return keys.map((key, i) => ({ key, index: i + 1, ...V2_STEP_META[key] }));
}

/** A draft holding exactly one item is confirmed on ONE screen. */
export const V2_SINGLE_ITEM_SPINE: readonly V2StepDef[] = buildSpine(['capture', 'reviewItem']);

/** A draft holding several items is tabled, totalled, then reviewed. */
export const V2_BATCH_SPINE: readonly V2StepDef[] = buildSpine([
  'capture',
  'items',
  'valuation',
  'review',
]);

/**
 * The spine for a draft, from its item count.
 *
 * `null` means detection has not finished and the count is genuinely unknown —
 * it returns an empty spine on purpose. Callers rendering chrome should treat an
 * empty spine as "show the phase name and a continuous bar, with no numbers".
 */
export function v2SpineForDraft(itemCount: number | null): readonly V2StepDef[] {
  if (itemCount === null) return [];
  return itemCount > 1 ? V2_BATCH_SPINE : V2_SINGLE_ITEM_SPINE;
}

/** 1-based position of `position` within `spine`, or 0 when it is not in it. */
export function v2StepIndex(position: V2StepPosition, spine: readonly V2StepDef[]): number {
  if (spine.length === 0) return 0;
  if (position === 'complete') return spine.length;
  return spine.find((s) => s.key === position)?.index ?? 1;
}

/**
 * `{ active, total }` for the "Step N of M" line — or **`null` when there is no
 * honest total**, which is the whole point of this module. Never returns a
 * guessed denominator.
 */
export function v2StepProgress(
  position: V2StepPosition,
  spine: readonly V2StepDef[],
): { active: number; total: number } | null {
  if (spine.length === 0) return null;
  return { active: v2StepIndex(position, spine), total: spine.length };
}

/**
 * Progress across a WHOLE review, not one item's worth of it.
 *
 * ── THE DEFECT THIS FIXES ──────────────────────────────────────────────────
 *
 * The four review sub-steps (Photos · Details · Pricing · Location) are walked
 * once PER ITEM. A seller reviewing three items therefore walks twelve screens,
 * and the header counted each pass on its own: `Step 1 of 4 … Step 4 of 4`,
 * then straight back to `Step 1 of 4` with the bar snapping from full to a
 * quarter. Three times. Finishing an item looked like losing your place.
 *
 * `itemTotal` is the number of items being reviewed, so the honest denominator
 * for a batch is `itemTotal × stepTotal` and the honest numerator counts the
 * items already finished. A single-item draft is the same arithmetic with
 * `itemTotal = 1`, which reduces to exactly what the header showed before —
 * so nothing changes for the common case.
 *
 * Pure, and separate from the component, because a percentage that resets is
 * invisible to a render test and obvious in one table of numbers.
 *
 * ⛔ **DELIBERATELY NOT WIRED. Do not connect this to `StepHeader` on its own.**
 *
 * It was, on 2026-09-22, and was reverted the same day for two reasons a fresh
 * read found:
 *
 *  1. **It changed nothing.** `itemTotal` is always 1 — `analyzing.tsx:704-709`
 *     routes every multi-product detection to the OLD grouped flow, and
 *     `openDetectedItem` (the v2 route in) is not called from anywhere yet. The
 *     batch branch was unreachable.
 *  2. **Wired alone it would be a regression.** There is no "next item" control
 *     in the four review screens — the only way past item 1 is to press Submit
 *     and be refused. A bar promising twelve screens, in a UI with no forward
 *     path past four, is chrome describing a journey nobody can walk: the exact
 *     defect the top of this file says the spine exists to end.
 *
 * Wire it **together with** the item transition (task `SCANV2_V2UI_14` →
 * `SCANV2_V2UI_03`), not before. Kept with its tests because the arithmetic is
 * right and the next person should not re-derive it.
 */
export function v2ReviewProgress(opts: {
  /** 1-based sub-step within the current item. */
  stepNumber: number;
  /** How many sub-steps each item has. */
  stepTotal: number;
  /** Zero-based position in the queue; `-1` for a single-product draft. */
  itemIndex: number;
  /** How many items this review covers. */
  itemTotal: number;
}): { value: number; total: number; percent: number } {
  const stepTotal = Math.max(1, opts.stepTotal);
  const itemTotal = Math.max(1, opts.itemTotal);
  // `-1` is the single-product draft, which is item one.
  const itemIndex = Math.min(Math.max(opts.itemIndex, 0), itemTotal - 1);
  const stepNumber = Math.min(Math.max(opts.stepNumber, 1), stepTotal);

  const total = itemTotal * stepTotal;
  const value = itemIndex * stepTotal + stepNumber;

  return { value, total, percent: Math.round((value / total) * 100) };
}

/** The spine with each step stamped `done` / `current` / `todo`. */
export function resolveV2Steps(
  position: V2StepPosition,
  spine: readonly V2StepDef[],
): V2Step[] {
  const active = v2StepIndex(position, spine);
  const allDone = position === 'complete';

  return spine.map((s) => ({
    ...s,
    state: allDone || s.index < active ? 'done' : s.index === active ? 'current' : 'todo',
  }));
}
