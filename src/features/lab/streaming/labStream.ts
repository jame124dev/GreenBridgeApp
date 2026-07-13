import RNEventSource from 'react-native-sse';

import { getAiBaseUrl } from '@/lib/env';
import { getSecureItem } from '@/lib/secureStorage';

import type {
  LabDataEvent,
  LabDoneEvent,
  LabErrorEvent,
  LabHeartbeatEvent,
  LabStageEvent,
  LabStreamEvent,
  LabTokenEvent,
  LabWarningEvent,
} from './labStreamTypes';
import { LAB_STREAM_EVENT_NAMES } from './labStreamTypes';

/**
 * Generic Server-Sent Events transport for the (lab) customer-app AI streams —
 * the ASSISTANT `POST /chat/stream` and `POST /detect/stream`
 * (NewVersion/dynamic/03-api-contract.md §1/§2.2, 04-mobile-integration-plan.md
 * §1.5, 08-hardening-addendum.md §C).
 *
 * Adapted from the battle-tested seller scanner transport
 * (`src/services/scanner/smartDetectStream.ts`) — same hard-won behavior:
 *  - Custom events via `addEventListener('<name>', …)`, NOT `onmessage`.
 *  - `pollingInterval: 0` disables auto-reconnect (a fatal close can't re-run
 *    the AI turn); belt-and-suspenders `removeAllEventListeners()` + `close()`
 *    in `settle()`.
 *  - `settle()` resolve-XOR-reject exactly once; terminal `done`/`error` only.
 *  - ~45s heartbeat watchdog, re-armed on every frame, reset by `heartbeat`.
 *  - `AbortSignal` cancels (with an attach-race re-check after listener add).
 *  - Backend `event: error` frame vs. lib transport error disambiguated on
 *    `typeof ev.data === 'string'`.
 *
 * Differences from the scanner: auth headers point at `AI_BASE_URL` and drop
 * `x-system-key` (assistant does NOT gate on it — sending it leaks the key);
 * the event catalog is `token`/`data`/`stage`/`done`/`warning`/`error`/
 * `heartbeat`; and this resolves on `done` (there is no `result` frame — the
 * draft arrives as a `data{type:'listing_draft'}` event, forwarded to `onEvent`).
 */

const DEFAULT_WATCHDOG_MS = 45_000;

/** Rejection carrying the assistant (or transport) error code + `retriable`,
 *  mirroring `SmartDetectStreamError` so callers branch without string-matching. */
export class LabStreamError extends Error {
  code: string;
  retriable: boolean;
  constructor(message: string, code: string, retriable: boolean) {
    super(message);
    this.name = 'LabStreamError';
    this.code = code;
    this.retriable = retriable;
  }
}

// Minimal structural type of the bits of react-native-sse we use, so a fake
// EventSource can be injected in tests without depending on lib internals.
type SseInstance = {
  addEventListener: (type: string, listener: (ev: any) => void) => void;
  removeAllEventListeners: () => void;
  close: () => void;
};
type SseFactory = (url: string, options: Record<string, unknown>) => SseInstance;

const defaultFactory: SseFactory = (url, options) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (RNEventSource as any)(url, options) as SseInstance;

/** Endpoints this transport can open (both on `AI_BASE_URL`). */
export type LabStreamEndpoint = '/chat/stream' | '/detect/stream';

/** Result resolved on the terminal `done` frame. */
export type LabStreamResult = {
  conversationId?: string;
  usedTools: string[];
};

export type LabStreamOptions = {
  /** Which assistant endpoint to POST to. */
  endpoint: LabStreamEndpoint;
  /** JSON request body (e.g. `{ conversation_id, message, site_type, mode }`
   *  for chat, `{ conversation_id, site_type, language, image_urls }` for
   *  detect). Sent verbatim — the caller owns the `mode` mapping + `site_type`. */
  body: Record<string, unknown>;
  /** Live UI sink for every typed frame (same pattern as the scanner's `onEvent`). */
  onEvent?: (e: LabStreamEvent) => void;
  /** Cancels the stream; aborting closes the EventSource + rejects. */
  signal?: AbortSignal;
  /** Test seam — inject a fake EventSource. Defaults to react-native-sse. */
  eventSourceFactory?: SseFactory;
  /** Override the heartbeat watchdog (ms). Default 45 000. */
  watchdogMs?: number;
};

function abortError() {
  return new LabStreamError('Stream cancelled', 'cancelled', false);
}

/** Pull the human-readable message out of the assistant's inconsistent error
 *  frame (it uses `detail` | `error` | `message`). */
function errorMessage(p: LabErrorEvent): string {
  return p.detail || p.error || p.message || 'The assistant hit an error';
}

/**
 * Open one AI stream turn. Resolves on the terminal `done` frame with
 * `{ conversationId, usedTools }`; rejects with a `LabStreamError` on a fatal
 * `error` frame, transport failure, watchdog trip, or abort.
 */
export async function labStream(opts: LabStreamOptions): Promise<LabStreamResult> {
  const { endpoint, body, onEvent, signal } = opts;

  // Already-aborted at call time → reject before opening anything.
  if (signal?.aborted) throw abortError();

  const factory = opts.eventSourceFactory ?? defaultFactory;
  const watchdogMs = opts.watchdogMs ?? DEFAULT_WATCHDOG_MS;

  // Auth AT OPEN — react-native-sse bypasses the axios interceptor, so we
  // replicate Bearer + x-refresh-token + x-platform by hand (08 §C.1). No
  // x-system-key: the assistant doesn't gate on it (03 §0.1).
  const [access, refresh] = await Promise.all([
    getSecureItem('auth.accessToken'),
    getSecureItem('auth.refreshToken'),
  ]);
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'x-platform': 'LabGreenbidz',
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (refresh) headers['x-refresh-token'] = refresh;

  const url = `${getAiBaseUrl()}${endpoint}`;

  return new Promise<LabStreamResult>((resolve, reject) => {
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
      settle(() => reject(new LabStreamError(message, code, retriable)));

    const armWatchdog = () => {
      if (settled) return;
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(
        () => fail('Connection lost', 'connection_lost', true),
        watchdogMs,
      );
    };

    const onAbort = () => settle(() => reject(abortError()));

    const safeOnEvent = (e: LabStreamEvent) => {
      if (!onEvent) return;
      // A bug in the UI handler must never poison the in-flight AI run.
      try {
        onEvent(e);
      } catch (uiErr) {
        if (__DEV__) console.warn('[labStream] onEvent handler threw', uiErr);
      }
    };

    // Backend `event: error` frame OR a lib transport error — both land here.
    const onErrorChannel = (ev: any) => {
      armWatchdog();
      if (ev?.type === 'timeout') return fail('Connection timed out', 'timeout', true);
      if (ev?.type === 'exception') {
        return fail(ev?.message || 'Stream exception', 'exception', true);
      }

      // Backend `event: error` frame → CustomEvent with a `data` JSON string.
      if (typeof ev?.data === 'string') {
        let payload: LabErrorEvent | null = null;
        try {
          payload = JSON.parse(ev.data) as LabErrorEvent;
        } catch {
          payload = null;
        }
        if (payload) {
          safeOnEvent({ type: 'error', data: payload });
          // Assistant errors are terminal unless explicitly non-fatal.
          if (payload.fatal === false) return; // non-fatal — keep waiting
          return fail(
            errorMessage(payload),
            payload.code || 'error',
            !!payload.retriable,
          );
        }
      }

      // Lib transport error: message = HTTP responseText, xhrStatus = HTTP code.
      const status: number | undefined = ev?.xhrStatus;
      if (!status) return fail('Connection lost', 'connection_lost', true);

      // Pre-stream 4xx/5xx returns a plain JSON body in `message`.
      let serverMsg: string | undefined;
      try {
        const parsed = JSON.parse(ev.message) as { message?: string; detail?: string };
        serverMsg = parsed?.detail || parsed?.message;
      } catch {
        /* not JSON */
      }
      const retriable = status === 429 || status === 503 || status >= 500;
      const code =
        status === 429
          ? 'too_many_concurrent'
          : status === 503
            ? 'spend_cap_exceeded'
            : `http_${status}`;
      fail(serverMsg || `The assistant is unavailable (${status})`, code, retriable);
    };

    const onNamed = (name: string, ev: any) => {
      armWatchdog();
      if (name === 'heartbeat') return; // watchdog only — no UI, no onEvent

      let data: any = null;
      try {
        data = ev?.data ? JSON.parse(ev.data) : null;
      } catch {
        return; // skip an unparseable progress frame; not terminal
      }

      switch (name) {
        case 'token':
          return safeOnEvent({ type: 'token', delta: (data as LabTokenEvent)?.delta ?? '' });
        case 'data':
          return safeOnEvent({ type: 'data', data: data as LabDataEvent });
        case 'stage':
          return safeOnEvent({ type: 'stage', data: data as LabStageEvent });
        case 'warning':
          return safeOnEvent({ type: 'warning', data: (data ?? {}) as LabWarningEvent });
        case 'heartbeat':
          // (unreachable — handled above; kept for exhaustiveness)
          return safeOnEvent({ type: 'heartbeat', data: data as LabHeartbeatEvent });
        case 'done': {
          const payload = (data ?? {}) as LabDoneEvent;
          safeOnEvent({ type: 'done', data: payload });
          return settle(() =>
            resolve({
              conversationId: payload.conversation_id,
              usedTools: payload.used_tools ?? [],
            }),
          );
        }
        default:
          return; // unknown named frame — ignore, forward-compatible
      }
    };

    // Register abort BEFORE opening, then re-check synchronously to close the
    // attach-race window (consumer aborts between open and listener add).
    signal?.addEventListener('abort', onAbort);
    if (signal?.aborted) return settle(() => reject(abortError()));

    try {
      es = factory(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        pollingInterval: 0, // no auto-reconnect (one-shot turn)
      });
    } catch (openErr) {
      return settle(() => reject(openErr as Error));
    }

    es.addEventListener('open', () => {
      armWatchdog();
      if (__DEV__) console.log('[labStream] open', endpoint);
    });
    es.addEventListener('error', onErrorChannel);
    for (const evName of LAB_STREAM_EVENT_NAMES) {
      es.addEventListener(evName, (ev: any) => onNamed(evName, ev));
    }

    armWatchdog();
  });
}
