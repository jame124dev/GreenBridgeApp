/**
 * "Submit for listing" from a row of My inventory — the mobile half of the
 * web's per-draft submit (`Submissions.tsx`, "Submit for listing: eligibility").
 *
 * ── WHY A SEPARATE HOOK AND NOT A CALL TO `usePublishDraft` ────────────────
 *
 * `usePublishDraft` publishes whatever is in the scan store right now
 * (`itemsToPublish()` reads `useScanDraft`). That is right at the end of a
 * scan, where the store IS the draft. From a LIST row the store holds nothing,
 * or worse, holds a different draft. So the work here is entirely about
 * getting the right draft into the store first, and then handing over to the
 * one publish path rather than writing a second one.
 *
 * ⚠️ THE DUPLICATE-LISTING TRAP, WHICH THIS CODE SITS DIRECTLY ON TOP OF.
 * `usePublishDraft` retires the server row by reading
 * `useServerDraft.getState().id` after a successful publish — without it the
 * row stays `active`, the seller sees it under "In my inventory" for ever, and
 * submitting it again lists the same equipment TWICE (see the RETIRE THE
 * SERVER DRAFT note there). Resume does NOT seed that store — it only hydrates
 * the items. So this hook marks the identity itself, immediately after
 * hydrating, and that `mark()` is load-bearing: drop it and every submit from
 * this screen becomes a duplicate waiting to happen.
 *
 * ── WHAT IT REFUSES TO PUBLISH, AND WHY THAT IS NOT A STUB ─────────────────
 *
 * Only the single-item form-blob shape is published from here. A lab draft, a
 * pending-AI draft, a valuation draft, a multi-item draft and a ScanV2 draft
 * made on the web each need their own editor to even open — `resumeDraftById`
 * carries that whole branch tree, including the known gap where a web-made
 * draft cannot be opened on mobile at all. Re-deriving any of that here would
 * be a second copy of the hardest function in the scan flow.
 *
 * For those the press still does something useful: it opens the draft, which
 * is exactly the web's "Open to submit" fallback for a draft it cannot publish
 * straight from the list.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { getDraft, type DraftSummary, type FormBlobPayload } from '@/services/drafts/draftApi';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { useScanDraft } from '@/stores/scanDraftStore';
import { haptics } from '@/lib/haptics';

import { useServerDraft } from '@/features/v2/scan/review/useSaveDraft';
import { usePublishDraft, type PublishState } from '@/features/v2/scan/review/usePublishDraft';

/** How many items a draft holds. Absent or unparseable counts as one. */
function itemCount(d: { product_count?: unknown }): number {
  const n = Number(d.product_count);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * True when the payload is the shape `hydrateScanDraftFromPayload` understands.
 * Mirrors the check `resumeDraftById` makes before its own scan branch — a
 * payload without `persistedScan` is a lab / pending-AI / ScanV2 draft and
 * throws there rather than hydrating.
 */
function isFormBlobScan(payload: unknown): payload is FormBlobPayload {
  return !!payload && typeof payload === 'object' && 'persistedScan' in payload;
}

export interface SubmitFromInventory {
  /** Press handler for one row. Resolves once the publish has been attempted. */
  submit: (draft: DraftSummary) => Promise<void>;
  /** The row currently being loaded or published, for its spinner. */
  submittingId: string | null;
  /** The shared publish state, so the screen can draw the blocked / error notice. */
  publish: PublishState;
}

/**
 * @param openDraft Fallback for a draft this hook will not publish — the same
 *   resume the card's own tap uses, passed in so the screen keeps ONE opening
 *   path rather than this hook growing a second one.
 */
export function useSubmitFromInventory(
  openDraft: (id: string) => void | Promise<void>,
): SubmitFromInventory {
  const { t } = useTranslation();
  const publish = usePublishDraft();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  /** The row the current publish attempt belongs to, so a block can open IT. */
  const attemptedId = useRef<string | null>(null);

  /*
   * A BLOCKED SUBMIT MUST NOT BE A DEAD PRESS.
   *
   * At the end of a scan the review screen is already showing the item, so
   * `blocked` can just render a notice there. From a list there is nothing on
   * screen to fix, so the row would simply do nothing — the seller presses
   * Submit and the app appears to ignore them.
   *
   * So: say what is missing, then open that draft at the step that fixes it.
   * `UX_DESIGN_RULES.md` asks for error recovery with a next step, and this is
   * the only screen where the next step is somewhere else.
   */
  useEffect(() => {
    const blocked = publish.blocked;
    if (!blocked) return;
    const id = attemptedId.current;
    publish.clear();
    attemptedId.current = null;
    haptics.error();
    toast.info(t('mobile.scanv2.inventory.submitNeeds', { needs: blocked.needs }));
    if (id) void openDraft(id);
  }, [publish, openDraft, t]);

  useEffect(() => {
    if (!publish.error) return;
    const message = publish.error;
    publish.clear();
    attemptedId.current = null;
    haptics.error();
    toast.error(message);
  }, [publish]);

  const submit = useCallback(
    async (draft: DraftSummary) => {
      if (submittingId) return;
      setSubmittingId(draft.id);
      haptics.tap();
      try {
        // Multi-item drafts go to their own review screen — the single-item
        // store cannot represent them, and `openMultiItemDraft` is what knows
        // where they belong.
        if (itemCount(draft) > 1) {
          toast.info(t('mobile.scanv2.inventory.openToSubmit'));
          await openDraft(draft.id);
          return;
        }

        const detail = await getDraft(draft.id);
        if (!isFormBlobScan(detail.payload)) {
          toast.info(t('mobile.scanv2.inventory.openToSubmit'));
          await openDraft(draft.id);
          return;
        }

        await useScanDraft.getState().hydrateFromServer(
          hydrateScanDraftFromPayload(detail.payload),
        );
        /*
         * BEFORE `publish()`, never after: the publish reads this id in its own
         * success handler to retire the row. See the trap note at the top.
         * `updated_at` comes from the row we just fetched, so a later "save"
         * in the same session PATCHes rather than creating a duplicate.
         */
        useServerDraft.getState().mark(draft.id, detail.updated_at ?? '');

        attemptedId.current = draft.id;
        publish.publish();
      } catch (err) {
        if (__DEV__) console.warn('[submitFromInventory] failed', err);
        haptics.error();
        toast.error(t('mobile.scanv2.inventory.submitFailed'));
      } finally {
        setSubmittingId(null);
      }
    },
    [openDraft, publish, submittingId, t],
  );

  return { submit, submittingId, publish };
}
