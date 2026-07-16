// Current-turn read model for the (lab) customer-app AI flow
// (NewVersion/dynamic/04-mobile-integration-plan.md §3.3; A2 §7 activeTurnStore).
// PR-5: the fold is now the PURE reducer (`controllers/turnReducer`); this store
// is just the observable read model + a pending-effects queue the orchestrator
// (useChatController) drains. `dispatch(input)` runs `reduce`, sets the new turn,
// and enqueues the returned effects. `applyFrame`/`startTurn` are thin wrappers
// kept for the transport + existing callers (behavior-neutral).
//
// NOTE: A2/A4 name this `activeTurnStore`; the rename is a cosmetic, high-ripple
// change deferred to PR-11. The domain types (Turn/TurnCard/LATEST_WINS_CARD_TYPES)
// now live in the reducer and are re-exported here so existing importers are
// unaffected.
import { create } from 'zustand';

import type { LabStreamEvent } from '@/features/lab/streaming/labStreamTypes';
import {
  emptyTurn,
  reduce,
  type Effect,
  type Turn,
  type TurnInput,
} from '@/features/lab/chat/controllers/turnReducer';

// Re-export the domain contracts from their new home (reducer) so existing
// imports from `threadStore` keep working (turnFold, useChatController, types, …).
export {
  LATEST_WINS_CARD_TYPES,
  type Turn,
  type TurnCard,
  type TurnStatus,
  type ProtocolState,
} from '@/features/lab/chat/controllers/turnReducer';

type ThreadState = {
  turn: Turn;
  /** Effects emitted by the reducer, awaiting execution by the orchestrator. */
  pendingEffects: Effect[];
  /** Open a fresh streaming turn (START command). */
  startTurn: () => void;
  /** Fold one typed stream frame into `turn` (transport calls this). */
  applyFrame: (ev: LabStreamEvent) => void;
  /** Run the pure reducer for any input, set the turn, enqueue effects. */
  dispatch: (input: TurnInput) => void;
  /** Clear the executed effects from the queue. */
  drainEffects: () => void;
  /** Clear back to idle/empty (also clears any pending effects). */
  reset: () => void;
};

export const useThread = create<ThreadState>((set) => ({
  turn: emptyTurn(),
  pendingEffects: [],

  dispatch: (input) =>
    set((s) => {
      const { turn, effects } = reduce(s.turn, input);
      return effects.length
        ? { turn, pendingEffects: [...s.pendingEffects, ...effects] }
        : { turn };
    }),

  startTurn: () => set((s) => reduceInto(s, { kind: 'start' })),

  applyFrame: (ev) => set((s) => reduceInto(s, ev)),

  drainEffects: () => set({ pendingEffects: [] }),

  reset: () => set({ turn: emptyTurn(), pendingEffects: [] }),
}));

/** Shared reduce→set body for dispatch/startTurn/applyFrame. */
function reduceInto(
  s: { turn: Turn; pendingEffects: Effect[] },
  input: TurnInput,
): Partial<ThreadState> {
  const { turn, effects } = reduce(s.turn, input);
  return effects.length ? { turn, pendingEffects: [...s.pendingEffects, ...effects] } : { turn };
}
