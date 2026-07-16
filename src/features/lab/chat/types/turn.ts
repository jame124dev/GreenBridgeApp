// Chat domain type — A2 §12 (§7.2/§9). The single in-flight turn (ephemeral,
// never persisted) plus the pure reducer's effect vocabulary.
//
// Replaces the legacy `Turn` (`stores/threadStore.ts`): `status` → `state`
// (A3 §7.2 states), `text` → `buffer` (raw token accumulation, A3 G3). Scoped
// to the chat feature.
//
// UNUSED by production until PR-5.
import type { Card } from './card';
import type { CompletionReason } from './message';
import type { ProtocolState, TurnInput } from './protocol';

/** The one active turn read model (A2 §12; single-flight, A3 G11). */
export interface ActiveTurn {
  /** A3 §7.2 — the authoritative lifecycle. */
  state: ProtocolState;
  /** Latest `stage.phase`. */
  phase?: string;
  /** Raw token accumulation (A3 G3, append-only). Presentation reveal is a
   *  separate leaf-local concern (A2 rows 5/6) — not this field. */
  buffer: string;
  cards: Card[];
  draft?: unknown;
  sources?: string[];
  error?: { message: string; code: string; retriable: boolean };
  /** Negotiated per connection (A3 §10.1). */
  protocolVersion?: number;
  /** Advertised heartbeat interval (A3 §10.6). */
  heartbeatMs?: number;
}

/** A2 §7.2/§9 — effects the pure reducer returns; the controller executes them
 *  (the reducer performs no side effects). */
export type Effect =
  | { kind: 'commit'; reason: CompletionReason }
  | { kind: 'reset' }
  | { kind: 'cancelPost' }
  | { kind: 'haptic'; of: 'success' | 'error' };

/** A2 §9 — the pure reducer signature. Implemented in PR-5. */
export type TurnReducer = (
  turn: ActiveTurn,
  input: TurnInput,
) => { turn: ActiveTurn; effects: Effect[] };
