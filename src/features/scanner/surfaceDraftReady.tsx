import React from 'react';
import { router } from 'expo-router';
import { toast } from 'sonner-native';
import type { QueryClient } from '@tanstack/react-query';

import { NotificationToast } from '@/features/lab/notifications/NotificationToast';
import { resumeDraftById } from '@/features/scanner/useResumeDraft';
import { openMultiItemDraft } from '@/features/v2/scan/openMultiItemDraft';
import { v2ResumeRoute } from '@/features/v2/scan/v2ResumeRoute';
import { draftKeys } from '@/services/drafts/draftHooks';
import { V2_UI_ENABLED } from '@/lib/flags';
import { routes } from '@/lib/routes';

/**
 * The single place a "background recognition draft is ready" becomes visible.
 *
 * A finished job can be reported by MORE THAN ONE delivery layer — the live
 * socket event, an OneSignal foreground push, the polling watcher, and the
 * Home-focus reattach all converge here (see BackgroundRecognitionWatcher +
 * `app/(tabs)/index.tsx`). Funnelling them through one deduped function is what
 * makes the alert fire exactly once no matter which layer wins the race, and
 * keeps the "refresh the drafts list + raise the toast" behaviour identical
 * across all of them.
 */
type TFn = (key: string, opts?: { defaultValue?: string }) => string;

// Exactly-once across the delivery layers, keyed by job id (stable across
// socket/push/poll) or draft id. Module-scoped so every caller shares it.
const surfaced = new Set<string>();
/** Test seam — reset the dedupe memory between cases. */
export function __resetSurfaced(): void {
  surfaced.clear();
}

export interface RecognitionReady {
  jobId?: string | null;
  draftId?: string | number | null;
}

/**
 * Parse the backend's `notification` socket frame emitted by
 * `recognitionRunner.notifyDraftReady`:
 *   `{ kind: 'recognition_ready', draft_id, job_id, notification?: {…} }`
 * (the generic bell handler reads `notification.type === 'recognition'`; we
 * accept either signal). Returns the ready descriptor iff this is a
 * recognition-ready frame, else `null` so non-recognition notifications pass
 * straight through untouched.
 */
export function parseRecognitionReady(payload: unknown): RecognitionReady | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const row =
    p.notification && typeof p.notification === 'object'
      ? (p.notification as Record<string, unknown>)
      : p;
  const isReady = p.kind === 'recognition_ready' || row.type === 'recognition';
  if (!isReady) return null;
  return {
    jobId: p.job_id != null ? String(p.job_id) : undefined,
    draftId: (p.draft_id as string | number | undefined) ?? undefined,
  };
}

function keyOf(ready: RecognitionReady): string {
  return String(ready.jobId ?? ready.draftId ?? '');
}

/** True if `ready` has already been surfaced this session (does not record it). */
export function alreadySurfaced(ready: RecognitionReady): boolean {
  const key = keyOf(ready);
  return !!key && surfaced.has(key);
}

/**
 * Refresh the drafts list (so the finished draft auto-appears on ANY screen)
 * and raise the polished in-app toast (tap → the drafts list). Deduped by
 * job/draft id. Returns `true` iff this call actually surfaced — i.e. it was
 * the first layer to report this job — and `false` for a duplicate.
 */
export function surfaceDraftReady(
  ready: RecognitionReady,
  deps: { queryClient: QueryClient; t: TFn },
): boolean {
  const key = keyOf(ready);
  if (!key || surfaced.has(key)) return false;
  surfaced.add(key);
  if (surfaced.size > 500) surfaced.clear(); // unbounded-growth guard

  // Auto-add: any mounted drafts/listings query refetches → the draft appears.
  deps.queryClient.invalidateQueries({ queryKey: draftKeys.all });

  // Tap "View" → open THIS draft straight into its review editor (the finished
  // background scan is a pending-ai draft, so `resumeDraftById` maps it and
  // pushes the item-review page). Only fall back to the drafts list when we
  // somehow have no draft id to open.
  //
  // ⚠️ THE TOAST IS A DRAFT SURFACE TOO, and it was the one left behind.
  // `SellingPane` and `app/v2/drafts.tsx` both pass a v2 route resolver and
  // `openMultiItemDraft`; this call passed neither, so on a v2 build tapping
  // "View" either dropped the seller into OLD chrome (single item) or failed
  // outright with "Could not open this draft" (multi-item — no `persistedScan`,
  // see the FOURTH SHAPE note in `useResumeDraft`). The document/extract lane
  // makes multi-item the common case: a 9 MB spreadsheet produced an 18-item
  // draft on 2026-09-17, and this toast is exactly how a seller who backgrounded
  // that upload gets back to it.
  //
  // Flag-gated, not unconditional. This function is shared with the SHIPPED UI,
  // and handing it v2 destinations on an old-UI build would walk that seller
  // into v2 mid-journey — the ejection defect in reverse, as
  // `openMultiItemDraft` already records. With the flag off both arguments are
  // `undefined` and the call is byte-identical to what shipped.
  const toastId = `recognition:${key}`;
  const draftId = ready.draftId != null ? String(ready.draftId) : null;
  toast.custom(
    <NotificationToast
      toastId={toastId}
      title={deps.t('mobile.drafts.readyToast', { defaultValue: 'Your draft is ready' })}
      message={deps.t('mobile.drafts.readyToastBody', {
        defaultValue: 'We finished analyzing your upload. Tap to review and publish.',
      })}
      type="recognition"
      onView={() =>
        draftId
          ? void resumeDraftById(
              draftId,
              deps.t,
              V2_UI_ENABLED ? v2ResumeRoute : undefined,
              V2_UI_ENABLED ? openMultiItemDraft : undefined,
            )
          : router.push(V2_UI_ENABLED ? routes.v2Drafts : routes.scanDrafts)
      }
    />,
    { id: toastId, duration: 8000 },
  );
  return true;
}

/**
 * Terminal-failure counterpart — a plain error toast (no draft to link to).
 * Deduped by job id (shares the `surfaced` memory under a `failed:` prefix) so
 * a failure the on-screen processing view already reported can't double-toast
 * if the poll layer independently observes `status === 'failed'` in the race
 * window before the producer clears the id.
 */
export function surfaceDraftFailed(deps: { jobId?: string | null; t: TFn }): void {
  const key = deps.jobId ? `failed:${deps.jobId}` : '';
  if (key) {
    if (surfaced.has(key)) return;
    surfaced.add(key);
  }
  toast.error(
    deps.t('mobile.processing.failed', { defaultValue: 'Recognition failed — try again' }),
  );
}
