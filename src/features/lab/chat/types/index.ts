// Chat domain type surface (A2 / A3 / A4). Feature-scoped: these names are
// namespaced by this path, not exported globally. There is intentionally NO
// feature-level barrel — imports of chat internals stay explicit to avoid
// dependency tangles. If a type ever leaves the chat boundary, revisit its
// naming then.
//
// UNUSED by production until the migration PRs (see each module's header).
export type { Card } from './card';
export type {
  ChatRole,
  ContentPart,
  Attachment,
  CompletionReason,
  Message,
} from './message';
export type { ConversationLifecycle, Conversation } from './conversation';
export type { ActiveTurn, Effect, TurnReducer } from './turn';
export type {
  ProtocolState,
  Command,
  TransportSignal,
  TurnInput,
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
} from './protocol';
export type { ChatActions } from './actions';
export type { ContentPartRenderer, CardRendererEntry } from './registry';
