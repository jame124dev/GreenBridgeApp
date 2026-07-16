// Chat domain type — A3 (Streaming Protocol) + A2 §9.1 reducer input alphabet.
//
// The wire event union is RE-EXPORTED from the transport (`labStreamTypes`),
// never redefined — one value/type source for the protocol (A3), this module is
// the go-forward import surface for the chat feature. Scoped to the feature.
//
// UNUSED by production until PR-4/PR-5.
import type {
  LabStreamEvent,
  LabCardType,
  LabStagePhase,
  LabDataEvent,
  LabDoneEvent,
  LabErrorEvent,
  LabStageEvent,
  LabTokenEvent,
  LabWarningEvent,
  LabHeartbeatEvent,
} from '@/features/lab/streaming/labStreamTypes';

export type {
  LabStreamEvent,
  LabCardType,
  LabStagePhase,
  LabDataEvent,
  LabDoneEvent,
  LabErrorEvent,
  LabStageEvent,
  LabTokenEvent,
  LabWarningEvent,
  LabHeartbeatEvent,
};

/** A3 §7.2 — the turn lifecycle states. The ONLY lifecycle (A2 §6); the legacy
 *  4-value `TurnStatus` becomes a derived projection of this (A2 §11). */
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

/** A2 §9.1 — orchestrator commands into the reducer. */
export type Command = { type: 'START'; text: string } | { type: 'CANCEL' };

/** A2 §9.1 — transport signals surfaced to the reducer. Abort is modeled as
 *  `CANCEL`; a watchdog trip maps to `TRANSPORT_FAILURE('connection_lost')`. */
export type TransportSignal =
  | { type: 'OPENED' }
  | { type: 'TRANSPORT_FAILURE'; code: string; retriable: boolean };

/** A2 §9.1 — the reducer's full input alphabet (commands + transport + frames). */
export type TurnInput = Command | TransportSignal | LabStreamEvent;
