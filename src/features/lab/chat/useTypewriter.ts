// Decoupled reveal buffer for the streaming bot bubble (05-mobile-ux §3.1).
// SSE `token` frames arrive bursty; rendering each delta immediately stutters.
// This hook takes the full accumulated `source` text (threadStore `turn.text`,
// which only ever grows) and reveals it at a steady catch-up cadence so it flows
// instead of chunking — never adding real latency (accelerates when far behind).
//
// Reduced motion OR a settled turn → reveal the full text immediately.
//
// All `setShown` calls happen inside the rAF `tick` callback (never synchronously
// in the effect body) so React's cascading-render lint is satisfied and the
// reveal genuinely syncs rendered text with the animation-frame clock.
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * @param source   the full, growing text (turn.text)
 * @param settled  true once the turn is done/errored → flush instantly
 */
export function useTypewriter(source: string, settled: boolean): string {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState('');

  // Latest inputs read by the frame loop (kept in refs so the loop needn't be
  // re-created on every token — the effect only arms/cancels the loop).
  const sourceRef = useRef(source);
  const instantRef = useRef(reduced || settled);
  const shownLenRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    // Sync the loop's inputs inside the effect (the effect re-runs on every
    // source/settled/reduced change, so these refs stay fresh for `tick`).
    sourceRef.current = source;
    instantRef.current = reduced || settled;

    const tick = () => {
      const src = sourceRef.current;

      // New turn reset (source shrank) — restart the reveal.
      if (src.length < shownLenRef.current) shownLenRef.current = 0;

      // Instant modes commit everything at once.
      if (instantRef.current) {
        if (shownLenRef.current !== src.length) {
          shownLenRef.current = src.length;
          setShown(src);
        }
        rafRef.current = null;
        return;
      }

      const remaining = src.length - shownLenRef.current;
      if (remaining <= 0) {
        rafRef.current = null;
        return;
      }
      // Catch-up: reveal ~1/6 of the backlog per frame (min 1 char) so a burst
      // never lags arrival, a trickle reads as smooth typing.
      const take = Math.max(1, Math.ceil(remaining / 6));
      shownLenRef.current += take;
      setShown(src.slice(0, shownLenRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };

    // Arm the loop whenever there is unrevealed text (or an instant flush is due).
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [source, settled, reduced]);

  return shown;
}
