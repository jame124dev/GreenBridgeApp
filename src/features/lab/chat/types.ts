// Chat message model for the (lab) customer-app AI thread
// (NewVersion/dynamic/05-mobile-ux.md §2.1). Mirrors the web engine's `Msg`
// shape (aiChatShared `Msg`) but native. The chat screen owns an `AiMsg[]`; the
// live streaming bot bubble reads `threadStore.turn` and is committed into this
// array on the terminal `done`/`error` frame.
import type { TurnCard } from '@/features/lab/stores/threadStore';

export type ChatRole = 'user' | 'bot' | 'err';

/** One thread message. Cards are carried in arrival order (dispatched by
 *  `data.type`). `streaming` is true only for the in-flight bot bubble. */
export type AiMsg = {
  /** Stable key for the list — never the array index (streaming cell mutates). */
  id: string;
  role: ChatRole;
  /** Grows during the token stream; final on `done`. */
  text: string;
  /** True until the terminal frame; drives the typing indicator + caret. */
  streaming?: boolean;
  /** `event: data` cards in arrival order (dispatched by `data.type`). */
  cards?: TurnCard[];
  /** `used_tools` from the `done` frame → the "Sources" strip. */
  tools?: string[];
  /** Original user text to re-send on Retry (set on an `err` message). */
  retry?: string;
  /** Latest error detail (set on an `err` message). */
  errorDetail?: string;
  /** Attachments the user sent with this turn (shown in the right-side bubble
   *  as image thumbnails / doc chips). Local picker URIs — display only. */
  attachments?: { uri: string; isImage: boolean; name: string }[];
};

let counter = 0;
/** Monotonic per-session message id (stable across re-renders). */
export function newMsgId(prefix: ChatRole): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
