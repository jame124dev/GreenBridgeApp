import { getStoredJobId, clearStoredJobId } from '@/stores/recognitionJobStore';
import { getRecognitionJobStatus, tailRecognitionJob } from '@/services/scanner/recognitionJobClient';
import type { MappedSmartDetection } from '@/features/scanner/smartDetectionTypes';

/**
 * Reattach-on-return (Task 11) — Docs/superpowers/plans/
 * 2026-07-21-mobile-ai-scan-drafts-background.md.
 *
 * Runs on Home focus (flag-gated by `backgroundRecognitionEnabled()`, wired in
 * `app/(tabs)/index.tsx`) to pick back up a "Continue in background" job the
 * seller left running (`app/scan/processing.tsx`'s `handleContinueInBackground`
 * → `startBackgroundRecognition` → `storeJobId`). Reads the MMKV-stored job
 * id and either short-circuits on a status the server already knows
 * (`draft_ready` / `failed`) or re-tails the SSE control-plane stream to its
 * terminal `result`/`error`, exactly like the on-screen path would have.
 */
export type ReattachOutcome = 'none' | 'ready' | 'running' | 'failed';

export interface ReattachRecognitionDeps {
  /** Progress-event sink forwarded to `tailRecognitionJob` while re-tailing a still-running job. */
  onEvent?: (name: string, data: unknown) => void;
  /** Fired with the final mapped result once a re-tailed job's stream resolves. */
  onResult?: (result: MappedSmartDetection) => void;
}

export async function reattachRecognition(
  deps: ReattachRecognitionDeps,
): Promise<ReattachOutcome> {
  const jobId = getStoredJobId();
  if (!jobId) return 'none';

  let status;
  try {
    status = await getRecognitionJobStatus(jobId);
  } catch {
    // Transient network/status-check failure — keep the id, a later focus
    // (or the next app open) retries the whole reattach flow from scratch.
    return 'running';
  }

  if (status.status === 'draft_ready') {
    // The job already finished server-side and its draft exists — nothing
    // left to tail. Task 6/2's `/drafts` list is the source of truth from
    // here; the caller just needs to know to refresh it.
    clearStoredJobId();
    return 'ready';
  }
  if (status.status === 'failed') {
    clearStoredJobId();
    return 'failed';
  }

  // queued | running → re-tail the SSE control-plane to its terminal event.
  try {
    const result = await tailRecognitionJob(jobId, { afterSeq: 0, onEvent: deps.onEvent });
    clearStoredJobId();
    deps.onResult?.(result);
    return 'running';
  } catch {
    // Dropped connection / watchdog timeout / etc. — NOT a job failure. Keep
    // the stored id so a later focus retries the tail instead of losing track
    // of a job that may still finish successfully server-side.
    return 'running';
  }
}
