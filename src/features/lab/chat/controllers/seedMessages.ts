/**
 * Build the chat thread's seed message — the user's own bubble for the turn that
 * was started on the HOME screen before navigating here.
 *
 * ⚠️ THE BUG THIS FIXES (device-reproduced 2026-08-13).
 * Home starts the turn itself and navigates with `?q=<text>`. The seed used to be
 *
 *     initialQuery ? [userMessage(initialQuery)] : []
 *
 * which is keyed on TEXT ONLY. Sending an image with no caption from Home — the
 * documented buyer image-search gesture — produces an EMPTY `q`, so no user
 * message was seeded at all: the thread opened completely blank, with neither the
 * image nor a bubble, and only a spinner at the bottom.
 *
 * It could not be recovered on the chat side either: `useLabTurn.start()` clears
 * the staged attachments as it consumes them, and `conversationStore.seed()`
 * OVERWRITES, so appending from Home before navigating would be wiped by the
 * mount-time seed. Hence `lastSentAttachments`: the turn records what it sent, and
 * the seed reads it.
 *
 * The in-chat composer path was never affected — it appends its own user message
 * with `attachments` (see `useChatController.onSend`), which is why the same photo
 * appears when sent from inside the chat and vanishes when sent from Home.
 */
// `newMsgId` lives in the legacy `chat/types`, not the new `chat/types/message`
// domain module — same split the rest of the controllers import across.
import { newMsgId } from '@/features/lab/chat/types';
import { textContent } from '@/features/lab/chat/types/message';
import type { Attachment, Message } from '@/features/lab/chat/types/message';

/**
 * @param initialQuery the `?q=` text Home navigated with (may be empty)
 * @param sentAttachments what `useLabTurn.start()` consumed for this turn
 * @param now injectable clock so the test does not depend on Date.now()
 */
export function buildSeedMessages(
  initialQuery: string,
  sentAttachments: readonly Attachment[] = [],
  now: number = Date.now(),
): Message[] {
  const text = initialQuery ?? '';
  // Nothing was sent from Home — a cold open of the chat tab. Seed nothing.
  if (!text && sentAttachments.length === 0) return [];
  return [
    {
      id: newMsgId('user'),
      role: 'user',
      createdAt: now,
      content: textContent(text),
      // Omit rather than send [] so the renderer's `msg.attachments ?? []` and
      // the existing in-chat path agree on the shape.
      attachments: sentAttachments.length ? [...sentAttachments] : undefined,
    },
  ];
}
