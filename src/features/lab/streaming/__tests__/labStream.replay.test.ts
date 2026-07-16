import { describe, it, expect, jest } from '@jest/globals';

import { buildTurnEvents, toSseFrames } from '@/test-utils/builders';
import { FakeEventSource, flush, emitFrame } from '@/test-utils/sse';

import { labStream } from '../labStream';
import type { LabStreamEvent } from '../labStreamTypes';

// PR-0 baseline: pins the CURRENT `labStream` transport contract (A3) so PR-4/5
// changes can prove the transport still resolves/forwards identically. Mirrors
// the proven `smartDetectStream.test.ts` pattern with an injected fake ES.

// Avoid native SecureStore / env reads.
jest.mock('@/lib/secureStorage', () => ({ getSecureItem: jest.fn(async () => null) }));
jest.mock('@/lib/env', () => ({ getAiBaseUrl: () => 'http://test' }));

function startStream(opts: { onEvent?: (e: LabStreamEvent) => void; signal?: AbortSignal } = {}) {
  let es: FakeEventSource | undefined;
  const factory = (url: string, options: Record<string, unknown>) => {
    es = new FakeEventSource(url, options);
    return es;
  };
  const promise = labStream({
    endpoint: '/chat/stream',
    body: { conversation_id: 'conv-1', message: 'hi', site_type: 'labgreenbidz', mode: 'buyer' },
    onEvent: opts.onEvent,
    signal: opts.signal,
    eventSourceFactory: factory as never,
    watchdogMs: 1_000_000,
  });
  promise.catch(() => {}); // surface rejections only when awaited
  return { promise, getEs: () => es };
}

describe('labStream — replay baseline', () => {
  it('resolves on done with conversationId + usedTools, forwarding progress (not heartbeat)', async () => {
    const seen: LabStreamEvent[] = [];
    const { promise, getEs } = startStream({ onEvent: (e) => seen.push(e) });
    await flush();
    const es = getEs()!;
    for (const f of toSseFrames(buildTurnEvents({ withCard: true, tools: ['search_marketplace'] }))) {
      emitFrame(es, f);
    }

    const result = await promise;
    expect(result).toEqual({ conversationId: 'conv-1', usedTools: ['search_marketplace'] });

    const types = seen.map((e) => e.type);
    expect(types).toContain('stage');
    expect(types).toContain('token');
    expect(types).toContain('data');
    expect(types).toContain('done');
    expect(types).not.toContain('heartbeat'); // watchdog-only, never forwarded

    // Tokens forwarded in order; accumulated text matches the source.
    const text = seen
      .filter((e): e is Extract<LabStreamEvent, { type: 'token' }> => e.type === 'token')
      .map((e) => e.delta)
      .join('');
    expect(text).toBe('Hello there, your listing is ready.');
  });

  it('rejects on a fatal error frame with code + retriable', async () => {
    const { promise, getEs } = startStream();
    await flush();
    getEs()!.emit('error', {
      type: 'error',
      data: JSON.stringify({ fatal: true, code: 'ai_unavailable', detail: 'down', retriable: true }),
      lastEventId: null,
      url: '',
    });
    await expect(promise).rejects.toMatchObject({
      code: 'ai_unavailable',
      retriable: true,
      message: 'down',
    });
  });

  it('continues on a non-fatal error frame and still resolves on done', async () => {
    const seen: LabStreamEvent[] = [];
    const { promise, getEs } = startStream({ onEvent: (e) => seen.push(e) });
    await flush();
    const es = getEs()!;
    es.emit('error', {
      type: 'error',
      data: JSON.stringify({ fatal: false, code: 'soft', detail: 'partial' }),
      lastEventId: null,
      url: '',
    });
    for (const f of toSseFrames(buildTurnEvents())) emitFrame(es, f);
    await expect(promise).resolves.toBeDefined();
    expect(seen.some((e) => e.type === 'error')).toBe(true);
  });

  it('rejects + tears down the ES on abort mid-stream', async () => {
    const ac = new AbortController();
    const { promise, getEs } = startStream({ signal: ac.signal });
    await flush();
    const es = getEs()!;
    ac.abort();
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
    expect(es.closeCount).toBe(1);
    expect(es.removeAllCount).toBe(1);
  });
});
