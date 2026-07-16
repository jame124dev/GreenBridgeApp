// Decoupled reveal buffer for the streaming assistant bubble (05-mobile-ux §3.1;
// A2 rows 5/6 raw-vs-revealed split; A4 §10 hooks/ location). PR-10 relocated
// this from `chat/useTypewriter.ts`. Owned by the one streaming leaf only.
//
// SSE `token` frames arrive bursty; rendering each delta immediately stutters.
// This hook takes the full accumulated `source` text (activeTurn `turn.text`,
// which only ever grows) and reveals it at a steady catch-up cadence so it flows
// instead of chunking — never adding real latency (accelerates when far behind).
//
// R3 (behind CHAT_UI_V2): `byWord` snaps the reveal to whole-word boundaries (the
// Gemini-style cadence) instead of the default per-character catch-up. Char-based
// stays the default so the flag-off path is byte-for-byte the Phase-1 behavior.
//
// Reduced motion OR a settled turn → reveal the full text immediately. The rAF
// loop is cancelled on unmount/dep-change (D4 §motion — no orphaned loops).
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * @param source   the full, growing text (turn.text)
 * @param settled  true once the turn is done/errored → flush instantly
 * @param byWord   R3: reveal whole words at a time (default false = per-char)
 */
export function useStreamReveal(source: string, settled: boolean, byWord = false): string {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState('');

  // Latest inputs read by the frame loop (kept in refs so the loop needn't be
  // re-created on every token — the effect only arms/cancels the loop).
  const sourceRef = useRef(source);
  const instantRef = useRef(reduced || settled);
  const byWordRef = useRef(byWord);
  const shownLenRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    // Sync the loop's inputs inside the effect (the effect re-runs on every
    // source/settled/reduced change, so these refs stay fresh for `tick`).
    sourceRef.current = source;
    instantRef.current = reduced || settled;
    byWordRef.current = byWord;

    const tick = () => {
      const src = sourceRef.current;

      // New turn reset (source shrank, e.g. a fresh turn cleared `turn.text` to
      // '') — restart the reveal AND clear the visible buffer. Without the
      // setShown here, a reset-to-empty falls through to the `remaining <= 0`
      // early-return below and the hook keeps returning the PREVIOUS turn's
      // revealed text — so the new (still-loading) bubble shows the last answer
      // instead of the thinking dots. (bugfix: stale reply during fetch)
      if (src.length < shownLenRef.current) {
        shownLenRef.current = 0;
        setShown(src.slice(0, 0));
      }

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

      if (byWordRef.current) {
        // Word cadence: split the unrevealed tail into whole words (each match
        // carries its own leading/trailing whitespace, so summing lengths keeps
        // the char offset exact), then advance ~1/6 of the remaining words per
        // frame (min 1). Pure trailing whitespace flushes to the end.
        const rest = src.slice(shownLenRef.current);
        const words = rest.match(/\s*\S+\s*/g);
        if (!words) {
          shownLenRef.current = src.length;
        } else {
          const take = Math.max(1, Math.ceil(words.length / 6));
          let adv = 0;
          for (let i = 0; i < take && i < words.length; i++) adv += words[i].length;
          shownLenRef.current += adv;
        }
      } else {
        // Catch-up: reveal ~1/6 of the backlog per frame (min 1 char) so a burst
        // never lags arrival, a trickle reads as smooth typing.
        const take = Math.max(1, Math.ceil(remaining / 6));
        shownLenRef.current += take;
      }
      setShown(src.slice(0, shownLenRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };

    // Arm the loop whenever there is unrevealed text (or an instant flush is due).
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [source, settled, reduced, byWord]);

  // Render-time clamp: the tick-side shrink-reset above is one FRAME late — on
  // the next send, reset()→startTurn() gives source='' while `shown` still holds
  // the previous answer, and the leaf would paint the stale reply once before
  // the tick clears it. Clamp the returned value to the current source
  // synchronously (the tick remains the state cleanup). Append-only happy path:
  // `source.startsWith(shown)` is true → return `shown`, zero allocation.
  return source.startsWith(shown) ? shown : source.slice(0, Math.min(shown.length, source.length));
}
