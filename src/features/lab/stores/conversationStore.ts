// Committed conversation messages — the single source of truth (A2 §7.1 / I2).
// PR-7: `messages[]` moves OUT of the chat screen's `useState` into this store,
// keyed by `conversationId`, so no component holds a second mutable copy.
//
// PHASE-1 BEHAVIOR-NEUTRAL: this is IN-MEMORY ONLY (no MMKV). A2 §14 makes the
// conversation durable, but persisting now would make messages survive reload =
// a visible behavior change (resume). So the store lives in memory and the chat
// screen re-`seed`s its conversation on each mount (mirroring the old per-mount
// `useState` initializer) → navigating away and back still starts fresh, exactly
// as today. Durable persistence is a Phase-2 item (roadmap PR-7).
import { create } from 'zustand';

import type { Message } from '@/features/lab/chat/types/message';

/** Stable empty default so a missing conversation selects the same reference. */
const EMPTY: readonly Message[] = Object.freeze([]);

type ConversationState = {
  /** conversationId → committed, append-only messages (A2 principle 3 / I7). */
  byId: Record<string, Message[]>;
  /** Overwrite a conversation's messages — the mount-time seed (replaces the old
   *  per-mount `useState` init; keeps re-entry fresh, no resume). */
  seed: (conversationId: string, messages: Message[]) => void;
  /** Append committed message(s) to a conversation (append-only). */
  append: (conversationId: string, messages: Message[]) => void;
};

export const useConversation = create<ConversationState>((set) => ({
  byId: {},
  seed: (id, messages) => set((s) => ({ byId: { ...s.byId, [id]: messages } })),
  append: (id, messages) =>
    set((s) => ({ byId: { ...s.byId, [id]: [...(s.byId[id] ?? EMPTY), ...messages] } })),
}));

/** Narrow selector (A2 §15.1): the committed messages for one conversation. */
export const selectMessages =
  (conversationId: string) =>
  (s: ConversationState): Message[] =>
    s.byId[conversationId] ?? (EMPTY as Message[]);
