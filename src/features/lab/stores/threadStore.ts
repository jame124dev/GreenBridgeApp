// Current-turn state for the (lab) customer-app AI flow
// (NewVersion/dynamic/04-mobile-integration-plan.md §3.3). This is the store the
// processing / draft specialists READ: `labStream`'s `onEvent` frames are folded
// into `turn` via `applyFrame`, and screens render from `turn.{text,cards,draft,
// phase,status,error}`. Ephemeral (not persisted) — one active turn at a time;
// call `startTurn()` before opening a stream and `reset()` to clear.
import { create } from 'zustand';

import type { LabStreamEvent } from '@/features/lab/streaming/labStreamTypes';

/** One card produced by an `event: data` frame, kept in arrival order. */
export type TurnCard = { type: string; data: unknown };

/** Card types that represent a SINGLE evolving entity, not a log entry: a
 *  live-built listing/WTB draft streams many progressive frames (2/7 → 3/7 → …)
 *  and the "how to start" options re-emit every turn. Only the latest instance
 *  should ever show — a new frame REPLACES the prior same-type card instead of
 *  stacking a duplicate. Consumed here (within-turn) and by the chat thread
 *  renderer (across committed turns). */
export const LATEST_WINS_CARD_TYPES = new Set<string>([
  'listing_draft',
  'listing_entry_options',
  // The multi-product overview: a re-emitted queue replaces the prior one in
  // place within a turn and collapses across committed turns. queue + draft are
  // appended as ONE bot message (see useBatchProducts), so they collapse together
  // and the overview never orphans. NOTE: 'listing_group_choice' (one-time
  // chooser) and 'listing_batch_result' are deliberately NOT here — they persist
  // as log entries.
  'listing_queue',
  'wtb_draft',
]);

export type TurnStatus = 'idle' | 'streaming' | 'done' | 'error';

export type Turn = {
  status: TurnStatus;
  /** Latest `stage.phase` (detect pipeline progress). */
  phase?: string;
  /** Accumulated `token` deltas (the streaming bot prose). */
  text: string;
  /** Every `data` card in arrival order. */
  cards: TurnCard[];
  /** The last `data{type:'listing_draft'}` payload (live-built listing draft). */
  draft?: unknown;
  /** Set from the terminal `error` frame. */
  error?: { detail?: string; code?: string; retriable?: boolean };
};

const emptyTurn = (): Turn => ({ status: 'idle', text: '', cards: [] });

type ThreadState = {
  turn: Turn;
  /** Reset the turn to a fresh `streaming` shell (call before opening a stream). */
  startTurn: () => void;
  /** Fold one typed stream frame into `turn`. Safe to call for any frame type. */
  applyFrame: (ev: LabStreamEvent) => void;
  /** Clear back to idle/empty. */
  reset: () => void;
};

export const useThread = create<ThreadState>((set) => ({
  turn: emptyTurn(),

  startTurn: () => set({ turn: { ...emptyTurn(), status: 'streaming' } }),

  applyFrame: (ev) =>
    set((s) => {
      const turn = s.turn;
      switch (ev.type) {
        case 'token':
          return { turn: { ...turn, text: turn.text + ev.delta } };
        case 'data': {
          const card: TurnCard = { type: ev.data.type, data: ev.data.data };
          // Singleton cards replace their prior same-type instance in place (a
          // live build streams many frames); everything else appends in order.
          let cards: TurnCard[];
          if (LATEST_WINS_CARD_TYPES.has(card.type)) {
            const idx = turn.cards.findIndex((c) => c.type === card.type);
            if (idx >= 0) {
              cards = turn.cards.slice();
              cards[idx] = card;
            } else {
              cards = [...turn.cards, card];
            }
          } else {
            cards = [...turn.cards, card];
          }
          const next: Turn = { ...turn, cards };
          // The live draft mirrors into `draft` (latest wins) — a `listing_draft`
          // (sell) OR a `wtb_draft` (buy); the Draft screen reads `turn.draft`
          // and `draftFromFrame` maps both, so buyer drafts must mirror too.
          if (ev.data.type === 'listing_draft' || ev.data.type === 'wtb_draft') {
            next.draft = ev.data.data;
          }
          return { turn: next };
        }
        case 'stage':
          return { turn: { ...turn, phase: ev.data.phase } };
        case 'done':
          return { turn: { ...turn, status: 'done' } };
        case 'error':
          return {
            turn: {
              ...turn,
              status: 'error',
              error: {
                detail: ev.data.detail ?? ev.data.error ?? ev.data.message,
                code: ev.data.code,
                retriable: ev.data.retriable,
              },
            },
          };
        case 'warning':
        case 'heartbeat':
        default:
          return { turn }; // non-blocking / no-op
      }
    }),

  reset: () => set({ turn: emptyTurn() }),
}));
