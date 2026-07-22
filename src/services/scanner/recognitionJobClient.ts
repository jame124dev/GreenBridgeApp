import Constants from 'expo-constants';
import RNEventSource from 'react-native-sse';

import { greenbidz } from '@/api/greenbidzClient';
import { mapSmartDetection } from '@/features/scanner/mapSmartDetection';
import type {
  MappedSmartDetection,
  SmartDetectionResponse,
} from '@/features/scanner/smartDetectionTypes';
import type { StreamErrorEvent } from '@/features/scanner/smartDetectStreamTypes';
import { getSecureItem } from '@/lib/secureStorage';

import { getSiteType } from './buildFormData';

/**
 * Background recognition-job client — Docs/superpowers/plans/
 * 2026-07-21-mobile-ai-scan-drafts-background.md (Task 5).
 *
 * `POST /recognition-jobs` (create) and `GET /recognition-jobs/:id` (status)
 * are plain `greenbidz` axios calls — auth is attached by the client's
 * interceptor. `GET /recognition-jobs/:id/stream` is a Server-Sent Events
 * tail modelled LINE-FOR-LINE on `smartDetectStream.ts` (same
 * `react-native-sse@1.2.1` transport, same quirks — see that file's header
 * comment for the pinned-behavior notes; not repeated here). The server-side
 * job runs the identical recognition engine as the synchronous v2 stream, so
 * its terminal `result` event is byte-identical to the sync path's — mapped
 * with the SAME `mapSmartDetection(payload, getSiteType())` call so a caller
 * can't tell which transport produced a given `MappedSmartDetection`.
 *
 * Envelope note: `createRecognitionJob` / `getRecognitionJobStatus` assume the
 * same single-level `{ success, data }` envelope verified live for the
 * sibling `/drafts` endpoints (`src/services/drafts/draftApi.ts` — same Node
 * backend). Unlike drafts, this repo has no access to the recognition-jobs
 * controller source to verify directly — flagged in the Task 5 report.
 */

const DEFAULT_WATCHDOG_MS = 45_000;

/** Rejection carrying the backend (or transport) error code so callers can
 *  branch on `retriable` without string-matching — mirrors `SmartDetectStreamError`. */
export class RecognitionJobStreamError extends Error {
  code: string;
  retriable: boolean;
  constructor(message: string, code: string, retriable: boolean) {
    super(message);
    this.name = 'RecognitionJobStreamError';
    this.code = code;
    this.retriable = retriable;
  }
}

// Minimal structural type of the bits of react-native-sse we use, so a fake
// EventSource can be injected in tests without depending on the lib internals
// (same seam shape as smartDetectStream.ts's `SseInstance`/`SseFactory`).
type SseInstance = {
  addEventListener: (type: string, listener: (ev: any) => void) => void;
  removeAllEventListeners: () => void;
  close: () => void;
};

/** Test seam for `tailRecognitionJob` — Tasks 10/11 import this name. */
export type EventSourceFactory = (
  url: string,
  options: Record<string, unknown>,
) => SseInstance;

const defaultFactory: EventSourceFactory = (url, options) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (RNEventSource as any)(url, options) as SseInstance;

function abortError() {
  return new RecognitionJobStreamError('Recognition job tail cancelled', 'cancelled', false);
}

export interface CreateRecognitionJobInput {
  image_urls: string[];
  document_urls?: string[];
  language: string;
  platform: string;
  /**
   * Foreground (on-screen) job — the seller is watching the live result via
   * `tailRecognitionJob`, so the backend DEFERS the pending-ai draft + "ready"
   * bell for this job until a `detachRecognitionJob` call ("Continue in
   * background"). Omit/false for a true background job (original always-persist
   * behavior). See Follow-up #2 (transport-swap).
   */
  foreground?: boolean;
}

export interface RecognitionJobStatus {
  status: 'queued' | 'running' | 'draft_ready' | 'failed';
  draft_id?: string;
  error?: string;
}

/**
 * `POST /recognition-jobs` — starts a server-side background recognition run
 * over already-uploaded image/document URLs (the seller is leaving, or has
 * left, the processing screen). Fast response — just an id to poll/tail.
 *
 * Verified against the live Node controller
 * (`101recycle-greenbidz-backend/controller/recognitionController.js:124`):
 * `res.status(202).json({ success: true, job_id, status: "queued" })` — the
 * body is FLAT (no `data` envelope), unlike the sibling `/drafts` endpoints.
 */
export async function createRecognitionJob(
  input: CreateRecognitionJobInput,
): Promise<{ job_id: string }> {
  const res = await greenbidz.post('/recognition-jobs', input);
  return { job_id: res.data.job_id as string };
}

/**
 * `GET /recognition-jobs/:id` — cheap poll used by the reattach-on-return
 * flow (Task 11).
 *
 * Verified against the live Node controller
 * (`101recycle-greenbidz-backend/controller/recognitionController.js:257`):
 * `res.json({ success: true, status, draft_id, error })` — also a FLAT body,
 * no `data` envelope. The extra `success` field is harmless to carry through.
 */
export async function getRecognitionJobStatus(jobId: string): Promise<RecognitionJobStatus> {
  const res = await greenbidz.get(`/recognition-jobs/${jobId}`);
  return res.data as RecognitionJobStatus;
}

/**
 * `POST /recognition-jobs/:id/detach` — "Continue in background" for a
 * foreground (on-screen) job. Promotes it to a real background job so the
 * backend persists its pending-ai draft + fires the bell (immediately if the
 * run already finished, else on completion). Idempotent server-side. Returns
 * the job's current status + draft_id (null until the draft is persisted).
 */
export async function detachRecognitionJob(
  jobId: string,
): Promise<{ status: string; draft_id: number | null }> {
  const res = await greenbidz.post(`/recognition-jobs/${jobId}/detach`);
  return { status: res.data?.status, draft_id: res.data?.draft_id ?? null };
}

export type TailRecognitionJobOptions = {
  /** Resume a dropped tail after this server-assigned event sequence number. Default 0 (from the start). */
  afterSeq?: number;
  signal?: AbortSignal;
  /** Progress-event sink; NOT called for `heartbeat` (watchdog-only) or `result` (resolves instead). */
  onEvent?: (name: string, data: unknown) => void;
  /** Test seam — inject a fake EventSource. Defaults to react-native-sse. */
  eventSourceFactory?: EventSourceFactory;
  /** Override the heartbeat watchdog (ms). Default 45 000. Additive test seam — not part of the Task 5 brief's opts, kept optional so it can't break callers. */
  watchdogMs?: number;
};

/**
 * `GET /recognition-jobs/:id/stream?after_seq=N` — tails a background job's
 * SSE control plane to its terminal `result` (or a fatal `error`).
 * Structurally identical to `smartDetectStream`'s Promise/settle/watchdog
 * machinery (GET + no body against a different path; everything else — named
 * events, the `settle()`-once pattern, the heartbeat watchdog, abort
 * handling, and the backend-error-vs-transport-error disambiguation — is the
 * same proven idiom, not reinvented).
 */
export async function tailRecognitionJob(
  jobId: string,
  options: TailRecognitionJobOptions = {},
): Promise<MappedSmartDetection> {
  const {
    afterSeq = 0,
    signal,
    onEvent,
    eventSourceFactory,
    watchdogMs = DEFAULT_WATCHDOG_MS,
  } = options;

  // Already-aborted at call time → reject before opening anything.
  if (signal?.aborted) throw abortError();

  const factory = eventSourceFactory ?? defaultFactory;

  // Replicate the axios interceptor + client headers manually — the SSE
  // transport bypasses the axios instance entirely (same as smartDetectStream.ts).
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const [access, refresh] = await Promise.all([
    getSecureItem('auth.accessToken'),
    getSecureItem('auth.refreshToken'),
  ]);
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'x-platform': (extra.SITE_TYPE as string | undefined) ?? 'LabGreenbidz',
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (refresh) headers['x-refresh-token'] = refresh;
  if (extra.X_SYSTEM_KEY) headers['x-system-key'] = String(extra.X_SYSTEM_KEY);

  const baseUrl = (extra.GREENBIDZ_API_URL as string | undefined) ?? '';
  const url = `${baseUrl}/recognition-jobs/${jobId}/stream?after_seq=${afterSeq}`;

  return new Promise<MappedSmartDetection>((resolve, reject) => {
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let es: SseInstance | undefined;

    const cleanup = () => {
      if (watchdog) clearTimeout(watchdog);
      signal?.removeEventListener('abort', onAbort);
      try {
        es?.removeAllEventListeners();
        es?.close();
      } catch {
        /* already closed */
      }
    };

    // Resolve XOR reject, exactly once. Every terminal path goes through here.
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };

    const fail = (message: string, code: string, retriable: boolean) =>
      settle(() => reject(new RecognitionJobStreamError(message, code, retriable)));

    const armWatchdog = () => {
      if (settled) return;
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(
        () => fail('Connection lost', 'connection_lost', true),
        watchdogMs,
      );
    };

    const onAbort = () => settle(() => reject(abortError()));

    const safeOnEvent = (name: string, data: unknown) => {
      if (!onEvent) return;
      // A bug in the UI handler must never poison the in-flight job tail.
      try {
        onEvent(name, data);
      } catch (uiErr) {
        if (__DEV__) console.warn('[recognitionJobClient] onEvent handler threw', uiErr);
      }
    };

    // Backend `error` SSE frame OR a lib transport error — both land here.
    const onErrorChannel = (ev: any) => {
      armWatchdog();
      if (ev?.type === 'timeout') return fail('Connection timed out', 'timeout', true);
      if (ev?.type === 'exception') {
        return fail(ev?.message || 'Stream exception', 'exception', true);
      }

      // Backend `event: error` frame → CustomEvent with a `data` JSON string.
      if (typeof ev?.data === 'string') {
        let payload: StreamErrorEvent | null = null;
        try {
          payload = JSON.parse(ev.data) as StreamErrorEvent;
        } catch {
          payload = null;
        }
        if (payload) {
          safeOnEvent('error', payload);
          if (payload.fatal) {
            return fail(
              payload.message || 'Recognition job failed',
              payload.code || 'fatal',
              !!payload.retriable,
            );
          }
          return; // non-fatal — stream continues toward `result`
        }
      }

      // Lib transport error: message = HTTP responseText, xhrStatus = HTTP code.
      const status: number | undefined = ev?.xhrStatus;
      if (!status) return fail('Connection lost', 'connection_lost', true);

      let serverMsg: string | undefined;
      try {
        serverMsg = (JSON.parse(ev.message) as { message?: string })?.message;
      } catch {
        /* not JSON */
      }
      const code = status === 429 ? 'too_many_concurrent' : `http_${status}`;
      fail(serverMsg || `Recognition job stream failed (${status})`, code, status === 429);
    };

    const onNamed = (name: string, ev: any) => {
      armWatchdog();
      if (name === 'heartbeat') return; // watchdog only — no UI, no onEvent

      if (name === 'result') {
        let payload: SmartDetectionResponse | null = null;
        try {
          payload = JSON.parse(ev.data) as SmartDetectionResponse;
        } catch {
          return fail('Malformed result payload', 'bad_result', false);
        }
        if (!payload?.success) {
          return fail(
            (payload as { message?: string })?.message || 'Recognition job failed',
            'result_unsuccessful',
            false,
          );
        }
        try {
          const mapped = mapSmartDetection(payload, getSiteType());
          return settle(() => resolve(mapped));
        } catch (mapErr) {
          return settle(() => reject(mapErr as Error));
        }
      }

      // stage / detection / product / pdf_pages → forward to UI.
      let data: unknown = null;
      try {
        data = ev?.data ? JSON.parse(ev.data) : null;
      } catch {
        return; // skip an unparseable progress frame; not terminal
      }
      safeOnEvent(name, data);
    };

    // Register abort BEFORE opening, then re-check synchronously to close the
    // attach-race window (consumer aborts between open and listener add).
    signal?.addEventListener('abort', onAbort);
    if (signal?.aborted) return settle(() => reject(abortError()));

    try {
      es = factory(url, {
        method: 'GET',
        headers,
        pollingInterval: 0, // no auto-reconnect (one-shot tail)
      });
    } catch (openErr) {
      return settle(() => reject(openErr as Error));
    }

    es.addEventListener('error', onErrorChannel);
    for (const name of ['stage', 'pdf_pages', 'detection', 'product', 'result', 'heartbeat']) {
      es.addEventListener(name, (ev: any) => onNamed(name, ev));
    }

    armWatchdog();
  });
}
