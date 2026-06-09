import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { mapSmartDetection } from '@/features/scanner/mapSmartDetection';
import type { SmartDetectionResponse } from '@/features/scanner/smartDetectionTypes';
import type { SmartStreamEvent } from '@/features/scanner/smartDetectStreamTypes';

import {
  smartDetectStream,
  SmartDetectStreamError,
} from '../smartDetectStream';

// Avoid native SecureStore / config reads; tokens don't matter for the fake.
jest.mock('@/lib/secureStorage', () => ({
  getSecureItem: jest.fn(async () => null),
}));
// Deterministic site type — used by BOTH the transport and the expected value.
jest.mock('../buildFormData', () => ({ getSiteType: () => 'LabGreenbidz' }));

// ── Fake react-native-sse EventSource ────────────────────────────────────────
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

/** Parse the captured SSE fixture into ordered { event, data } frames. */
function parseFixture(text: string): { event: string; data: string }[] {
  return text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      return { event, data: dataLines.join('\n') };
    });
}

const FIXTURE = readFileSync(
  join(__dirname, 'fixtures', 'smartDetectStream.zh-hant.txt'),
  'utf8',
);
const FRAMES = parseFixture(FIXTURE);
const RESULT_PAYLOAD = JSON.parse(
  FRAMES.find((f) => f.event === 'result')!.data,
) as SmartDetectionResponse;

/** Helper: start a stream with an injected fake and return { promise, getEs }. */
function startStream(
  opts: {
    onEvent?: (e: SmartStreamEvent) => void;
    signal?: AbortSignal;
    watchdogMs?: number;
    imageUrls?: string[];
    documentUrls?: string[];
  } = {},
) {
  let es: FakeEventSource | undefined;
  let factoryCalls = 0;
  const factory = (url: string, options: Record<string, unknown>) => {
    factoryCalls += 1;
    es = new FakeEventSource(url, options);
    return es;
  };
  const promise = smartDetectStream(
    opts.imageUrls ?? [],
    'zh-hant',
    opts.signal,
    opts.documentUrls ?? ['https://gcs/doc.pdf'],
    '574',
    opts.onEvent,
    { eventSourceFactory: factory, watchdogMs: opts.watchdogMs ?? 1_000_000 },
  );
  // Surface unhandled rejections as test failures only when awaited.
  promise.catch(() => {});
  return { promise, getEs: () => es, getFactoryCalls: () => factoryCalls };
}

function emitFrame(es: FakeEventSource, f: { event: string; data: string }) {
  es.emit(f.event, { type: f.event, data: f.data, lastEventId: null, url: es.url });
}

describe('smartDetectStream', () => {
  it('resolves to a result deep-equal to v1 mapSmartDetection (result-only mapping)', async () => {
    const { promise, getEs } = startStream();
    await flush();
    const es = getEs()!;
    for (const f of FRAMES) emitFrame(es, f);

    const v2Result = await promise;
    const v1Result = mapSmartDetection(RESULT_PAYLOAD, 'LabGreenbidz');
    expect(v2Result).toEqual(v1Result);
  });

  it('forwards progress events (not result/heartbeat) and keeps product completion order', async () => {
    const seen: SmartStreamEvent[] = [];
    const { promise, getEs } = startStream({ onEvent: (e) => seen.push(e) });
    await flush();
    const es = getEs()!;
    for (const f of FRAMES) emitFrame(es, f);
    await promise;

    const types = seen.map((e) => e.type);
    expect(types).not.toContain('result'); // result resolves, not a progress tick
    expect(types).toContain('stage');
    expect(types).toContain('detection');
    expect(types.filter((t) => t === 'product')).toHaveLength(2);

    // Products arrive in completion order as streamed: index 1 then index 0.
    const productIdx = seen
      .filter((e): e is Extract<SmartStreamEvent, { type: 'product' }> => e.type === 'product')
      .map((e) => e.data.index);
    expect(productIdx).toEqual([1, 0]);
  });

  it('rejects on a fatal error event with code + retriable', async () => {
    const { promise, getEs } = startStream();
    await flush();
    getEs()!.emit('error', {
      type: 'error',
      data: JSON.stringify({
        fatal: true,
        code: 'ai_unavailable',
        message: 'AI is temporarily unavailable.',
        retriable: true,
      }),
      lastEventId: null,
      url: '',
    });
    await expect(promise).rejects.toMatchObject({
      code: 'ai_unavailable',
      retriable: true,
      message: 'AI is temporarily unavailable.',
    });
  });

  it('continues on a non-fatal error event and still resolves on result', async () => {
    const seen: SmartStreamEvent[] = [];
    const { promise, getEs } = startStream({ onEvent: (e) => seen.push(e) });
    await flush();
    const es = getEs()!;
    es.emit('error', {
      type: 'error',
      data: JSON.stringify({ fatal: false, code: 'pdf_fetch_failed', message: 'one pdf failed' }),
      lastEventId: null,
      url: '',
    });
    for (const f of FRAMES) emitFrame(es, f);
    await expect(promise).resolves.toBeDefined();
    expect(seen.some((e) => e.type === 'error')).toBe(true);
  });

  it('rejects a pre-stream 429 with the parsed server message (transport error)', async () => {
    const { promise, getEs } = startStream();
    await flush();
    getEs()!.emit('error', {
      type: 'error',
      xhrStatus: 429,
      xhrState: 4,
      message: JSON.stringify({ success: false, message: 'Too many analyses are running.' }),
    });
    await expect(promise).rejects.toMatchObject({
      code: 'too_many_concurrent',
      retriable: true,
      message: 'Too many analyses are running.',
    });
  });

  it('rejects a transport dropout (xhrStatus 0) as connection_lost', async () => {
    const { promise, getEs } = startStream();
    await flush();
    getEs()!.emit('error', { type: 'error', xhrStatus: 0, xhrState: 4, message: '' });
    await expect(promise).rejects.toMatchObject({ code: 'connection_lost' });
  });

  it('rejects on a lib timeout event', async () => {
    const { promise, getEs } = startStream();
    await flush();
    getEs()!.emit('error', { type: 'timeout' });
    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects + closes the ES when the signal aborts mid-stream', async () => {
    const ac = new AbortController();
    const { promise, getEs } = startStream({ signal: ac.signal });
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
    const { promise, getEs, getFactoryCalls } = startStream({ signal: ac.signal });
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
    expect(getFactoryCalls()).toBe(0);
    expect(getEs()).toBeUndefined();
  });

  it('fires the watchdog when the stream goes silent', async () => {
    const { promise, getEs } = startStream({ watchdogMs: 20 });
    await flush();
    expect(getEs()).toBeDefined(); // opened, but no events emitted
    await expect(promise).rejects.toMatchObject({ code: 'connection_lost' });
  });

  it('a throwing onEvent does not reject the stream (UI bug isolation)', async () => {
    const { promise, getEs } = startStream({
      onEvent: () => {
        throw new Error('UI handler blew up');
      },
    });
    await flush();
    const es = getEs()!;
    for (const f of FRAMES) emitFrame(es, f);
    await expect(promise).resolves.toBeDefined();
  });

  it('cleans up exactly once and ignores late events after settle', async () => {
    const { promise, getEs } = startStream();
    await flush();
    const es = getEs()!;
    for (const f of FRAMES) emitFrame(es, f);
    await promise;
    expect(es.closeCount).toBe(1);
    expect(es.removeAllCount).toBe(1);
    expect(es.listenerCount).toBe(0); // removeAllEventListeners cleared them
    // A late fatal error after settle must be a no-op (no throw, no second settle).
    expect(() =>
      es.emit('error', { type: 'error', data: JSON.stringify({ fatal: true, code: 'x', message: 'late' }) }),
    ).not.toThrow();
  });
});

// ── Phase 2 — Office docs (DOCX/PPTX/XLSX/CSV) ───────────────────────────────
//
// These tests pin the contract for the four new non-fatal `error` codes,
// the renamed `preparing_documents` stage, and the additive `sourceName` /
// `sourceLabel` fields on `document_pages[]`. The transport is the consumer-
// facing boundary; the screens (`processing.tsx` / `processing-v2.tsx`)
// own their own UI tests separately.

describe('smartDetectStream — Phase 2 (office docs)', () => {
  it('forwards the renamed `preparing_documents` stage event untouched', async () => {
    const seen: SmartStreamEvent[] = [];
    const { promise, getEs } = startStream({ onEvent: (e) => seen.push(e) });
    await flush();
    const es = getEs()!;
    es.emit('stage', {
      type: 'stage',
      data: JSON.stringify({
        phase: 'preparing_documents',
        message: 'Reading 1 document(s)...',
        total: 1,
      }),
      lastEventId: null,
      url: '',
    });
    // Drain a result so the promise settles cleanly (no watchdog noise).
    for (const f of FRAMES) emitFrame(es, f);
    await promise;

    const stage = seen.find(
      (e): e is Extract<SmartStreamEvent, { type: 'stage' }> =>
        e.type === 'stage' && e.data.phase === 'preparing_documents',
    );
    expect(stage).toBeDefined();
    expect(stage?.data.total).toBe(1);
    expect(stage?.data.message).toMatch(/Reading/);
  });

  it.each([
    ['unsupported_document_format', { name: 'macro.docm', reason: 'macro_enabled' }],
    ['document_too_large', { name: 'big.xlsx', size: 30 * 1024 * 1024, limit: 25 * 1024 * 1024 }],
    ['document_parse_failed', { name: 'evil.docx', reason: 'xxe_blocked' }],
    ['document_extraction_timeout', { name: 'slow.csv' }],
  ])(
    'forwards non-fatal `%s` to onEvent with code + context intact',
    async (code, context) => {
      const seen: SmartStreamEvent[] = [];
      const { promise, getEs } = startStream({ onEvent: (e) => seen.push(e) });
      await flush();
      const es = getEs()!;
      const message = `localized message for ${code}`;
      es.emit('error', {
        type: 'error',
        data: JSON.stringify({ fatal: false, code, message, context }),
        lastEventId: null,
        url: '',
      });
      // Drain a result so the stream resolves.
      for (const f of FRAMES) emitFrame(es, f);
      await expect(promise).resolves.toBeDefined();

      const errEv = seen.find(
        (e): e is Extract<SmartStreamEvent, { type: 'error' }> => e.type === 'error',
      );
      expect(errEv).toBeDefined();
      expect(errEv?.data.fatal).toBe(false);
      expect(errEv?.data.code).toBe(code);
      expect(errEv?.data.message).toBe(message);
      expect(errEv?.data.context).toEqual(context);
    },
  );

  it('mapSmartDetection preserves `sourceName` + `sourceLabel` on document_pages[]', () => {
    const payload: SmartDetectionResponse = {
      success: true,
      language: 'en',
      detection: { suggested_mode: 'single', confidence: 0.9, summary: 'X' },
      merged_single: {},
      products: [],
      suggested_terms: {},
      image_urls: [
        'https://gcs/sellers/574/2026/06/abc/img-1.png',
        'https://gcs/sellers/574/2026/06/abc/img-2.png',
      ],
      document_pages: [
        {
          index: 0,
          page: 1,
          url: 'https://gcs/sellers/574/2026/06/abc/img-1.png',
          width: 628,
          height: 470,
          sourceName: 'inventory.xlsx',
          sourceLabel: 'sheet 仁義廠',
        },
        {
          index: 1,
          page: 3,
          url: 'https://gcs/sellers/574/2026/06/abc/img-2.png',
          width: 1024,
          height: 768,
          sourceName: 'deck.pptx',
          sourceLabel: 'slide 3',
        },
      ],
    };
    const mapped = mapSmartDetection(payload, 'LabGreenbidz');
    expect(mapped.documentPages).toHaveLength(2);
    expect(mapped.documentPages[0]).toMatchObject({
      sourceName: 'inventory.xlsx',
      sourceLabel: 'sheet 仁義廠',
    });
    expect(mapped.documentPages[1]).toMatchObject({
      sourceName: 'deck.pptx',
      sourceLabel: 'slide 3',
    });
  });

  it('mapSmartDetection still works when sourceName/sourceLabel are absent (pre-Phase-2 payload)', () => {
    // Replays the existing fixture (no Phase 2 fields) and checks the new
    // optional fields are undefined — guards against accidental defaulting.
    const mapped = mapSmartDetection(RESULT_PAYLOAD, 'LabGreenbidz');
    for (const p of mapped.documentPages) {
      expect(p.sourceName).toBeUndefined();
      expect(p.sourceLabel).toBeUndefined();
    }
  });

  it('continues + forwards a single non-fatal office-doc error before the result event', async () => {
    // End-to-end shape of the P2 wiring on the consumer side: one .docm gets
    // rejected mid-batch, the rest of the stream proceeds, the result lands.
    const seen: SmartStreamEvent[] = [];
    const { promise, getEs } = startStream({ onEvent: (e) => seen.push(e) });
    await flush();
    const es = getEs()!;
    es.emit('error', {
      type: 'error',
      data: JSON.stringify({
        fatal: false,
        code: 'unsupported_document_format',
        message: 'Macro-enabled files (.docm/.xlsm/.pptm) are not accepted.',
        context: { name: 'macro.docm', reason: 'macro_enabled' },
      }),
      lastEventId: null,
      url: '',
    });
    for (const f of FRAMES) emitFrame(es, f);
    await expect(promise).resolves.toBeDefined();

    const errors = seen.filter((e) => e.type === 'error');
    expect(errors).toHaveLength(1);
    const result = seen.filter((e) => e.type === 'product');
    expect(result.length).toBeGreaterThan(0); // happy-path products still arrived
  });
});
