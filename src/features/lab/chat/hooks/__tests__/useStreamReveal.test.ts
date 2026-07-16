// Characterizes the reveal buffer, focused on the new-turn reset (the bugfix:
// a fresh turn clears `turn.text` to '' and the bubble must fall back to the
// thinking state, NOT keep showing the previous turn's revealed text).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => false }));

import { useStreamReveal } from '../useStreamReveal';

describe('useStreamReveal', () => {
  let raf: Array<FrameRequestCallback>;

  beforeEach(() => {
    raf = [];
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      raf.push(cb);
      return raf.length;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Run the currently-queued frame callbacks `n` times (each frame may enqueue
  // the next), inside act() so state updates flush.
  const flush = (n = 1) => {
    for (let i = 0; i < n; i++) {
      act(() => {
        const q = raf;
        raf = [];
        q.forEach((cb) => cb(0));
      });
    }
  };

  it('reveals the streamed text (char cadence)', () => {
    const { result, rerender } = renderHook(
      (props: { s: string }) => useStreamReveal(props.s, false),
      { initialProps: { s: '' } },
    );
    rerender({ s: 'Hello there friend' });
    flush(40);
    expect(result.current).toBe('Hello there friend');
  });

  it('clears the buffer when a new turn resets the source to empty (no stale reply)', () => {
    const { result, rerender } = renderHook(
      (props: { s: string }) => useStreamReveal(props.s, false),
      { initialProps: { s: '' } },
    );

    // Turn 1 streams + fully reveals.
    rerender({ s: 'Could you specify what type of bottle?' });
    flush(60);
    expect(result.current).toBe('Could you specify what type of bottle?');

    // New turn: the store resets `turn.text` to ''. The revealed buffer MUST
    // drop to '' so the streaming bubble shows thinking dots, not the old answer.
    // The render-time clamp produces '' IMMEDIATELY (before any tick runs) — the
    // tick-side reset alone was one frame late, flashing the stale reply once.
    rerender({ s: '' });
    expect(result.current).toBe('');
    flush(1);
    expect(result.current).toBe('');
  });

  it('never returns text that is not a prefix of the current source (turn 2 differs from turn 1)', () => {
    const { result, rerender } = renderHook(
      (props: { s: string }) => useStreamReveal(props.s, false),
      { initialProps: { s: '' } },
    );
    rerender({ s: 'first answer' });
    flush(40);
    expect(result.current).toBe('first answer');

    // Reset + next turn open BEFORE any tick runs — the clamp must never let a
    // frame show text that is not a prefix of the live source.
    rerender({ s: '' });
    expect(result.current).toBe('');
    rerender({ s: 'second' });
    expect('second'.startsWith(result.current)).toBe(true);
    flush(40);
    expect(result.current).toBe('second');
  });

  it('reveals the NEXT turn cleanly after a reset', () => {
    const { result, rerender } = renderHook(
      (props: { s: string }) => useStreamReveal(props.s, false),
      { initialProps: { s: '' } },
    );
    rerender({ s: 'first answer' });
    flush(40);
    rerender({ s: '' });
    flush(1);
    rerender({ s: 'second answer' });
    flush(40);
    expect(result.current).toBe('second answer');
  });
});
