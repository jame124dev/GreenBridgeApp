// Reusable render-count utilities (PR-0). Used by PR-8 to prove render
// isolation during streaming (A4 §4 / A2 I10): a token burst must produce zero
// re-renders in Tier-0 components. Kept dependency-free so it composes with any
// component tree.
import React, { useRef } from 'react';

/** Increments once per render of the calling component; returns the running
 *  count. Place in a probe component to observe how often a subtree renders. */
export function useRenderCount(): number {
  const ref = useRef(0);
  ref.current += 1;
  return ref.current;
}

/**
 * Wrap a subtree in `<Tracker>` and read `.renders` to count how many times that
 * position re-rendered. `reset()` zeroes it between assertions. In PR-8 the
 * tracker wraps a memoized Tier-0 boundary; an unrelated store update must not
 * increment it.
 */
export function createRenderTracker() {
  const state = { renders: 0 };
  const Tracker: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    state.renders += 1;
    return <>{children}</>;
  };
  Tracker.displayName = 'RenderTracker';
  return {
    Tracker,
    get renders() {
      return state.renders;
    },
    reset() {
      state.renders = 0;
    },
  };
}
