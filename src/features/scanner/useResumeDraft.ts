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
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { getDraft, type FormBlobPayload } from '@/services/drafts/draftApi';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { mapPendingAiDraft } from '@/services/drafts/pendingAiResume';
import { getSiteType } from '@/services/scanner/buildFormData';
import { shouldSkipDetectionChoice } from '@/features/scanner/smartDetectionRouting';
import { useScanDraft } from '@/stores/scanDraftStore';
import { getScanResumeRoute } from '@/lib/scanResume';
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
export async function resumeDraftById(id: string, t: ResumeT): Promise<void> {
  haptics.tap();
  try {
    const detail = await getDraft(id);

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
        router.push(m === 'single' ? routes.scanDetail : routes.scanGroupedReview);
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

    const blob = hydrateScanDraftFromPayload(detail.payload as FormBlobPayload);
    await useScanDraft.getState().hydrateFromServer(blob);
    const route = getScanResumeRoute(useScanDraft.getState());
    router.push(route);
  } catch {
    haptics.error();
    toast.error(t('mobile.drafts.resumeFailed', { defaultValue: 'Could not open this draft' }));
  }
}

export function useResumeDraft() {
  const { t } = useTranslation();
  const [resumingId, setResumingId] = useState<string | null>(null);

  const resume = useCallback(
    async (id: string) => {
      setResumingId(id);
      try {
        await resumeDraftById(id, t);
      } finally {
        setResumingId(null);
      }
    },
    [t],
  );

  return { resume, resumingId };
}
