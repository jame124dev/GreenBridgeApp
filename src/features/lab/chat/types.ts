// Message-id minting for the (lab) chat thread. The message MODEL now lives in
// `types/message.ts` (A2 §12 `Message`); the legacy `AiMsg` + `ChatRole`
// (`user|bot|err`) were removed in PR-11 once the `Message` migration (PR-6) left
// them with no consumers. This module keeps only the id generator, consumed by
// the commit path (`turnFold`) and batch appends (`useBatchProducts`).

let counter = 0;
/** Monotonic per-session message id (stable across re-renders). Prefix is a free
 *  string (the A2 `Message` role is `user|assistant`). */
export function newMsgId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
