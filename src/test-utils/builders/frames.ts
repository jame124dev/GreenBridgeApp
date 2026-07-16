// Reusable LabStreamEvent builders + SSE serialization for streaming tests
// (PR-0). Modeled exactly on `labStreamTypes` so the reducer/transport baselines
// exercise the real wire contract (A3). Programmatic builders replace a static
// fixture file so future tests compose frames without duplicating JSON.
import type { LabStreamEvent } from '@/features/lab/streaming/labStreamTypes';

export const tokenEvent = (delta: string): LabStreamEvent => ({ type: 'token', delta });

export const dataEvent = (
  cardType: string,
  data: unknown,
  extra: Record<string, unknown> = {},
): LabStreamEvent => ({ type: 'data', data: { type: cardType, data, ...extra } });

export const stageEvent = (
  phase: string,
  extra: Record<string, unknown> = {},
): LabStreamEvent => ({ type: 'stage', data: { phase, ...extra } as never });

export const doneEvent = (
  extra: Partial<{ used_tools: string[]; conversation_id: string }> = {},
): LabStreamEvent => ({ type: 'done', data: { used_tools: [], ...extra } });

export const errorEvent = (payload: Record<string, unknown>): LabStreamEvent => ({
  type: 'error',
  data: payload as never,
});

export const warningEvent = (payload: Record<string, unknown> = {}): LabStreamEvent => ({
  type: 'warning',
  data: payload as never,
});

export const heartbeatEvent = (ts = 0): LabStreamEvent => ({ type: 'heartbeat', data: { ts } });

/**
 * A canonical representative turn: two stage frames, word-by-word tokens,
 * (optionally) a listing_draft card, then done. Exercises token accumulation,
 * card handling, draft mirroring, and terminal resolution in one sequence.
 */
export function buildTurnEvents(
  opts: { text?: string; withCard?: boolean; tools?: string[]; conversationId?: string } = {},
): LabStreamEvent[] {
  const text = opts.text ?? 'Hello there, your listing is ready.';
  const words = text.split(' ');
  const events: LabStreamEvent[] = [stageEvent('validating'), stageEvent('ai_running')];
  words.forEach((w, i) => events.push(tokenEvent(i === 0 ? w : ` ${w}`)));
  if (opts.withCard) {
    events.push(
      dataEvent('listing_draft', {
        title: 'Sample Machine',
        missing_required: [],
        low_confidence: [],
      }),
    );
  }
  events.push(
    doneEvent({ used_tools: opts.tools ?? [], conversation_id: opts.conversationId ?? 'conv-1' }),
  );
  return events;
}

/** The full accumulated prose a `buildTurnEvents` sequence reveals. */
export function expectedTurnText(
  opts: { text?: string } = {},
): string {
  return opts.text ?? 'Hello there, your listing is ready.';
}

export type SseFrame = { event: string; data: string };

/** Serialize typed events into the SSE `{event, data-json}` frames the transport
 *  parses. `token` carries `{delta}`; every other event carries its `data`. */
export function toSseFrames(events: LabStreamEvent[]): SseFrame[] {
  return events.map((e) =>
    e.type === 'token'
      ? { event: 'token', data: JSON.stringify({ delta: e.delta }) }
      : { event: e.type, data: JSON.stringify((e as { data: unknown }).data) },
  );
}
