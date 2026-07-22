import React from 'react';
import { router } from 'expo-router';
import { toast } from 'sonner-native';
import type { QueryClient } from '@tanstack/react-query';

import { NotificationToast } from '@/features/lab/notifications/NotificationToast';
import { draftKeys } from '@/services/drafts/draftHooks';
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

  const toastId = `recognition:${key}`;
  toast.custom(
    <NotificationToast
      toastId={toastId}
      title={deps.t('mobile.drafts.readyToast', { defaultValue: 'Your draft is ready' })}
      message={deps.t('mobile.drafts.readyToastBody', {
        defaultValue: 'We finished analyzing your upload. Tap to review and publish.',
      })}
      type="recognition"
      onView={() => router.push(routes.scanDrafts)}
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
