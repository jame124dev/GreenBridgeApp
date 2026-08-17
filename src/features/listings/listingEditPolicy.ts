/**
 * Client-side mirror of the backend's review policy
 * (`services/listingEditPolicy.js`, env `LISTING_EDIT_MODE`).
 *
 * WHY A MIRROR EXISTS
 * -------------------
 * The product requirement is that a seller sees WHICH of their edits will need
 * approval *while they are editing*, not after they save. The pinned GET
 * response carries no policy information, so the app cannot learn the server's
 * mode from the contract. This module is therefore a CONFIG TABLE, not
 * hardcoded branching — the same three modes, the same two buckets — so that
 * flipping the owner's decision (A / B / C) stays a config change on both
 * sides.
 *
 * Source of truth order:
 *   1. `edit_mode` on the GET response, IF the backend ever starts sending it
 *      (forward-compat; not in the pinned contract).
 *   2. `extra.LISTING_EDIT_MODE` from app config / EAS env.
 *   3. `split` — the contract's documented default.
 *
 * The PATCH response (`applied` / `pending_review`) is always authoritative and
 * is what the seller is shown AFTER saving, so a stale mirror can only ever
 * mislabel a badge, never mis-report an outcome.
 */

import Constants from 'expo-constants';

export type ListingEditMode = 'split' | 'instant' | 'review_all';

export type ReviewOutcome = 'instant' | 'review';

export const LISTING_EDIT_MODES: ListingEditMode[] = ['split', 'instant', 'review_all'];

/**
 * `split` (Option C) buckets, verbatim from the contract.
 *
 * `brand` and `condition` are the two contract fields the policy text names in
 * NEITHER bucket. REVIEW FIX: both are held for review here, which is what the
 * shipped backend does — `SPLIT_INSTANT_FIELDS` in
 * `services/listingEditPolicy.js` lists description / extra_content / quantity
 * / location / operation_status / grade and nothing else, so everything else
 * editable falls through to review. Putting `brand` in the instant bucket made
 * the pre-save badge promise "Live right away" for a field the server holds.
 * Keep these two lines in step with that file.
 */
export const SPLIT_INSTANT_FIELDS = [
  'description',
  'quantity',
  'specs',
  'extra_content',
  'location',
  'operation_status',
  'grade',
] as const;

export const SPLIT_REVIEW_FIELDS = [
  'title',
  'price_per_unit',
  'price_format',
  'price_currency',
  'category_id',
  'category_name',
  'images',
] as const;

const INSTANT_SET = new Set<string>(SPLIT_INSTANT_FIELDS);
const REVIEW_SET = new Set<string>(SPLIT_REVIEW_FIELDS);

function isListingEditMode(v: unknown): v is ListingEditMode {
  return typeof v === 'string' && (LISTING_EDIT_MODES as string[]).includes(v);
}

/**
 * Resolve the mode the UI should label fields with.
 *
 * @param serverMode `edit_mode` from the GET response, when present.
 */
export function resolveEditMode(serverMode?: string | null): ListingEditMode {
  if (isListingEditMode(serverMode)) return serverMode;
  const configured = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.LISTING_EDIT_MODE;
  if (isListingEditMode(configured)) return configured;
  return 'split';
}

/**
 * What happens to a change to `field` under `mode`.
 *
 * Unknown fields default to `review` under `split`: over-promising ("this goes
 * live now") and then holding it is the worse of the two failure modes.
 */
export function reviewOutcomeFor(field: string, mode: ListingEditMode): ReviewOutcome {
  if (mode === 'instant') return 'instant';
  if (mode === 'review_all') return 'review';
  if (INSTANT_SET.has(field)) return 'instant';
  if (REVIEW_SET.has(field)) return 'review';
  return 'review';
}

export interface PolicySplit {
  instant: string[];
  review: string[];
}

/** Partition contract field names into the two buckets, preserving input order. */
export function splitByPolicy(fields: readonly string[], mode: ListingEditMode): PolicySplit {
  const instant: string[] = [];
  const review: string[] = [];
  for (const f of fields) {
    if (reviewOutcomeFor(f, mode) === 'review') review.push(f);
    else instant.push(f);
  }
  return { instant, review };
}

/** True when ANY field in the group needs approval under `mode`. */
export function groupNeedsReview(fields: readonly string[], mode: ListingEditMode): boolean {
  return fields.some((f) => reviewOutcomeFor(f, mode) === 'review');
}
