/**
 * PUBLISH — the write that turns v2's review flow from a walkthrough into the
 * app.
 *
 * Until now `app/v2/scan/review/location.tsx` ended at a notice reading
 * "Publishing is not connected in this build — nothing was sent." Every other
 * `TODO(v2-writes)` was survivable; this one meant a seller could walk all four
 * steps and list nothing.
 *
 * ── WHY ONE HOOK AND NOT A HANDLER IN THE SCREEN ───────────────────────────
 *
 * There are exactly TWO ways a listing reaches the backend and they hit
 * DIFFERENT endpoints, which is why `sellerSubmitGate.ts` opens by naming both:
 *
 *   queue (2+ items) → `useSubmitGroupedListing` → POST /wp/create-grouped-listings
 *   single (`current`) → `useCreateListing`      → POST /wp/create-product-direct
 *
 * The shipped app gates each at its own call site, in two files, with two
 * copies of the same three lines — and its own comment says "miss either and
 * the gate is decorative". v2 has one review flow that serves both shapes
 * (`useReviewItem` reads `queuedItems` OR `current`), so the fork belongs here,
 * once, where it cannot be half-applied.
 *
 * ── THE TWO GATES, IN THIS ORDER ───────────────────────────────────────────
 *
 * 1. `requireAuth('sell', …)` — publishing is genuinely account-based. Note it
 *    gates ONLY this action: viewing and editing a local draft stay open to a
 *    guest, which is the whole point of `requireAuth` living at the point of
 *    use rather than at the door (App Review 5.1.1(v)).
 * 2. `canSubmitListing()` → `redirectToSellerApplication()`. Approval is
 *    required to SUBMIT, not to author.
 *
 * ⚠️ BOTH BEFORE THE FIELD SWEEP, and that ordering is copied deliberately from
 * `grouped-review.tsx:155`: when the tap is about to take someone to the seller
 * form, nagging them about an unfilled price on the way is noise. Their draft
 * is untouched in `useScanDraft` and still there when they come back.
 *
 * ── WHAT IT REFUSES TO DO ──────────────────────────────────────────────────
 *
 * It will not submit an incomplete item. The sweep runs the SAME predicate the
 * step chrome shows (`stepCompletion` → `getDraftRequiredStatus`), so the
 * blocker names the item, the step and the missing field in the wizard's own
 * words instead of surfacing a 400 from the server. It reads the LIVE store,
 * not a React snapshot, because a value typed a moment ago may not have
 * re-rendered this screen yet.
 */
import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { toast } from 'sonner-native';

import { requireAuth } from '@/features/auth/requireAuth';
import { canSubmitListing, redirectToSellerApplication } from '@/features/seller/sellerSubmitGate';
import { getDraftRequiredStatus } from '@/features/scanner/requiredStatus';
import { isRoutingResolved } from '@/features/scanner/routing/routingState';
import { useCreateListing } from '@/features/scanner/useCreateListing';
import { useSubmitGroupedListing } from '@/features/scanner/useSubmitGroupedListing';
import { useScanDraft, type DraftItem } from '@/stores/scanDraftStore';
import { haptics } from '@/lib/haptics';

import { firstIncompleteStep, stepCompletion, stepNeeds, type ReviewStep } from './wizardState';
import { useServerDraft } from './useSaveDraft';

/** Why a publish did not happen, in terms the review flow already uses. */
export interface PublishBlock {
  /** Index into the queue, or `-1` for the single-product draft. */
  itemIndex: number;
  /** How many items the session holds — so the message can say "2 of 3". */
  itemTotal: number;
  /** The step that would fix it. */
  step: ReviewStep;
  /** "Needs a price, or switch to Make offer". */
  needs: string;
}

/**
 * Where a successful publish lands.
 *
 * ⚠️ `/v2`, NOT the shipped success screen. `routes.scanSuccess(...)` exists and
 * is richer — it carries the batch number — but it is drawn in the OLD chrome,
 * and dropping a seller out of v2 at the most triumphant moment is the exact
 * complaint that has been reported repeatedly ("it goes back to the previous
 * version"). Home is honest about the outcome: the listing appears under LIVE
 * LISTINGS as "In review", which is what actually happened.
 *
 * The canvas has no success artboard — `docs/v2-design/screens/` runs 6a–6f and
 * 7a–7e — so a v2 success screen would be a new design rather than a copy.
 * Until that decision is made this is the landing, in one place so it is one
 * edit to change.
 */
function landAfterPublish(itemCount: number): void {
  toast.success(
    itemCount > 1
      ? `${itemCount} listings sent for review`
      : 'Your listing was sent for review',
  );
  router.replace('/v2');
}

/** Everything this session would publish: the queue, or the single draft. */
function itemsToPublish(): DraftItem[] {
  const s = useScanDraft.getState();
  if (s.queuedItems.length > 0) return s.queuedItems;
  return s.current ? [s.current] : [];
}

/**
 * The same bar Submit has always enforced — photos, the schema, and a resolved
 * marketplace — asked per item so the caller can say WHICH one is short.
 */
function firstIncompleteItem(items: readonly DraftItem[]): PublishBlock | null {
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (!it) continue;
    const ready =
      getDraftRequiredStatus(it).allComplete &&
      (it.photos?.length ?? 0) > 0 &&
      isRoutingResolved(it);
    if (ready) continue;

    const step = firstIncompleteStep(stepCompletion(it)) ?? 'photos';
    return {
      itemIndex: items.length > 1 ? i : -1,
      itemTotal: items.length,
      step,
      needs: stepNeeds(it, step) ?? 'Needs more information',
    };
  }
  return null;
}

export interface PublishState {
  publish: () => void;
  isPending: boolean;
  /** A server or network failure, already human-readable. */
  error: string | null;
  /** An item that is not ready. Never set at the same time as `error`. */
  blocked: PublishBlock | null;
  /** Dismiss whichever of the two is showing. */
  clear: () => void;
}

export function usePublishDraft(): PublishState {
  const submitGrouped = useSubmitGroupedListing();
  const createListing = useCreateListing();
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<PublishBlock | null>(null);

  const isPending = submitGrouped.isPending || createListing.isPending;

  const clear = useCallback(() => {
    setError(null);
    setBlocked(null);
  }, []);

  const publish = useCallback(() => {
    if (isPending) return;
    setError(null);
    setBlocked(null);

    // GATE 1 — signed in. A guest gets the sheet and lands back here.
    requireAuth('sell', () => {
      // GATE 2 — approved to sell. Before the sweep, on purpose.
      if (!canSubmitListing()) {
        haptics.tap();
        redirectToSellerApplication();
        return;
      }

      const items = itemsToPublish();
      if (items.length === 0) {
        setError('There is nothing to publish yet.');
        return;
      }

      const short = firstIncompleteItem(items);
      if (short) {
        haptics.error();
        setBlocked(short);
        return;
      }

      haptics.impact();

      const onSuccess = (count: number) => () => {
        haptics.success();
        // AFTER the network call, never before: resetting first would leave a
        // seller with an empty store and a failed submit.
        useScanDraft.getState().reset();
        // And drop the server draft's identity with it. Left behind, the NEXT
        // listing's first "Save as draft" would PATCH the draft just published
        // instead of creating a new one.
        useServerDraft.getState().clear();
        landAfterPublish(count);
      };
      const onError = (err: unknown) => {
        haptics.error();
        setError((err as Error)?.message || 'Could not publish. Nothing was sent.');
      };

      // ONE decision, made from the live store: a queue goes to the grouped
      // endpoint, a lone `current` to the single one.
      if (useScanDraft.getState().queuedItems.length > 0) {
        submitGrouped.mutate(
          {
            items,
            visibility: useScanDraft.getState().sessionVisibility,
            // Not accepted by `/wp/create-grouped-listings`; carried for shape
            // parity, exactly as the shipped caller does.
            networkSellers: [],
          },
          { onSuccess: onSuccess(items.length), onError },
        );
        return;
      }

      createListing.mutate(items[0], { onSuccess: onSuccess(1), onError });
    });
  }, [isPending, submitGrouped, createListing]);

  return { publish, isPending, error, blocked, clear };
}
