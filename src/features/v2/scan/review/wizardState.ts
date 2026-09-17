/**
 * Shared state for the four Review steps — 7b photos → 7c details → 7d pricing
 * → 7e location.
 *
 * t7's brief: *"The single long Review screen is split into four named steps."*
 * The screen it replaces is `app/scan/grouped-review.tsx` (+ `detail.tsx` and
 * `grouped-edit.tsx`). Each step carries a slice of that field set; this file
 * is the only thing all four share.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────────
 *
 *   REVIEW_STEPS          the four steps, in order: key, label, path
 *   TIMELINE_STEPS        the same four as the kit's `Timeline` wants them
 *   reviewStepHref(step, itemIndex)
 *                         where a step lives, carrying `?item=`
 *
 *   useReviewItem()       WHICH item is under review, the live draft, and a
 *                         device-local `patch` — `{ index, item, total, patch }`
 *   stepCompletion(item)  which of the four steps is finished
 *   useStepCompletion(item)  the same, memoised
 *   firstIncompleteStep(c)   the step to send someone back to
 *   stepNeeds(item, step)    one honest line about what a step still wants
 *
 * ── THERE IS DELIBERATELY NO STORE HERE ───────────────────────────────────
 *
 * The draft already lives in `useScanDraft` (Zustand + MMKV) and is what every
 * step reads and writes. A second copy would be two sources of truth for one
 * listing, and the wizard would be the one that lost. What this file adds is
 * only the wizard's own vocabulary: the step order, the "which item" param,
 * and the mapping from validation rows to steps.
 *
 * ── COMPLETION IS DERIVED, NEVER STORED ───────────────────────────────────
 *
 * `stepCompletion` runs `getDraftRequiredStatus` — the SAME `detailSchema`
 * predicate the shipped Submit gate enforces — and buckets its rows into the
 * four steps. So a step cannot claim it is done while Submit would block on
 * it, which is the exact bug the old hub's note R-3 exists to prevent. Adding a
 * required field to `detailSchema` therefore needs a bucket below (or a default
 * in `formMapping.draftToFormValues`); `__tests__/requiredStatusGap.test.ts`
 * already enforces that half of it.
 *
 * ── WRITES ────────────────────────────────────────────────────────────────
 *
 * `patch` is DEVICE-LOCAL: `patchQueuedItem` / `patch` on the scan store, which
 * write Zustand + MMKV and touch no network (see `scanDraftStore.ts:810,894`).
 * Editing a local draft is what a wizard IS, so it is live. Everything that
 * leaves the phone — publish, save-a-draft-to-the-server — is `TODO(v2-writes)`
 * in the screens and inert.
 */
import { useEffect, useMemo } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';

import { getDraftRequiredStatus } from '@/features/scanner/requiredStatus';
import { isRoutingResolved } from '@/features/scanner/routing/routingState';
import { useScanDraft, type DraftItem } from '@/stores/scanDraftStore';

// ── The four steps ─────────────────────────────────────────────────────────

export type ReviewStep = 'photos' | 'details' | 'pricing' | 'location';

export const REVIEW_STEPS: readonly { key: ReviewStep; label: string; path: string }[] = [
  { key: 'photos', label: 'Photos', path: '/v2/scan/review/photos' },
  { key: 'details', label: 'Details', path: '/v2/scan/review/details' },
  { key: 'pricing', label: 'Pricing', path: '/v2/scan/review/pricing' },
  { key: 'location', label: 'Location', path: '/v2/scan/review/location' },
];

/**
 * `STEP 3 OF 4` — the denominator, in one place.
 *
 * ── WHY THIS IS STILL A CONSTANT (`Docs/v2/WEB-PARITY.md` #4) ──────────────
 *
 * The web builds its spine from the draft and mobile does not. An attempt on
 * 2026-09-17 to close that gap by DROPPING the Photos step for a draft with no
 * photos was reverted before it shipped, because it would have built a dead
 * end: `requiredStatus.ts:103` computes
 * `allComplete = rows.photos && parsed.success`, so a photoless draft is
 * unsubmittable no matter what the chrome says. Hiding the step would have
 * removed the only route to the screen that fixes the block, while Submit went
 * on refusing — the same shape as the guest media dead end in the root
 * `CLAUDE.md`.
 *
 * The web's real conditional axis is ITEM COUNT, not photos, and mobile cannot
 * copy it yet: `app/v2/scan/items.tsx` has no route into these four steps, so a
 * batch spine would number a journey nobody can walk. That link is the
 * prerequisite; #4 stays open behind it.
 */
export const REVIEW_STEP_TOTAL = REVIEW_STEPS.length;

/** The kit's `Timeline` takes `{ label, detail? }`; this is the static half. */
export const TIMELINE_STEPS = REVIEW_STEPS.map((s) => ({ label: s.label }));

export function reviewStepIndex(step: ReviewStep): number {
  return REVIEW_STEPS.findIndex((s) => s.key === step);
}

/**
 * Where a step lives, carrying which item it is about.
 *
 * The cast goes through `unknown` because `.expo/types/router.d.ts` is
 * generated by `expo start` and does not know about these files yet. Once it is
 * regenerated the plain `as Href` would work; until then a direct cast is a
 * tsc error, and `expo-router` resolves the string at runtime either way.
 */
export function reviewStepHref(step: ReviewStep, itemIndex: number): Href {
  const found = REVIEW_STEPS[reviewStepIndex(step)];
  return {
    pathname: found?.path ?? REVIEW_STEPS[0].path,
    params: { item: String(itemIndex) },
  } as unknown as Href;
}

// ── Which item, and how to edit it ─────────────────────────────────────────

export type ReviewItem = {
  /**
   * Index into `queuedItems`, or `-1` when the draft under review is the
   * single-product `current` rather than a queue member. Both shapes are real:
   * smart-detect produces a queue, the single-product path produces `current`.
   */
  index: number;
  /** `null` only when there is genuinely nothing to review — a cold open. */
  item: DraftItem | null;
  /** How many items this session is reviewing. `1` for the single path. */
  total: number;
  /** Device-local edit. MMKV + Zustand, no network. */
  patch: (partial: Partial<DraftItem>) => void;
};

export function useReviewItem(): ReviewItem {
  const params = useLocalSearchParams<{ item?: string }>();
  const queuedItems = useScanDraft((s) => s.queuedItems);
  const current = useScanDraft((s) => s.current);
  const hydrated = useScanDraft((s) => s.hydrated);

  /**
   * A cold open — someone deep-linked a step, or the app restarted — has an
   * empty store while MMKV still holds the session. Read it back, but ONLY
   * when there is nothing in memory to lose: `hydrate()` replaces the whole
   * session, so running it over a live queue would clobber edits made this
   * session with whatever was last persisted.
   */
  const nothingInMemory = queuedItems.length === 0 && current === null;
  useEffect(() => {
    if (nothingInMemory && !hydrated) useScanDraft.getState().hydrate();
  }, [nothingInMemory, hydrated]);

  const requested = Number.parseInt(params.item ?? '', 10);

  if (queuedItems.length > 0) {
    const index = Number.isFinite(requested)
      ? Math.min(Math.max(0, requested), queuedItems.length - 1)
      : 0;
    return {
      index,
      item: queuedItems[index] ?? null,
      total: queuedItems.length,
      patch: (partial) => useScanDraft.getState().patchQueuedItem(index, partial),
    };
  }

  return {
    index: -1,
    item: current,
    total: current ? 1 : 0,
    patch: (partial) => useScanDraft.getState().patch(partial),
  };
}

// ── Completion, bucketed by step ───────────────────────────────────────────

export type StepCompletion = Record<ReviewStep, boolean>;

const NOTHING_DONE: StepCompletion = {
  photos: false,
  details: false,
  pricing: false,
  location: false,
};

/**
 * Which steps are finished.
 *
 * Buckets `getDraftRequiredStatus`'s rows — the shipped submit predicate — onto
 * the four steps, plus the one requirement that is not a schema row:
 * `isRoutingResolved` (an unanswered marketplace question), which belongs to
 * 7b because that is the screen that asks it.
 */
export function stepCompletion(item: DraftItem | null): StepCompletion {
  if (!item) return NOTHING_DONE;
  const { rows } = getDraftRequiredStatus(item);
  return {
    photos: rows.photos && isRoutingResolved(item),
    details: rows.title && rows.description && rows.category && rows.condition,
    pricing: rows.price,
    location: rows.location,
  };
}

export function useStepCompletion(item: DraftItem | null): StepCompletion {
  return useMemo(() => stepCompletion(item), [item]);
}

/** The step to send someone back to, or `null` when the listing is ready. */
export function firstIncompleteStep(completion: StepCompletion): ReviewStep | null {
  return REVIEW_STEPS.find((s) => !completion[s.key])?.key ?? null;
}

/** Every required field on every step is filled. What Submit will check. */
export function allStepsComplete(completion: StepCompletion): boolean {
  return REVIEW_STEPS.every((s) => completion[s.key]);
}

export function reviewStepLabel(step: ReviewStep): string {
  return REVIEW_STEPS[reviewStepIndex(step)]?.label ?? '';
}

/**
 * One honest line about what a step still wants, or `undefined` when it is
 * finished. Used for the active row's sub-line on the `Timeline` rail and for
 * the pre-submit banner on 7e, so both say the same thing.
 *
 * Named after the FIELD, not the rule: "Needs a price" is actionable, "price
 * validation failed" is not.
 */
export function stepNeeds(item: DraftItem | null, step: ReviewStep): string | undefined {
  if (!item) return 'Nothing to review yet';
  const { rows } = getDraftRequiredStatus(item);

  if (step === 'photos') {
    if (!rows.photos) return 'Needs at least one photo';
    if (!isRoutingResolved(item)) return 'Needs a marketplace';
    return undefined;
  }
  if (step === 'details') {
    const missing = [
      !rows.title && 'a title',
      !rows.description && 'a description',
      !rows.category && 'a category',
      !rows.condition && 'a condition',
    ].filter((s): s is string => typeof s === 'string');
    return missing.length ? `Needs ${missing.join(', ')}` : undefined;
  }
  if (step === 'pricing') {
    return rows.price ? undefined : 'Needs a price, or switch to Make offer';
  }
  return rows.location ? undefined : 'Needs a pickup address';
}
