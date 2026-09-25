// useResumeDraft — the shared "open a saved draft" action, extracted VERBATIM
// from app/scan/drafts.tsx so the drafts LIST and the Home "Your items" draft
// rows resume identically (DRY — one branch tree, one place to change).
//
// Flow: `getDraft(id)` → branch on the FETCHED payload:
//   • lab draft   → hydrate the lab thread + push the lab draft screen.
//   • pending-ai  → map the background result + take processing-v2's apply/route.
//   • form-blob   → hydrate the scan store + pick the resume screen by state.
// `resumeDraftById` is the hook-independent core (usable from a non-component
// caller — e.g. the background-draft-ready toast's "View"); `useResumeDraft`
// wraps it with the list-row spinner state.
import { useCallback, useState } from 'react';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { getDraft, type FormBlobPayload } from '@/services/drafts/draftApi';
import {
  isValuationDraftPayload,
  persistedScanFromValuation,
} from '@/services/drafts/valuationDraft';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { mapPendingAiDraft } from '@/services/drafts/pendingAiResume';
import { getSiteType } from '@/services/scanner/buildFormData';
import { shouldSkipDetectionChoice } from '@/features/scanner/smartDetectionRouting';
import { useScanDraft } from '@/stores/scanDraftStore';
import { getScanResumeRoute, type ScanResumeState } from '@/lib/scanResume';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';
import { isLabDraft, labResumeRoute } from '@/features/lab/labResumeRoute';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useThread } from '@/features/lab/stores/threadStore';

/** i18n `t` shape the resume flow needs (defaultValue fallback only). */
type ResumeT = (key: string, opts?: { defaultValue?: string }) => string;

/**
 * Open a saved draft by id — the hook-independent core of `useResumeDraft`, so
 * a NON-component caller (the "View" action on the background-draft-ready toast,
 * see `surfaceDraftReady`) opens the draft straight into its review editor,
 * exactly like tapping its card. Everything here is callable outside React
 * (global `router`/`toast`/`haptics` + zustand `getState()`); only the list-row
 * spinner state lives in the hook wrapper below. Swallows errors with a toast
 * (never throws) so callers don't each need a catch.
 */
/**
 * Where a resumed SELLER-SCAN draft should land.
 *
 * Defaults to `getScanResumeRoute`, i.e. the shipped screens. v2's Home passes
 * its own so a draft opened from v2 stays in v2 — see `v2SingleResumeRoute`.
 */
export type ResumeRouteResolver = (state: ScanResumeState) => Href;

export async function resumeDraftById(
  id: string,
  t: ResumeT,
  routeFor: ResumeRouteResolver = getScanResumeRoute,
  onMultiItem?: MultiItemHandler,
): Promise<void> {
  haptics.tap();
  try {
    const detail = await getDraft(id);

    /**
     * FOURTH SHAPE: a MULTI-ITEM draft — from the document/extract lane or the
     * web. It has no `persistedScan` and no `labDraft`, so every branch below
     * would reject it and the seller got "Could not open this draft". On a real
     * account that is now the common case: one 9 MB spreadsheet produced a
     * draft with 18 items (2026-09-17).
     *
     * It cannot be hydrated into the scan-draft store at all: that store, and
     * the whole review flow behind it, hold exactly ONE item
     * (`features/v2/scan/review/wizardState.ts` → `useReviewItem`). A multi-item
     * draft needs its own screen, which is `app/v2/scan/items.tsx`.
     *
     * ⚠️ OPT-IN, and that is the point. This hook is shared with the SHIPPED
     * UI — it is called from the old drafts list too — so pushing a `/v2` route
     * from in here would walk an old-UI seller into v2 mid-journey. That is the
     * same defect class as the sign-in ejection fixed on 2026-09-16, in
     * reverse. The caller supplies the destination or there is none: with no
     * handler this branch does not fire and behaviour is byte-identical.
     */
    if (onMultiItem && isMultiItemDraft(detail)) {
      // Awaited — v2's handler now fetches every row and hydrates the
      // grouped-review queue before navigating (2026-09-25), which is real
      // async work the caller's spinner (`resumingId`) should stay up for,
      // the same as every other branch below.
      await onMultiItem(id, itemCountOf(detail));
      return;
    }

    if (isLabDraft(detail)) {
      // (lab) draft — branch to the lab draft screen instead of the seller
      // scan-form hydrate below. `payload.mode` (sell/buy, NOT the draft's
      // top-level 'single'/'multi' mode) drives the composer mode;
      // `payload.labDraft` is the raw frame `buildLabDraftPayload` captured
      // from `turn.draft` at save time (Task 12).
      const p = detail.payload as { mode?: 'sell' | 'buy'; labDraft?: unknown };
      const labMode: 'sell' | 'buy' = p.mode === 'buy' ? 'buy' : 'sell';
      useComposer.getState().setMode(labMode);
      // `reset()`, not `startTurn()`: `startTurn()` sets `turn.state` to
      // 'STREAMING', and nothing here ever opens a real stream to carry it to a
      // terminal frame — that state would be stuck forever, silently no-op'ing
      // the NEXT chat send. `reset()` gives a clean IDLE turn; the reducer's
      // `data` case never touches `state`, so applying the frame leaves
      // `turn.status === 'idle'` while still setting `turn.draft`.
      useThread.getState().reset();
      useThread.getState().applyFrame({
        type: 'data',
        data: { type: labMode === 'buy' ? 'wtb_draft' : 'listing_draft', data: p.labDraft },
      });
      router.push(labResumeRoute() as never);
      return;
    }

    // ⚠️ DELIBERATELY UNGATED. Everything below routes into the seller scan flow
    // (`/scan/detail`, `/scan/grouped-review`, `/scan/detection`, or `/scan/camera`
    // for a draft with no photos), and resuming your own saved draft to keep
    // working on it must stay open — a draft you were allowed to create is a draft
    // you are allowed to edit. Seller approval is enforced when the draft is
    // SUBMITTED; see `@/features/seller/sellerSubmitGate`.
    const kind = (detail.payload as { kind?: string } | undefined)?.kind;
    if (kind === 'pending-ai') {
      // Background-recognition draft (Follow-up #1): the server persisted the
      // raw AI `result` + canonical GCS image URLs. `mapPendingAiDraft` runs
      // the SAME `mapSmartDetection` transform the live v2 stream uses, then we
      // take the IDENTICAL apply/route path as `processing-v2.tsx`'s onSuccess.
      // `null` → not resumable (still processing / no images).
      const r = mapPendingAiDraft(detail.payload, getSiteType());
      if (!r) {
        toast.info(
          t('mobile.drafts.pendingAiNotReady', {
            defaultValue: 'This draft is still processing — check back soon.',
          }),
        );
        return;
      }
      const store = useScanDraft.getState();
      if (shouldSkipDetectionChoice(r.mapped, r.sourcePhotos.length)) {
        const m = await store.applySmartDetection(r.mapped, r.sourcePhotos);
        // if/else, not a ternary — behaviour identical. Two `Href`s in one
        // expression makes TypeScript resolve expo-router's generated route
        // union across both branches, and that union is past the limit now that
        // `app/v2/scan/` carries more screens than when this file was committed
        // (`TS2590`, `typedRoutes: true`).
        if (m === 'single') {
          router.push(routes.scanDetail);
        } else {
          router.push(routes.scanGroupedReview);
        }
      } else {
        // Ambiguous → the 2-step detection wizard, which reads its photos off
        // `current`. Establish that draft FIRST (start() clears any stale
        // pendingDetection), THEN stash the mapped detection.
        await store.start(r.sourcePhotos);
        store.setPendingDetection(r.mapped);
        router.push(routes.scanDetection);
      }
      return;
    }

    // THIRD SHAPE: a draft written by greenbidz.com/valuation. It has neither
    // `labDraft` (so `isLabDraft` above rejected it) nor `persistedScan` (so
    // the form-blob hydrate below would throw). Before this branch existed,
    // every valuation-sourced draft failed with "Could not open this draft" —
    // which on a real seller account was ALL of them.
    if (isValuationDraftPayload(detail.payload)) {
      await useScanDraft.getState().hydrateFromServer(persistedScanFromValuation(detail.payload));
      router.push(routeFor(useScanDraft.getState()));
      return;
    }

    const blob = hydrateScanDraftFromPayload(detail.payload as FormBlobPayload);
    await useScanDraft.getState().hydrateFromServer(blob);
    router.push(routeFor(useScanDraft.getState()));
  } catch (err) {
    // The toast is right for the USER — it says what happened and loses
    // nothing. But swallowing the error entirely made this undiagnosable: on a
    // real account every draft row failed here and there was no way to see why
    // without editing this file. A dev-only log costs nothing in production and
    // turns "could not open this draft" into an actual lead.
    // The toast is right for the USER — it says what happened and loses
    // nothing. But swallowing the error entirely made this undiagnosable.
    //
    // ⚠️ KNOWN FAILURE, found 2026-09-15 on a real seller account: every draft
    // failed here with `draft payload missing persistedScan`. The payload was
    // `{source, created_at, scanv2, ready_to_list, ready_to_list_at}` — a
    // ScanV2 (web seller flow) draft. That is a THIRD shape this function does
    // not handle: `isLabDraft()` rejects it (no `mode`/`labDraft`) and the scan
    // branch below cannot hydrate it (no `persistedScan`). Mobile currently has
    // no path for a draft created on the web. See `Docs/V2_CHECKLIST.md`.
    if (__DEV__) console.warn('[resumeDraft] failed', err);
    haptics.error();
    toast.error(t('mobile.drafts.resumeFailed', { defaultValue: 'Could not open this draft' }));
  }
}

/**
 * Called instead of hydrating when the draft holds more than one item.
 * See the FOURTH SHAPE note in `resumeDraftById`.
 */
export type MultiItemHandler = (draftId: string, itemCount: number) => void | Promise<void>;

/** How many items the draft holds. Absent or unparseable counts as one. */
function itemCountOf(detail: { product_count?: unknown }): number {
  const n = Number(detail?.product_count);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * More than one item ⇒ no single-item screen can show it — UNLESS the draft
 * is `payload.kind === 'pending-ai'`, whose items were never going to be in
 * `gb_listing_draft_items` in the first place.
 *
 * Found 2026-09-25 on a real 10-item draft (id 273, product_count=10):
 * `count > 1` was true, `onMultiItem` (`openMultiItemDraft`) ran, its
 * `listAllDraftItems` correctly returned zero rows, and the seller saw
 * "This draft has no items yet" — for a draft whose 10 products were sitting
 * right there the whole time, in `payload.result.products`. Two producers
 * report the count identically but store the items in incompatible places:
 * the newer durable extract worker (`gb_recognition_jobs.kind === 'extract'`,
 * `payload.kind === 'scanv2-extract-header'`) writes one `gb_listing_draft_items`
 * row per unit; the older "legacy" smart-detect path (still live for a
 * document/spreadsheet upload, `payload.kind === 'pending-ai'`) writes the
 * whole detection result straight into the draft's own `payload` blob and
 * never touches that table at all. The `kind === 'pending-ai'` branch further
 * down in `resumeDraftById` already reads `payload.result` via
 * `mapPendingAiDraft` and already routes a multi-item result to
 * `scanGroupedReview` — it was just unreachable, shadowed by this check
 * firing first on product_count alone.
 */
function isMultiItemDraft(detail: { product_count?: unknown; payload?: unknown }): boolean {
  const kind = (detail.payload as { kind?: string } | undefined)?.kind;
  if (kind === 'pending-ai') return false;
  return itemCountOf(detail) > 1;
}

export function useResumeDraft(routeFor?: ResumeRouteResolver, onMultiItem?: MultiItemHandler) {
  const { t } = useTranslation();
  const [resumingId, setResumingId] = useState<string | null>(null);

  const resume = useCallback(
    async (id: string) => {
      setResumingId(id);
      try {
        await resumeDraftById(id, t, routeFor, onMultiItem);
      } finally {
        setResumingId(null);
      }
    },
    [t, routeFor, onMultiItem],
  );

  return { resume, resumingId };
}
