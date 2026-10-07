/**
 * THE END OF THE SCAN FLOW — "saved to your inventory", for everyone.
 *
 * Work order: `todo/PRIVATE_INVENTORY_WORKORDER.md` §4.1 + Task 5. The scan used
 * to end in "publish", which meant a pending seller photographed the equipment,
 * waited on the AI, reviewed the draft — and was refused at the last press. It
 * now ends in a save, which needs no approval and so cannot refuse anyone.
 * Submitting is a separate act, and it is the ONLY thing approval gates.
 *
 * Two screens end the flow and both use this hook, so they cannot drift:
 *   7e `app/v2/scan/review/location.tsx`   — the single-item wizard
 *   `app/v2/scan/submit.tsx`               — the multi-item review
 *
 * ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────
 *
 * It does not decide who may publish. `canSubmit` is `canSubmitListing()`,
 * read verbatim; the hook only SUBSCRIBES to that predicate's inputs so the
 * screen re-renders when they arrive. A second opinion here is how a button
 * starts disagreeing with the gate behind it. `usePublishDraft` still runs the
 * gate itself on every press.
 *
 * ── THE TWO LANES ──────────────────────────────────────────────────────────
 *
 * `useServerDraft` says which one this session is on:
 *   · no id                — a fresh scan (`local-1`). Nothing is on the server
 *                            yet, so saving CREATES the `gb_listing_drafts` row.
 *   · id + updatedAt       — saved earlier in this session. Saving UPDATES it.
 *   · id, empty updatedAt  — a server draft opened by `openDetectedItem`
 *                            (`openDetectedItem.ts:342`). The row is already in
 *                            the inventory; there is no concurrency token to
 *                            PATCH with, and a create would make a duplicate.
 *                            So nothing is written — see `alreadyOnServer`.
 */
import { useCallback } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { requireAuth } from '@/features/auth/requireAuth';
import { canSubmitListing } from '@/features/seller/sellerSubmitGate';
import { useSellerUpgradeStatus } from '@/features/seller/useSellerUpgrade';
import { useSellerStatus } from '@/features/seller/useSellerStatus';
import { useScanDraft } from '@/stores/scanDraftStore';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';

import { usePublishDraft, type PublishState } from './usePublishDraft';
import { useSaveDraft, useServerDraft } from './useSaveDraft';

/** A server draft this session opened rather than created — see the lane note above. */
function alreadyOnServer(): boolean {
  const { id, updatedAt } = useServerDraft.getState();
  return !!id && !updatedAt;
}

export interface InventoryEnding {
  /** Save and land on the inventory. Never gated on approval — only on sign-in. */
  saveToInventory: () => void;
  /** Save, then publish. Draw its control only when `canSubmit`. */
  submitForListing: () => void;
  /** `canSubmitListing()`, re-read whenever its inputs change. */
  canSubmit: boolean;
  isSaving: boolean;
  /** The publish state, for the blocked / error notices the screens already draw. */
  publish: PublishState;
}

export function useInventoryEnding(): InventoryEnding {
  const { t } = useTranslation();
  const saveDraft = useSaveDraft();
  const publish = usePublishDraft();

  /*
    Subscriptions only — their return values are deliberately unused. The gate
    reads the query cache imperatively, which never re-renders anything; these
    two observe the same keys (and fetch them for a signed-in user, which v2
    needs because `SellerGatePrewarm` is mounted only in the (lab) layout), so
    the Submit control appears the moment an approval is known.
  */
  useSellerUpgradeStatus();
  useSellerStatus();
  const canSubmit = canSubmitListing();

  const busy = saveDraft.isSaving || publish.isPending;
  const { persist } = saveDraft;
  const { publish: runPublish } = publish;

  const saveToInventory = useCallback(() => {
    if (busy) return;
    haptics.tap();

    requireAuth('draft', () => {
      void (async () => {
        if (!alreadyOnServer()) {
          const ok = await persist();
          if (!ok) {
            haptics.error();
            // Says what did NOT happen and what to do. The store is untouched,
            // so pressing again retries the same save.
            toast.error(
              t('mobile.scanv2.inventory.saveFailed', {
                defaultValue: 'Could not save to your inventory. Your items are still here — try again.',
              }),
            );
            return;
          }
        }

        haptics.success();
        /*
          ⚠️ §4.2 — never imply a draft publishes itself on approval. It does
          not; the seller comes back and submits. The pending wording says
          exactly that, and the approved one promises nothing at all.
        */
        toast.success(
          canSubmitListing()
            ? t('mobile.scanv2.inventory.saved', { defaultValue: 'Saved to your inventory' })
            : t('mobile.scanv2.inventory.savedPending', {
                defaultValue: "Saved to your inventory. You choose what to list once you're approved.",
              }),
        );

        /*
          Same retirement as a successful publish (`usePublishDraft.ts:316-322`),
          for the same reason: left behind, the server id makes the NEXT scan's
          first save PATCH this draft instead of creating a new one.
        */
        useScanDraft.getState().reset();
        useServerDraft.getState().clear();

        // Same stack handling as `landAfterPublish`: pop the wizard, then push,
        // so Back from the inventory goes Home rather than into an emptied step.
        if (router.canDismiss()) router.dismissAll();
        router.push(routes.v2Drafts);
      })();
    });
  }, [busy, persist, t]);

  const submitForListing = useCallback(() => {
    if (busy) return;

    requireAuth('sell', () => {
      void (async () => {
        /*
          §4.1 — "both write the same draft; one additionally calls submit". So
          the item is in the inventory first, and `usePublishDraft` then marks
          that row published (`usePublishDraft.ts:311-314`) — it shows under
          "Listed" instead of vanishing.

          Only when the gate will pass: otherwise `publish()` is about to send
          them to the application, and a silent save on the way is a write they
          did not ask for. A failed save does NOT stop the publish — the listing
          is what they pressed for, and today's publish never needed the row.
        */
        if (canSubmitListing() && !alreadyOnServer()) {
          await persist();
        }
        runPublish();
      })();
    });
  }, [busy, persist, runPublish]);

  return {
    saveToInventory,
    submitForListing,
    canSubmit,
    isSaving: saveDraft.isSaving,
    publish,
  };
}
