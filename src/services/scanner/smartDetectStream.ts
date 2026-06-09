import Constants from 'expo-constants';
import RNEventSource from 'react-native-sse';

import { toAnalyzeLanguage } from '@/features/scanner/constants';
import { mapSmartDetection } from '@/features/scanner/mapSmartDetection';
import type {
  MappedSmartDetection,
  SmartDetectionResponse,
} from '@/features/scanner/smartDetectionTypes';
import type {
  SmartStreamEvent,
  StreamErrorEvent,
} from '@/features/scanner/smartDetectStreamTypes';
import { getSecureItem } from '@/lib/secureStorage';

import { getSiteType } from './buildFormData';

/**
 * POST /wp/analyze-smart-detection-v2 — Server-Sent Events transport for smart
 * detection (Docs/SMART_DETECT_V2_SSE_INTEGRATION_PLAN.md).
 *
 * Same body contract and same final result as the v1 `smartDetectFromUrls`:
 * the backend's terminal `result` event is byte-identical to the v1 JSON
 * response, so we map it with the SAME `mapSmartDetection` and resolve. The
 * intermediate `stage`/`detection`/`product`/`pdf_pages` events are forwarded
 * to `onEvent` purely for live UI progress — they are NOT used to assemble the
 * result (result-only mapping). This keeps v2 ≡ v1 by construction.
 *
 * Pinned to `react-native-sse@1.2.1` behavior (verified against the source):
 *  - Custom events arrive via `addEventListener('<name>', …)`, NOT `onmessage`.
 *  - The built-in `'error'` listener receives THREE things: our backend
 *    `event: error` SSE frames (a CustomEvent with a `data` string), lib
 *    transport errors (`{ type:'error', message, xhrStatus, xhrState }` where
 *    `message` is the HTTP `responseText`), and `{ type:'timeout' }` /
 *    `{ type:'exception' }`. We disambiguate on `typeof ev.data === 'string'`.
 *  - `pollingInterval: 0` disables auto-reconnect (the lib's `_pollAgain(0,
 *    false)` guard fails), so a fatal close can't trigger a second AI run.
 *    We also `removeAllEventListeners()` + `close()` in `settle()` as
 *    belt-and-suspenders.
 *  - default `timeout: 0` → no client-side request timeout; we rely on the
 *    backend's 5-min deadline + a 45 s heartbeat watchdog here instead.
 */

const DEFAULT_WATCHDOG_MS = 45_000;

/** Rejection carrying the backend (or transport) error code so callers can
 *  branch on `retriable` without string-matching. */
export class SmartDetectStreamError extends Error {
  code: string;
  retriable: boolean;
  constructor(message: string, code: string, retriable: boolean) {
    super(message);
    this.name = 'SmartDetectStreamError';
    this.code = code;
    this.retriable = retriable;
  }
}

// Minimal structural type of the bits of react-native-sse we use, so a fake
// EventSource can be injected in tests without depending on the lib internals.
type SseInstance = {
  addEventListener: (type: string, listener: (ev: any) => void) => void;
  removeAllEventListeners: () => void;
  close: () => void;
};
type SseFactory = (url: string, options: Record<string, unknown>) => SseInstance;

const defaultFactory: SseFactory = (url, options) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (RNEventSource as any)(url, options) as SseInstance;

export type SmartDetectStreamOptions = {
  /** Test seam — inject a fake EventSource. Defaults to react-native-sse. */
  eventSourceFactory?: SseFactory;
  /** Override the heartbeat watchdog (ms). Default 45 000. */
  watchdogMs?: number;
};

function abortError() {
  return new SmartDetectStreamError('Smart detection cancelled', 'cancelled', false);
}

export async function smartDetectStream(
  imageUrls: string[],
  language: string,
  signal: AbortSignal | undefined,
  documentUrls: string[] | undefined,
  sellerId: number | string | undefined,
  onEvent?: (e: SmartStreamEvent) => void,
  options: SmartDetectStreamOptions = {},
): Promise<MappedSmartDetection> {
  if (!imageUrls.length && !documentUrls?.length) {
    throw new Error(
      'At least one image URL or document URL is required for smart detection',
    );
  }
  // Already-aborted at call time → reject before opening anything.
  if (signal?.aborted) throw abortError();

  const factory = options.eventSourceFactory ?? defaultFactory;
  const watchdogMs = options.watchdogMs ?? DEFAULT_WATCHDOG_MS;
  const lang = toAnalyzeLanguage(language);

  // Replicate the axios interceptor + client headers manually — the SSE
  // transport bypasses the axios instance entirely.
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const [access, refresh] = await Promise.all([
    getSecureItem('auth.accessToken'),
    getSecureItem('auth.refreshToken'),
  ]);
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'x-platform': (extra.SITE_TYPE as string | undefined) ?? 'LabGreenbidz',
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (refresh) headers['x-refresh-token'] = refresh;
  if (extra.X_SYSTEM_KEY) headers['x-system-key'] = String(extra.X_SYSTEM_KEY);

  const baseUrl = (extra.GREENBIDZ_API_URL as string | undefined) ?? '';
  const url = `${baseUrl}/wp/analyze-smart-detection-v2`;

  // Body matches v1 exactly (see smartDetectFromUrls): image_urls ALWAYS sent
  // (empty array on a docs-only scan), document_urls + sellerId optional.
  const body: Record<string, unknown> = { image_urls: imageUrls, language: lang };
  if (documentUrls?.length) body.document_urls = documentUrls;
  if (sellerId != null) body.sellerId = String(sellerId);

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
      settle(() => reject(new SmartDetectStreamError(message, code, retriable)));

    const armWatchdog = () => {
      if (settled) return;
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(
        () => fail('Connection lost', 'connection_lost', true),
        watchdogMs,
      );
    };

    const onAbort = () => settle(() => reject(abortError()));

    const safeOnEvent = (e: SmartStreamEvent) => {
      if (!onEvent) return;
      // A bug in the UI handler must never poison the in-flight AI run. Log in
      // dev (console.warn until Sentry/Datadog is wired) and swallow.
      try {
        onEvent(e);
      } catch (uiErr) {
        if (__DEV__) console.warn('[smartDetectStream] onEvent handler threw', uiErr);
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
          safeOnEvent({ type: 'error', data: payload });
          if (payload.fatal) {
            return fail(
              payload.message || 'Smart detection failed',
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

      // Pre-stream 400/429 returns a plain JSON body in `message`.
      let serverMsg: string | undefined;
      try {
        serverMsg = (JSON.parse(ev.message) as { message?: string })?.message;
      } catch {
        /* not JSON */
      }
      const code = status === 429 ? 'too_many_concurrent' : `http_${status}`;
      fail(serverMsg || `Smart detection failed (${status})`, code, status === 429);
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
            (payload as { message?: string })?.message || 'Smart detection failed',
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
      safeOnEvent({ type: name, data } as SmartStreamEvent);
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
        pollingInterval: 0, // no auto-reconnect (one-shot job)
      });
    } catch (openErr) {
      return settle(() => reject(openErr as Error));
    }

    es.addEventListener('open', () => {
      armWatchdog();
      if (__DEV__) console.log('[smartDetectStream] open');
    });
    es.addEventListener('error', onErrorChannel);
    for (const name of ['stage', 'pdf_pages', 'detection', 'product', 'result', 'heartbeat']) {
      es.addEventListener(name, (ev: any) => onNamed(name, ev));
    }

    armWatchdog();
  });
}
