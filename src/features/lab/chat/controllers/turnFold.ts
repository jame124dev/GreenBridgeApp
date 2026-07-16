// Pure turn-fold helpers for the (lab) chat thread — extracted VERBATIM from
// `app/(lab)/chat.tsx` (PR-4) so the neutrality-critical folding logic (settle →
// committed message, superseded-card collapse, latest-draft scan, gap count) is
// unit-testable in isolation. No behavior change: these are the same functions,
// same logic, now importable + covered by the frame-replay characterization test.
import i18n from '@/i18n';
import { LATEST_WINS_CARD_TYPES, type Turn } from '@/features/lab/stores/threadStore';
import type { DraftPayload } from '@/features/lab/data/listingDraftApi';
import { newMsgId } from '@/features/lab/chat/types';
import { textContent, type Message } from '@/features/lab/chat/types/message';

/** Fold a settled `turn` into a committed `Message` (or null if empty). PR-6: the
 *  legacy `role: 'bot'|'err'` collapses to `role: 'assistant'` + `reason` (A2 I8)
 *  and flat `text` → `content: ContentPart[]`. `retryText` is the user message
 *  that produced this turn — carried on a failed message so Retry re-sends it
 *  verbatim (05-mobile-ux §8). `createdAt`/`id` are stamped here (the commit
 *  effect-executor context), keeping the reducer itself pure (A2 §9.3). */
export function turnToMessage(turn: Turn, retryText: string): Message | null {
  if (turn.status === 'error') {
    return {
      id: newMsgId('assistant'),
      role: 'assistant',
      createdAt: Date.now(),
      reason: 'failed',
      content: textContent(turn.error?.detail ?? i18n.t('mobile.labChat.genericError')),
      retry: retryText || undefined,
    };
  }
  const hasContent = turn.text.length > 0 || turn.cards.length > 0;
  if (!hasContent) return null;
  return {
    id: newMsgId('assistant'),
    role: 'assistant',
    createdAt: Date.now(),
    reason: 'complete',
    content: textContent(turn.text),
    cards: turn.cards.length ? turn.cards : undefined,
  };
}

/** Hide superseded "latest-wins" singleton cards (listing/WTB draft, entry
 *  options) across the committed history. A draft streams a card per update and
 *  re-emits every turn, so without this the thread stacks 5–6 near-identical
 *  cards. Rule: a singleton card renders only if it's the LAST of its type in the
 *  committed history AND the live turn doesn't currently carry that type (the
 *  live turn is always newer, so it supersedes all committed copies). Non-empty
 *  results reuse the original message reference so `ChatMessage`'s memo holds. */
export function collapseSupersededCards(messages: Message[], liveTypes: Set<string>): Message[] {
  const lastIdx = new Map<string, number>(); // type → last "mi*1e4+ci" seen
  messages.forEach((m, mi) =>
    m.cards?.forEach((c, ci) => {
      if (LATEST_WINS_CARD_TYPES.has(c.type)) lastIdx.set(c.type, mi * 1e4 + ci);
    }),
  );
  return messages.map((m, mi) => {
    if (!m.cards) return m;
    const cards = m.cards.filter((c, ci) => {
      if (!LATEST_WINS_CARD_TYPES.has(c.type)) return true;
      if (liveTypes.has(c.type)) return false; // superseded by the live turn
      return lastIdx.get(c.type) === mi * 1e4 + ci; // keep only the last committed
    });
    if (cards.length === m.cards.length) return m;
    return { ...m, cards: cards.length ? cards : undefined };
  });
}

/** The most-recent listing_draft card payload (live turn first, else the last
 *  committed one in history), or null when no draft exists yet. Same live-first-
 *  then-last-committed scan the old location strip used — now general-purpose so
 *  the gap filler can derive its full gap list from it. */
export function computeLatestDraft(liveCards: Turn['cards'], messages: Message[]): DraftPayload | null {
  const liveDraft = [...liveCards].reverse().find((c) => c.type === 'listing_draft');
  if (liveDraft) return (liveDraft.data as DraftPayload | undefined) ?? null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cards = messages[i].cards;
    if (!cards) continue;
    for (let j = cards.length - 1; j >= 0; j--) {
      if (cards[j].type === 'listing_draft') {
        return (cards[j].data as DraftPayload | undefined) ?? null;
      }
    }
  }
  return null;
}

/** Count the draft's gaps (missing_required ∪ low_confidence), dropping `country`
 *  when `location` is present (the location picker fills both) — mirrors the gap
 *  filler's own list. >0 → mount the filler. Defensive against a malformed
 *  payload (no draft/fields → 0 gaps → nothing to mount). */
export function draftGapCount(data: DraftPayload | null): number {
  if (!data) return 0;
  const seen = new Set<string>();
  for (const k of [...(data.missing_required || []), ...(data.low_confidence || [])]) {
    if (k) seen.add(k);
  }
  if (seen.has('location')) seen.delete('country');
  return seen.size;
}
