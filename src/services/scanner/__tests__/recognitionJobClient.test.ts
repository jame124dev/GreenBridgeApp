// src/services/scanner/__tests__/recognitionJobClient.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Same babel-plugin-jest-hoist workaround used in draftApi.test.ts /
// smartDetectStream.test.ts in this repo: a mock factory may only close over
// out-of-scope names prefixed "mock", AND even a `mockPost`/`mockGet` const
// declared before the mocked import still races the hoisted `require()` for
// that import. Fixed by creating the jest.fn()s INSIDE the factory (no outer
// closure) and grabbing references via the already-mocked import afterward.
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { post: jest.fn(), get: jest.fn() },
}));
// Avoid native SecureStore reads; tokens don't matter for the fake ES.
jest.mock('@/lib/secureStorage', () => ({
  getSecureItem: jest.fn(async () => null),
}));
// Deterministic site type — matches `smartDetectStream.ts`'s own mock of
// `../buildFormData` (relative import, same directory as the module under test).
jest.mock('../buildFormData', () => ({ getSiteType: () => 'LabGreenbidz' }));
// mapSmartDetection is pure and already unit-tested on its own
// (mapSmartDetection.test.ts) — stub it here so this suite proves only the
// TRANSPORT wiring: which raw payload + siteType it's called with, and that
// tailRecognitionJob resolves with whatever it returns.
jest.mock('@/features/scanner/mapSmartDetection', () => ({
  mapSmartDetection: jest.fn((raw: unknown, siteType: string) => ({
    mapped: true,
    raw,
    siteType,
  })),
}));

import { greenbidz } from '@/api/greenbidzClient';
import { mapSmartDetection } from '@/features/scanner/mapSmartDetection';
import type { SmartDetectionResponse } from '@/features/scanner/smartDetectionTypes';

import {
  createRecognitionJob,
  getRecognitionJobStatus,
  tailRecognitionJob,
} from '../recognitionJobClient';

// jest-mock's default `jest.Mock` generic collapses `mockResolvedValue`'s
// param type to `never` (same tsc pitfall documented in draftApi.test.ts) —
// type the axios mocks explicitly.
type AxiosLikeMock = jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
const mockPost = greenbidz.post as AxiosLikeMock;
const mockGet = greenbidz.get as AxiosLikeMock;
const mockMapSmartDetection = mapSmartDetection as jest.Mock;

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
  mockMapSmartDetection.mockClear();
});

// ── Fake react-native-sse EventSource (mirrors smartDetectStream.test.ts) ───
type Listener = (ev: any) => void;
class FakeEventSource {
  url: string;
  options: Record<string, unknown>;
  closeCount = 0;
  removeAllCount = 0;
  private listeners: Record<string, Listener[]> = {};
  constructor(url: string, options: Record<string, unknown>) {
    this.url = url;
    this.options = options;
  }
  addEventListener(type: string, cb: Listener) {
    (this.listeners[type] ??= []).push(cb);
  }
  removeAllEventListeners() {
    this.removeAllCount += 1;
    this.listeners = {};
  }
  close() {
    this.closeCount += 1;
  }
  emit(type: string, ev: any) {
    (this.listeners[type] ?? []).forEach((cb) => cb(ev));
  }
  get listenerCount() {
    return Object.values(this.listeners).reduce((n, l) => n + l.length, 0);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const RESULT_PAYLOAD: SmartDetectionResponse = {
  success: true,
  language: 'en',
  detection: { suggested_mode: 'single', confidence: 0.9, summary: 'x' },
  merged_single: {},
  products: [],
  suggested_terms: {},
};

/** Helper: start a tail with an injected fake ES factory; returns handles like smartDetectStream.test.ts's startStream(). */
function startTail(
  opts: {
    onEvent?: (name: string, data: unknown) => void;
    signal?: AbortSignal;
    watchdogMs?: number;
    afterSeq?: number;
  } = {},
) {
  let es: FakeEventSource | undefined;
  let factoryCalls = 0;
  const factory = (url: string, options: Record<string, unknown>) => {
    factoryCalls += 1;
    es = new FakeEventSource(url, options);
    return es;
  };
  const promise = tailRecognitionJob('job-1', {
    afterSeq: opts.afterSeq,
    signal: opts.signal,
    onEvent: opts.onEvent,
    eventSourceFactory: factory,
    watchdogMs: opts.watchdogMs ?? 1_000_000,
  });
  promise.catch(() => {}); // don't surface as an unhandled rejection unless awaited
  return { promise, getEs: () => es, getFactoryCalls: () => factoryCalls };
}

describe('createRecognitionJob', () => {
  it('posts to /recognition-jobs and unwraps the { success, data } envelope', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: { job_id: 'job-9' } } });
    const out = await createRecognitionJob({
      image_urls: ['https://gcs/img1.png'],
      language: 'en',
      platform: 'LabGreenbidz',
    });
    expect(mockPost).toHaveBeenCalledWith('/recognition-jobs', {
      image_urls: ['https://gcs/img1.png'],
      language: 'en',
      platform: 'LabGreenbidz',
    });
    expect(out).toEqual({ job_id: 'job-9' });
  });
});

describe('getRecognitionJobStatus', () => {
  it('gets /recognition-jobs/:id and unwraps the { success, data } envelope', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { status: 'draft_ready', draft_id: 'd1' } },
    });
    const out = await getRecognitionJobStatus('job-9');
    expect(mockGet).toHaveBeenCalledWith('/recognition-jobs/job-9');
    expect(out).toEqual({ status: 'draft_ready', draft_id: 'd1' });
  });
});

describe('tailRecognitionJob', () => {
  it('opens a GET stream at .../recognition-jobs/:id/stream?after_seq=N with SSE headers', async () => {
    const { getEs } = startTail({ afterSeq: 7 });
    await flush();
    const es = getEs()!;
    expect(es.url).toContain('/recognition-jobs/job-1/stream?after_seq=7');
    expect(es.options.method).toBe('GET');
    expect((es.options.headers as Record<string, string>).Accept).toBe('text/event-stream');
  });

  it('resolves with the mapped result on a result frame (same mapper + siteType as the sync path)', async () => {
    const { promise, getEs } = startTail();
    await flush();
    getEs()!.emit('result', { data: JSON.stringify(RESULT_PAYLOAD) });
    await expect(promise).resolves.toEqual({
      mapped: true,
      raw: RESULT_PAYLOAD,
      siteType: 'LabGreenbidz',
    });
    expect(mockMapSmartDetection).toHaveBeenCalledWith(RESULT_PAYLOAD, 'LabGreenbidz');
  });

  it('rejects on a fatal backend error frame with code + message intact', async () => {
    const { promise, getEs } = startTail();
    await flush();
    getEs()!.emit('error', {
      data: JSON.stringify({
        fatal: true,
        code: 'ai_unavailable',
        message: 'AI is temporarily unavailable.',
        retriable: true,
      }),
    });
    await expect(promise).rejects.toMatchObject({
      code: 'ai_unavailable',
      retriable: true,
      message: 'AI is temporarily unavailable.',
    });
  });

  it('rejects a non-JSON error frame too (the brief\'s minimal fixture — falls through to the transport-error path, matching smartDetectStream, not invented)', async () => {
    const { promise, getEs } = startTail();
    await flush();
    getEs()!.emit('error', { data: 'boom' });
    await expect(promise).rejects.toBeTruthy();
  });

  it('continues past a non-fatal error frame and still resolves on result', async () => {
    const seen: [string, unknown][] = [];
    const { promise, getEs } = startTail({ onEvent: (n, d) => seen.push([n, d]) });
    await flush();
    const es = getEs()!;
    es.emit('error', {
      data: JSON.stringify({ fatal: false, code: 'pdf_fetch_failed', message: 'one pdf failed' }),
    });
    es.emit('result', { data: JSON.stringify(RESULT_PAYLOAD) });
    await expect(promise).resolves.toBeDefined();
    expect(seen.some(([n]) => n === 'error')).toBe(true);
  });

  it('forwards progress events to onEvent as (name, data) and skips heartbeat/result', async () => {
    const seen: string[] = [];
    const { promise, getEs } = startTail({ onEvent: (n) => seen.push(n) });
    await flush();
    const es = getEs()!;
    es.emit('stage', { data: JSON.stringify({ phase: 'ai_running' }) });
    es.emit('heartbeat', { data: '' });
    es.emit('result', { data: JSON.stringify(RESULT_PAYLOAD) });
    await promise;
    expect(seen).toEqual(['stage']);
  });

  it('fires the watchdog when the stream goes silent', async () => {
    const { promise } = startTail({ watchdogMs: 20 });
    await expect(promise).rejects.toMatchObject({ code: 'connection_lost' });
  });

  it('rejects + closes the ES when the signal aborts mid-stream', async () => {
    const ac = new AbortController();
    const { promise, getEs } = startTail({ signal: ac.signal });
    await flush();
    const es = getEs()!;
    ac.abort();
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
    expect(es.closeCount).toBe(1);
    expect(es.removeAllCount).toBe(1);
  });

  it('rejects synchronously if the signal is already aborted (ES never opened)', async () => {
    const ac = new AbortController();
    ac.abort();
    const { promise, getEs, getFactoryCalls } = startTail({ signal: ac.signal });
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
    expect(getFactoryCalls()).toBe(0);
    expect(getEs()).toBeUndefined();
  });

  it('cleans up exactly once and ignores late events after settle', async () => {
    const { promise, getEs } = startTail();
    await flush();
    const es = getEs()!;
    es.emit('result', { data: JSON.stringify(RESULT_PAYLOAD) });
    await promise;
    expect(es.closeCount).toBe(1);
    expect(es.removeAllCount).toBe(1);
    expect(es.listenerCount).toBe(0);
    expect(() =>
      es.emit('error', { data: JSON.stringify({ fatal: true, code: 'x', message: 'late' }) }),
    ).not.toThrow();
  });
});
