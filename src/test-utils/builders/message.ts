// Reusable Message builders for chat tests (PR-0 → PR-6: now the A2 §12 model).
// Deterministic ids/createdAt so golden snapshots stay stable; the `text`/`cards`/
// `sources`/`retry` convenience overrides map onto the `content: ContentPart[]`
// model so call sites stay terse.
import { textContent, type Message } from '@/features/lab/chat/types/message';
import type { TurnCard } from '@/features/lab/stores/threadStore';

type BuildOpts = {
  id?: string;
  text?: string;
  cards?: TurnCard[];
  sources?: string[];
  retry?: string;
};

export function buildUserMessage(o: BuildOpts = {}): Message {
  return {
    id: o.id ?? 'user-1',
    role: 'user',
    createdAt: 0,
    content: textContent(o.text ?? 'Find me a CNC lathe'),
    ...(o.cards ? { cards: o.cards } : {}),
  };
}

export function buildBotMessage(o: BuildOpts = {}): Message {
  return {
    id: o.id ?? 'bot-1',
    role: 'assistant',
    createdAt: 0,
    reason: 'complete',
    content: textContent(o.text ?? 'Here is what I found.'),
    ...(o.cards ? { cards: o.cards } : {}),
    ...(o.sources ? { sources: o.sources } : {}),
  };
}

export function buildErrorMessage(o: BuildOpts = {}): Message {
  return {
    id: o.id ?? 'err-1',
    role: 'assistant',
    createdAt: 0,
    reason: 'failed',
    content: textContent(o.text ?? 'Something went wrong'),
    retry: o.retry ?? 'Find me a CNC lathe',
  };
}

export function buildCard(type: string, data: unknown = {}): TurnCard {
  return { type, data };
}
