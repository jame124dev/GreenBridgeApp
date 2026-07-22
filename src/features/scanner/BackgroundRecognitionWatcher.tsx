import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { getLabSocket, joinRooms } from '@/features/lab/messages/socket';
import { registerForegroundPushHandler } from '@/lib/onesignal';
import { getRecognitionJobStatus } from '@/services/scanner/recognitionJobClient';
import {
  clearStoredJobId,
  getStoredJobId,
} from '@/stores/recognitionJobStore';
import { backgroundRecognitionEnabled, draftsEnabled } from '@/lib/flags';
import { useAuth } from '@/stores/authStore';
import {
  parseRecognitionReady,
  surfaceDraftFailed,
  surfaceDraftReady,
} from '@/features/scanner/surfaceDraftReady';

/** How often the poll layer re-checks a stored background job (ms). */
const POLL_MS = 5000;

/**
 * App-wide "your background draft finished" watcher — mounted once at the root
 * (`app/_layout.tsx`) so a completed recognition job surfaces on ANY screen,
 * with NO navigate-back required. Fixes the old behaviour where the only thing
 * that refreshed the list + toasted was a `useFocusEffect` on the Home tab.
 *
 * Three converging delivery layers, all funnelled through the deduped
 * `surfaceDraftReady` (exactly-once no matter which wins):
 *
 *   1. SOCKET (instant)  — the backend emits `notification`
 *      `{ kind: 'recognition_ready', draft_id, job_id }` to the seller's room
 *      the moment it persists the draft (recognitionRunner.notifyDraftReady).
 *   2. ONESIGNAL PUSH    — a foreground `recognition_draft_ready` push (needs
 *      FCM/APNs credentials live; harmless no-op otherwise).
 *   3. POLL (fallback)   — while a job id is stored, re-check its status; the
 *      reliable catch-all when the socket dropped or push isn't delivered.
 *
 * Headless — renders nothing. Gated by the same flags + sign-in as the rest of
 * the drafts feature, so it's inert unless background recognition is on.
 */
export function BackgroundRecognitionWatcher(): null {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuth((s) => s.profile?.id);
  const enabled = draftsEnabled() && backgroundRecognitionEnabled() && userId != null;

  // ── Layer 3: poll the stored job ──────────────────────────────────────────
  // Cheap: the GET only fires while an id is stored (on-screen scans store one
  // for the duration + clear it on their own terminal state). Only a REAL
  // background draft surfaces — a deferred foreground job finishes `draft_ready`
  // with a null `draft_id`, so the `draftId != null` guard skips it (the seller
  // is watching that result on-screen; it isn't a background surprise).
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const tick = async () => {
      const jobId = getStoredJobId();
      if (!jobId) return;
      try {
        const status = await getRecognitionJobStatus(jobId);
        if (stopped) return;
        if (status.status === 'draft_ready') {
          // Terminal — clear FIRST so an app-kill between clear and surface
          // can't re-toast this draft next boot (the drafts list still shows
          // it). A REAL background draft has a non-null draft_id and surfaces;
          // a deferred foreground job that was never detached stays
          // `draft_ready` with a null draft_id FOREVER (detach happens only
          // from the processing screen, which holds its own job ref), so we
          // must still clear it — else the poll would run every 5s forever,
          // across restarts (MMKV-persisted id). This is the fix for the
          // infinite-poll / app-killed-mid-scan case.
          const draftId = status.draft_id;
          clearStoredJobId();
          if (draftId != null) {
            surfaceDraftReady({ jobId, draftId }, { queryClient, t });
          }
        } else if (status.status === 'failed') {
          clearStoredJobId();
          surfaceDraftFailed({ jobId, t });
        }
        // queued | running → leave the id; the next tick re-checks.
      } catch {
        // Transient status-check failure — keep the id; the next tick retries.
      }
    };

    void tick(); // immediate check on mount / re-enable (covers cold start)
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [enabled, queryClient, t]);

  // ── Layer 1: live socket event ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || userId == null) return;
    const socket = getLabSocket();

    // Recognition is seller-scoped (backend emits to `seller_<id>`).
    const join = () => joinRooms(userId, 'seller');

    const onNotification = (payload: unknown) => {
      const ready = parseRecognitionReady(payload);
      if (!ready) return; // non-recognition notifications: not ours
      // Clear FIRST (before surfacing) and ONLY if the stored id is THIS job —
      // an unconditional clear would wipe an unrelated in-flight foreground
      // job's id, killing its poll fallback. Clearing before surface also
      // closes the app-kill re-toast window.
      if (ready.jobId && getStoredJobId() === ready.jobId) clearStoredJobId();
      surfaceDraftReady(ready, { queryClient, t });
    };

    socket.on('connect', join);
    if (socket.connected) join();
    socket.on('notification', onNotification);
    return () => {
      socket.off('connect', join);
      socket.off('notification', onNotification);
    };
  }, [enabled, userId, queryClient, t]);

  // ── Layer 2: OneSignal foreground push ─────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    return registerForegroundPushHandler(({ jobId, draftId }) => {
      // Same match-guarded, clear-first discipline as the socket layer.
      if (jobId && getStoredJobId() === jobId) clearStoredJobId();
      surfaceDraftReady({ jobId, draftId }, { queryClient, t });
    });
  }, [enabled, queryClient, t]);

  return null;
}
