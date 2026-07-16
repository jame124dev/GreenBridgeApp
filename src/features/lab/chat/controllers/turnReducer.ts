// Pure turn reducer (A2 §7.2 / §9) — the deterministic transition function for
// the single in-flight turn. `reduce(turn, input) → { turn, effects }` has NO
// I/O, clock, or randomness; the orchestrator (useChatController) is the sole
// executor of the returned effects (A2 §7.2). This is the PR-5 seam.
//
// PHASE-1 BEHAVIOR-NEUTRALITY: A2 §9.2 specifies the full A3 state machine
// (CONNECTING/CONNECTED/THINKING, success haptic, cancelPost, INTERRUPTED-vs-
// FAILED). The current transport does not emit the signals those states need
// (OPENED/READY) and today's UI fires NO success haptic and has no cancel POST.
// So this reducer reproduces TODAY'S behavior exactly — reachable states are the
// subset {IDLE, STREAMING, COMPLETED, FAILED}; effects match the current commit +
// haptics.error()-on-error. The richer machine is a Phase-2 wiring change, not a
// Phase-1 behavior change (roadmap PR-5: "matching current side effects").
import type { LabStreamEvent } from '@/features/lab/streaming/labStreamTypes';

/** A3 §7.2 protocol states (full union for forward-compat; Phase 1 reaches the
 *  subset the current transport can drive). */
export type ProtocolState =
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'THINKING'
  | 'STREAMING'
  | 'COMPLETED'
  | 'STOPPED'
  | 'INTERRUPTED'
  | 'FAILED'
  | 'CANCELLED_EMPTY';

/** Coarse legacy status (A2 §11) — a PURE projection of `state`, kept on the
 *  turn during migration so existing consumers render byte-identically. */
export type TurnStatus = 'idle' | 'streaming' | 'done' | 'error';

export type CompletionReason = 'complete' | 'stopped' | 'interrupted' | 'failed';

/** One card produced by an `event: data` frame, kept in arrival order. */
export type TurnCard = { type: string; data: unknown };

/** Card types that represent a SINGLE evolving entity, not a log entry: a
 *  live-built listing/WTB draft streams many progressive frames and the "how to
 *  start" options re-emit every turn. Only the latest instance should show — a
 *  new frame REPLACES the prior same-type card. Consumed here (within-turn) and
 *  by the chat thread renderer (across committed turns). */
export const LATEST_WINS_CARD_TYPES = new Set<string>([
  'listing_draft',
  'listing_entry_options',
  'listing_queue',
  'wtb_draft',
]);

export type Turn = {
  /** A3 §7.2 lifecycle state — the single source of truth for the turn. */
  state: ProtocolState;
  /** Legacy coarse status — ALWAYS the §11 projection of `state` (never set
   *  independently). Retained for un-migrated consumers. */
  status: TurnStatus;
  /** Latest `stage.phase` (detect pipeline progress). */
  phase?: string;
  /** Accumulated `token` deltas (raw buffer; A3 G3). Named `text` (not A2's
   *  `buffer`) to keep consumers byte-identical — cosmetic rename is deferred. */
  text: string;
  /** Every `data` card in arrival order (latest-wins for singletons). */
  cards: TurnCard[];
  /** The last `listing_draft`/`wtb_draft` payload (live-built draft mirror). */
  draft?: unknown;
  /** Set from the terminal `error` frame. */
  error?: { detail?: string; code?: string; retriable?: boolean };
};

/** Orchestrator command inputs (A2 §9.1). START opens a fresh turn; STOP is a
 *  user-initiated cancel of the live turn (commit partial, or drop if empty). */
export type Command = { kind: 'start' } | { kind: 'stop' };
/** The reducer input alphabet (A2 §9.1) — commands + protocol frames. */
export type TurnInput = Command | LabStreamEvent;

/** Effects the orchestrator executes (A2 §12). Phase 1 emits commit/reset/haptic
 *  matching today's behavior (no cancelPost, no success haptic). */
export type Effect =
  | { kind: 'commit'; reason: CompletionReason }
  | { kind: 'reset' }
  | { kind: 'cancelPost' }
  | { kind: 'haptic'; of: 'success' | 'error' };

/** A2 §11 legacy status projection. */
export function projectStatus(state: ProtocolState): TurnStatus {
  switch (state) {
    case 'IDLE':
    case 'CANCELLED_EMPTY':
      return 'idle';
    case 'CONNECTING':
    case 'CONNECTED':
    case 'THINKING':
    case 'STREAMING':
      return 'streaming';
    case 'COMPLETED':
    case 'STOPPED':
      return 'done';
    case 'INTERRUPTED':
    case 'FAILED':
      return 'error';
  }
}

/** Build a turn with `status` kept in sync with `state` (§11). */
function withState(t: Omit<Turn, 'status'> & { state: ProtocolState }): Turn {
  return { ...t, status: projectStatus(t.state) };
}

export const emptyTurn = (): Turn => withState({ state: 'IDLE', text: '', cards: [] });
const freshStreaming = (): Turn => withState({ state: 'STREAMING', text: '', cards: [] });

const NO_EFFECTS: Effect[] = [];

/**
 * Pure transition. Every `(turn, input)` pair has a defined result; unknown
 * frames are no-ops (A2 §9.3 total function). Terminal transitions emit exactly
 * one commit + reset (A3 G2), matching the current controller's commit-on-settle.
 */
export function reduce(turn: Turn, input: TurnInput): { turn: Turn; effects: Effect[] } {
  // START (command): open a fresh streaming turn from any state (mirrors the
  // current `startTurn()` which resets to a streaming shell unconditionally).
  if ('kind' in input && input.kind === 'start') {
    return { turn: freshStreaming(), effects: NO_EFFECTS };
  }

  if ('kind' in input && input.kind === 'stop') {
    // User-initiated Stop. Only meaningful while a turn is live; a settled/idle
    // turn is a no-op (guards rapid double-tap Stop). Keep whatever streamed:
    // partial text/cards commit as a normal bot bubble (STOPPED→'done'); an empty
    // stop keeps nothing (CANCELLED_EMPTY→'idle').
    if (turn.status !== 'streaming') return { turn, effects: NO_EFFECTS };
    const hasContent = turn.text.length > 0 || turn.cards.length > 0;
    if (hasContent) {
      return {
        turn: withState({ ...turn, state: 'STOPPED' }),
        effects: [{ kind: 'commit', reason: 'stopped' }, { kind: 'reset' }],
      };
    }
    return {
      turn: withState({ ...turn, state: 'CANCELLED_EMPTY' }),
      effects: [{ kind: 'reset' }],
    };
  }

  const ev = input as LabStreamEvent;
  switch (ev.type) {
    case 'token':
      return { turn: withState({ ...turn, text: turn.text + ev.delta }), effects: NO_EFFECTS };

    case 'data': {
      const card: TurnCard = { type: ev.data.type, data: ev.data.data };
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
      const next = withState({ ...turn, cards });
      if (ev.data.type === 'listing_draft' || ev.data.type === 'wtb_draft') {
        next.draft = ev.data.data;
      }
      return { turn: next, effects: NO_EFFECTS };
    }

    case 'stage':
      return { turn: withState({ ...turn, phase: ev.data.phase }), effects: NO_EFFECTS };

    case 'done':
      // Terminal success. Commit (turnToMessage yields a bot message or null for
      // an empty turn) + reset. No haptic on success (matches today).
      return {
        turn: withState({ ...turn, state: 'COMPLETED' }),
        effects: [{ kind: 'commit', reason: 'complete' }, { kind: 'reset' }],
      };

    case 'error':
      // Terminal failure. Capture the error, commit the err message (+ retry),
      // reset, and fire the error haptic — exactly today's behavior.
      return {
        turn: withState({
          ...turn,
          state: 'FAILED',
          error: {
            detail: ev.data.detail ?? ev.data.error ?? ev.data.message,
            code: ev.data.code,
            retriable: ev.data.retriable,
          },
        }),
        effects: [{ kind: 'commit', reason: 'failed' }, { kind: 'reset' }, { kind: 'haptic', of: 'error' }],
      };

    case 'warning':
    case 'heartbeat':
    default:
      return { turn, effects: NO_EFFECTS }; // non-blocking / unknown → no-op
  }
}
