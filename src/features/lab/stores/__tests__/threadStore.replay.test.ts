import { describe, it, expect, beforeEach } from '@jest/globals';

import {
  buildTurnEvents,
  dataEvent,
  errorEvent,
  expectedTurnText,
  heartbeatEvent,
  warningEvent,
} from '@/test-utils/builders';

import { useThread } from '../threadStore';

// PR-0 baseline: pins the CURRENT `applyFrame` reducer behavior so PR-5 (pure
// reducer extraction) can prove it reproduces this output byte-for-byte. Pure
// store logic — no rendering, no transport.

const reset = () => useThread.getState().reset();
const start = () => useThread.getState().startTurn();
const apply = (ev: Parameters<ReturnType<typeof useThread.getState>['applyFrame']>[0]) =>
  useThread.getState().applyFrame(ev);
const turn = () => useThread.getState().turn;
const effects = () => useThread.getState().pendingEffects;

describe('threadStore.applyFrame — replay baseline', () => {
  beforeEach(reset);

  it('folds a representative turn into text + card + draft + done', () => {
    start();
    for (const ev of buildTurnEvents({ withCard: true, tools: ['search_marketplace'] })) apply(ev);

    const t = turn();
    expect(t.status).toBe('done');
    expect(t.text).toBe(expectedTurnText());
    expect(t.phase).toBe('ai_running'); // last stage before done
    expect(t.cards).toHaveLength(1);
    expect(t.cards[0].type).toBe('listing_draft');
    expect(t.draft).toBeDefined(); // listing_draft mirrors into turn.draft
  });

  it('golden: settled turn shape', () => {
    start();
    for (const ev of buildTurnEvents({ withCard: true })) apply(ev);
    expect(turn()).toMatchSnapshot();
  });

  it('is a no-op on warning and heartbeat (non-terminal, no status change)', () => {
    start();
    apply(warningEvent({ code: 'MAX_TURNS_EXCEEDED' }));
    apply(heartbeatEvent(123));
    const t = turn();
    expect(t.status).toBe('streaming');
    expect(t.text).toBe('');
    expect(t.cards).toHaveLength(0);
  });

  it('replaces a latest-wins singleton card in place (listing_draft)', () => {
    start();
    apply(dataEvent('listing_draft', { title: 'First' }));
    apply(dataEvent('listing_draft', { title: 'Second' }));
    const t = turn();
    expect(t.cards).toHaveLength(1);
    expect((t.cards[0].data as { title: string }).title).toBe('Second');
  });

  it.each([
    ['detail', errorEvent({ detail: 'from-detail' }), 'from-detail'],
    ['error', errorEvent({ error: 'from-error' }), 'from-error'],
    ['message', errorEvent({ message: 'from-message' }), 'from-message'],
  ])('resolves the error message via tri-key tolerance (%s)', (_k, ev, expected) => {
    start();
    apply(ev);
    const t = turn();
    expect(t.status).toBe('error');
    expect(t.error?.detail).toBe(expected);
  });
});

// User-initiated Stop command (the mid-stream Stop button). Additive — the
// start/frame cases above are unchanged.
describe('threadStore.dispatch({ kind: "stop" }) — Stop command', () => {
  beforeEach(reset);
  const stop = () => useThread.getState().dispatch({ kind: 'stop' });

  it('streaming + partial content → STOPPED (projects done) + [commit stopped, reset]', () => {
    start();
    apply({ type: 'token', delta: 'partial answer' });
    stop();
    const t = turn();
    expect(t.state).toBe('STOPPED');
    expect(t.status).toBe('done'); // commits as a normal bot bubble, not an error
    expect(effects()).toEqual([{ kind: 'commit', reason: 'stopped' }, { kind: 'reset' }]);
  });

  it('streaming + empty (no text/cards) → CANCELLED_EMPTY (projects idle) + [reset] only', () => {
    start();
    stop();
    const t = turn();
    expect(t.state).toBe('CANCELLED_EMPTY');
    expect(t.status).toBe('idle');
    expect(effects()).toEqual([{ kind: 'reset' }]);
  });

  it('idle + stop → no-op (guards a rapid double-tap Stop)', () => {
    stop(); // turn is idle
    expect(turn().status).toBe('idle');
    expect(effects()).toEqual([]);
  });
});
