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
import { useMarkDraftPublished } from '@/services/drafts/draftHooks';

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
 * What a publish mutation hands back.
 *
 * Both paths return it: `useCreateListing` gives `{ batchPk, batchNumber,
 * productId }` and `useSubmitGroupedListing` gives the same plus `itemCount`,
 * `groupId` and `items`. Typed structurally and narrowly here because this hook
 * needs exactly one field out of either.
 */
type PublishResult = {
  batchNumber?: number | null;
  /** The single batch's primary key — all `useCreateListing` returns. */
  batchPk?: number | string | null;
  /** The grouped path returns one id per batch it created. */
  batchIds?: (number | string)[] | null;
};

/**
 * What to hand `PATCH /drafts/:id/published` as `published_batch_ids`.
 *
 * The two publish paths disagree in shape and both have to be covered: the
 * grouped mutation returns `batchIds`, the single one returns one `batchPk`.
 * Empty when neither is present — the draft is still marked published, which is
 * the part that stops it reappearing.
 */
function publishedBatchIds(res: PublishResult | undefined): string[] {
  if (res?.batchIds?.length) return res.batchIds.map(String);
  return res?.batchPk == null ? [] : [String(res.batchPk)];
}

/**
 * Where a successful publish lands.
 *
 * ⚠️ This used to be `/v2` with a toast, and that **threw the batch number
 * away** — `onSuccess` took only a count and ignored the mutation's response.
 * The batch number is what a seller quotes when they ask about their listing
 * later, so losing it loses the one fact the moment was for.
 *
 * It does NOT go to `routes.scanSuccess(...)`, which is richer and also carries
 * the number, because that screen is drawn in the OLD chrome — and dropping a
 * seller out of v2 at the most triumphant moment is the complaint that has been
 * raised repeatedly ("it goes back to the previous version").
 *
 * One place, so it stays one edit to change.
 */
function landAfterPublish(
  itemCount: number,
  batchNumber: number | null | undefined,
  titles: readonly string[],
): void {
  toast.success(
    itemCount > 1
      ? `${itemCount} listings sent for review`
      : 'Your listing was sent for review',
  );

  /**
   * ⚠️ DISMISS THE WIZARD FIRST, then PUSH — neither half is optional.
   *
   * The four review steps `push` each other, so at publish time the stack is
   * `[/v2, review/photos, review/details, review/pricing, review/location]`.
   * A bare `replace` swapped only the last frame, leaving three wizard screens
   * underneath — and the store has just been reset, so each one renders its
   * cold-open "Nothing to review yet". One back-press from "Sent for review"
   * replaced it with "there is nothing to review", three times over.
   *
   * `dismissAll()` pops back to `/v2`, and a `push` then leaves `[/v2,
   * published]` so Back goes Home. A `replace` after the dismiss would instead
   * leave `[published]` alone, and Back would quit the app.
   *
   * Guarded: `dismissAll()` throws when there is nothing to dismiss, which is
   * the case if publish is ever called from a screen that was not pushed.
   */
  if (router.canDismiss()) router.dismissAll();

  router.push({
    pathname: '/v2/scan/published',
    params: {
      count: String(itemCount),
      // Omitted rather than stringified to "null": the screen assembles its
      // receipt line from what it actually has.
      ...(batchNumber == null ? {} : { batchNumber: String(batchNumber) }),
      /**
       * JSON-encoded titles so the screen can show WHAT was submitted, not just
       * how many. Same shape and the same sizing rationale as the shipped
       * `routes.scanSuccess` (`src/lib/routes.ts:111`): a few hundred bytes per
       * submission (≤10 products × ~50 char title), well under URL limits.
       *
       * They are read from the local drafts rather than the response because
       * only the grouped mutation returns per-item rows; the single one does
       * not, and the screen should behave the same either way.
       */
      ...(titles.length ? { titles: JSON.stringify(titles) } : {}),
    },
  });
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
  const markPublished = useMarkDraftPublished();
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

      /**
       * Read now, while the drafts are still in the store. `onSuccess` resets
       * it, so anything the success screen needs has to be captured here.
       */
      const titles = items.map((it) => it.title).filter((t) => t.trim().length > 0);

      const onSuccess = (count: number) => (res: PublishResult) => {
        haptics.success();

        /**
         * ⛔ NO `invalidateQueries` HERE, AND THE REASON IS A CORRECTION.
         *
         * A line invalidating `['scanner','recentSubmissions']` stood here, on
         * the stated grounds that the landing (`app/v2/listings.tsx` →
         * `useRecentSubmissions`, `staleTime: 60_000`) would otherwise serve a
         * cache older than the publish. **That premise was false.** Both
         * mutations already invalidate it, through a named helper:
         *
         *   `useCreateListing.ts:64`       → `invalidateRecentSubmissions(profile?.id)`
         *   `useSubmitGroupedListing.ts:97` → the same
         *   `invalidateRecentSubmissions.ts:8` → `invalidateQueries({ queryKey:
         *        ['scanner','recentSubmissions', id, siteType] })` — itself a
         *        prefix, so it already covers every `limit`.
         *
         * It was "checked" with `grep invalidateQueries` on the two mutation
         * files, which finds nothing because the call goes through the helper.
         * A negative grep is not evidence of absence — the workspace rule says
         * to prove the probe can find the thing when it IS present, and that
         * step was skipped.
         *
         * Left as a comment rather than deleted silently because the same false
         * conclusion was written into CLAUDE.md, MISTAKES.md and a memory, and
         * the next person to read this file should know the cache is already
         * handled upstream.
         */

        /**
         * ⚠️ RETIRE THE SERVER DRAFT — the fix for a duplicate-listing path.
         *
         * Read BEFORE the clear below, which throws the id away.
         *
         * Without this the backend row stays `status: 'active'`, and both
         * drafts surfaces filter on exactly that — so the draft the seller just
         * published sits under "Your drafts" for ever. Tapping it resumes the
         * same items, and publishing again lists the same equipment TWICE.
         *
         * Fire-and-forget on purpose: the listing is already live, so a failure
         * here must not turn a successful publish into an error. The cost of
         * the PATCH failing is the stale row it was going to fix, not a lost
         * listing. `useMarkDraftPublished` invalidates `draftKeys.all` itself,
         * which is why no invalidation is written here.
         */
        const serverDraftId = useServerDraft.getState().id;
        if (serverDraftId) {
          markPublished.mutate({ id: serverDraftId, batchIds: publishedBatchIds(res) });
        }

        // AFTER the network call, never before: resetting first would leave a
        // seller with an empty store and a failed submit.
        useScanDraft.getState().reset();
        // And drop the server draft's identity with it. Left behind, the NEXT
        // listing's first "Save as draft" would PATCH the draft just published
        // instead of creating a new one.
        useServerDraft.getState().clear();
        // Captured BEFORE the store reset above — after it there are no titles
        // left to show.
        landAfterPublish(count, res?.batchNumber, titles);
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
  }, [isPending, submitGrouped, createListing, markPublished]);

  return { publish, isPending, error, blocked, clear };
}
