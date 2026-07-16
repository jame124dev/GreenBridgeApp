// Chat domain type — A2 §12 / §13. The durable conversation entity.
//
// The single source of truth for committed messages (A2 I2), keyed by
// conversationId in the future `conversationStore`. Scoped to the chat feature.
//
// UNUSED by production until PR-7.
import type { Message } from './message';

/** A2 §13 entity lifecycle. Per-turn outcomes are recorded within `active`. */
export type ConversationLifecycle = 'active' | 'archived';

export interface Conversation {
  id: string;
  /** Append-only, immutable messages (A2 principle 3 / I7). */
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  lifecycle: ConversationLifecycle;
}
