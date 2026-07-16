import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// PR-4 safety net: the frame-replay characterization the architecture track
// (PR-5 reducer, PR-6 model, PR-7 store) validates against. A recorded
// LabStreamEvent[] is folded through the real threadStore.applyFrame read model,
// then turnToMessage commits it — proving the settle→committed-message result and
// the superseded-card collapse stay byte-stable as the fold logic is refactored.
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

import { useThread } from '@/features/lab/stores/threadStore';
import type { LabStreamEvent } from '@/features/lab/streaming/labStreamTypes';
import {
  turnToMessage,
  collapseSupersededCards,
  computeLatestDraft,
  draftGapCount,
} from '../controllers/turnFold';
import { messageText, textContent, type Message } from '../types/message';

/** Replay a recorded frame sequence through the live read model, as the
 *  transport's onEvent → applyFrame does, and return the settled turn. */
const replay = (frames: LabStreamEvent[]) => {
  useThread.getState().startTurn();
  const apply = useThread.getState().applyFrame;
  frames.forEach((f) => apply(f));
  return useThread.getState().turn;
};

beforeEach(() => useThread.getState().reset());

describe('frame replay → committed message (turn fold)', () => {
  it('token deltas + a data card + done → one bot message', () => {
    const turn = replay([
      { type: 'stage', data: { phase: 'ai_running' } },
      { type: 'token', delta: 'Hello' },
      { type: 'token', delta: ' world' },
      { type: 'data', data: { type: 'product_list', data: { results: [{ id: 1 }] } } },
      { type: 'done', data: { used_tools: ['search_products'] } },
    ]);
    expect(turn.status).toBe('done');
    const msg = turnToMessage(turn, 'find lathes');
    expect(msg).not.toBeNull();
    expect(msg!.role).toBe('assistant');
    expect(msg!.reason).toBe('complete');
    expect(messageText(msg!)).toBe('Hello world');
    expect(msg!.cards).toEqual([{ type: 'product_list', data: { results: [{ id: 1 }] } }]);
    expect(msg!.retry).toBeUndefined();
  });

  it('error frame → err message carrying detail + retry text', () => {
    const turn = replay([
      { type: 'token', delta: 'partial' },
      { type: 'error', data: { detail: 'Upstream failed', code: 'E1', retriable: true } },
    ]);
    expect(turn.status).toBe('error');
    const msg = turnToMessage(turn, 'my question');
    expect(msg!.role).toBe('assistant');
    expect(msg!.reason).toBe('failed');
    expect(messageText(msg!)).toBe('Upstream failed');
    expect(msg!.retry).toBe('my question');
  });

  it('empty settled turn (no text, no cards) commits nothing', () => {
    const turn = replay([{ type: 'done', data: {} }]);
    expect(turnToMessage(turn, '')).toBeNull();
  });

  it('a re-emitted singleton draft replaces in place (latest wins) + mirrors to turn.draft', () => {
    const turn = replay([
      { type: 'data', data: { type: 'listing_draft', data: { fields: {}, step: 1 } } },
      { type: 'data', data: { type: 'listing_draft', data: { fields: {}, step: 2 } } },
      { type: 'done', data: {} },
    ]);
    expect(turn.cards).toHaveLength(1);
    expect(turn.cards[0]).toEqual({ type: 'listing_draft', data: { fields: {}, step: 2 } });
    expect(turn.draft).toEqual({ fields: {}, step: 2 });
  });

  it('warning + heartbeat frames are no-ops', () => {
    const turn = replay([
      { type: 'token', delta: 'hi' },
      { type: 'warning', data: { code: 'MAX_TURNS_EXCEEDED' } },
      { type: 'heartbeat', data: { ts: 1 } },
      { type: 'done', data: {} },
    ]);
    expect(turn.text).toBe('hi');
    expect(turn.status).toBe('done');
  });
});

describe('collapseSupersededCards', () => {
  const draft = (step: number): Message => ({
    id: `bot-${step}`,
    role: 'assistant',
    createdAt: 0,
    reason: 'complete',
    content: textContent(''),
    cards: [{ type: 'listing_draft', data: { step } }],
  });

  it('keeps only the last committed copy of a latest-wins card', () => {
    const out = collapseSupersededCards([draft(1), draft(2)], new Set());
    expect(out[0].cards).toBeUndefined(); // superseded
    expect(out[1].cards).toEqual([{ type: 'listing_draft', data: { step: 2 } }]);
  });

  it('hides every committed copy when the live turn carries that type', () => {
    const out = collapseSupersededCards([draft(1), draft(2)], new Set(['listing_draft']));
    expect(out[0].cards).toBeUndefined();
    expect(out[1].cards).toBeUndefined();
  });

  it('leaves non-singleton cards untouched and preserves message identity when unchanged', () => {
    const msg: Message = {
      id: 'b',
      role: 'assistant',
      createdAt: 0,
      reason: 'complete',
      content: textContent(''),
      cards: [{ type: 'product_list', data: {} }],
    };
    const out = collapseSupersededCards([msg], new Set(['listing_draft']));
    expect(out[0]).toBe(msg); // same reference (memo holds)
  });
});

describe('computeLatestDraft + draftGapCount', () => {
  it('prefers the live turn draft over committed history', () => {
    const messages: Message[] = [
      {
        id: 'b',
        role: 'assistant',
        createdAt: 0,
        reason: 'complete',
        content: textContent(''),
        cards: [{ type: 'listing_draft', data: { from: 'history' } }],
      },
    ];
    const live = [{ type: 'listing_draft', data: { from: 'live' } }];
    expect(computeLatestDraft(live, messages)).toEqual({ from: 'live' });
    expect(computeLatestDraft([], messages)).toEqual({ from: 'history' });
    expect(computeLatestDraft([], [])).toBeNull();
  });

  it('counts gaps and drops country when location is present', () => {
    expect(draftGapCount(null)).toBe(0);
    expect(draftGapCount({ missing_required: ['product_title', 'price_per_unit'] } as never)).toBe(2);
    expect(
      draftGapCount({ missing_required: ['location', 'country'], low_confidence: ['brand'] } as never),
    ).toBe(2); // country dropped (location present) → {location, brand}
  });
});
