// Reusable conversation (Message[]) builder for chat tests (PR-0 → PR-6).
import type { Message } from '@/features/lab/chat/types/message';

import { buildBotMessage, buildUserMessage } from './message';

/** A committed history. Pass explicit messages, else a default 1-turn thread. */
export function buildConversation(messages?: Message[]): Message[] {
  return messages ?? [buildUserMessage(), buildBotMessage()];
}
