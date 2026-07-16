// Chat domain type — A2 §12. The go-forward message model.
//
// Replaces the legacy `AiMsg` (`chat/types.ts`): role `'user'|'bot'|'err'` →
// `'user'|'assistant'` + `reason`; flat `text` → `content: ContentPart[]`
// (multimodal-ready, A2 §18); `tools` → `sources`. Scoped to the chat feature.
//
// UNUSED by production until PR-6.
import type { Card } from './card';

export type ChatRole = 'user' | 'assistant';

/** Extensible content model (A2 §12/§18): text today; image/audio/reasoning
 *  parts added later as additional `kind`s without reshaping `Message`. */
export type ContentPart = { kind: 'text'; text: string };

/** User attachment — local display URI (A2 §8 row 15). */
export interface Attachment {
  uri: string;
  isImage: boolean;
  name: string;
}

/** How an assistant turn ended (A2 §10.9 / A3 §10.9). Derived solely from the
 *  terminal protocol state (A2 I8); never set independently. */
export type CompletionReason = 'complete' | 'stopped' | 'interrupted' | 'failed';

/** Text content part factory (the common single-text-part case, A2 §12). */
export const textContent = (text: string): ContentPart[] => [{ kind: 'text', text }];

/** Concatenate the text parts of a message (the rendered prose). */
export function messageText(m: Message): string {
  return m.content
    .filter((p): p is Extract<ContentPart, { kind: 'text' }> => p.kind === 'text')
    .map((p) => p.text)
    .join('');
}

/** An assistant message that ended in a failure/interruption (A2 I8) → renders
 *  as the error bubble + Retry (replaces the legacy `role: 'err'`). */
export function isErrorMessage(m: Message): boolean {
  return m.role === 'assistant' && (m.reason === 'failed' || m.reason === 'interrupted');
}

/** Append-only + immutable once committed (A2 principle 3 / I7). */
export interface Message {
  /** Stable, monotonic; never the array index (A2 §15.5). */
  id: string;
  role: ChatRole;
  /** Stamped by the effect executor, not the reducer (A2 §9.3). */
  createdAt: number;
  content: ContentPart[];
  cards?: Card[];
  /** `used_tools` from the terminal frame (A2 §8 row 10). */
  sources?: string[];
  /** Assistant only; from the terminal turn state (A2 I8). */
  reason?: CompletionReason;
  /** User text to re-send on Retry (set on failed/interrupted). */
  retry?: string;
  /** User only; local display URIs. */
  attachments?: Attachment[];
}
