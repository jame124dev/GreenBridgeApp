/**
 * "Can this seller edit this listing right now, and if not, what do we say?"
 *
 * Pure, so the screen stays a rendering of a decision rather than a pile of
 * inline conditionals — and so the pending-edit rule ("show that state rather
 * than letting them submit a second one") is unit-testable without mounting
 * React Navigation, React Query and a form.
 */

import type { ListingEditResource, ListingPendingEdit } from './listingEditTypes';

export type ListingEditGate =
  | { kind: 'editable' }
  | { kind: 'pendingReview'; pending: ListingPendingEdit }
  | { kind: 'locked'; reason: 'sold' | 'notOwner' | 'unknown' };

/**
 * Precedence, most-final first:
 *   1. sold          — terminal; nothing can be edited, not even to fix a typo
 *   2. not the owner — terminal
 *   3. any other server-side lock
 *   4. an edit already waiting for review — temporary, but blocks a second one
 *   5. editable
 *
 * `is_sold` is checked independently of `editable` on purpose: if the two ever
 * disagree the safe reading is the restrictive one, and "it sold" is a better
 * sentence than the generic lock.
 */
export function resolveEditGate(resource: ListingEditResource | undefined): ListingEditGate {
  if (!resource) return { kind: 'locked', reason: 'unknown' };

  if (resource.is_sold === true || resource.lock_reason === 'sold') {
    return { kind: 'locked', reason: 'sold' };
  }
  if (resource.lock_reason === 'not_owner') {
    return { kind: 'locked', reason: 'notOwner' };
  }
  if (resource.editable === false) {
    return { kind: 'locked', reason: 'unknown' };
  }
  if (resource.pending_edit) {
    return { kind: 'pendingReview', pending: resource.pending_edit };
  }
  return { kind: 'editable' };
}

/**
 * The single primary CTA is live only when there is something to save, the
 * listing is open for edits, and no request is in flight.
 */
export function canSubmitListingEdit(args: {
  gate: ListingEditGate;
  changedCount: number;
  saving: boolean;
}): boolean {
  if (args.gate.kind !== 'editable') return false;
  if (args.saving) return false;
  return args.changedCount > 0;
}
