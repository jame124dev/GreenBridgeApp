// Chat domain type — A4 §11. The stable action surface components trigger via
// context (the only way presentational components cause effects, A4 §1.2/§5).
// Scoped to the chat feature.
//
// UNUSED by production until PR-4.
export interface ChatActions {
  /** Open a turn (A2 START). */
  send(text: string): void;
  /** Stop the in-flight turn (A3 §10.7 → A2 CANCEL). */
  cancel(): void;
  /** Re-send from a failed/interrupted message (new turn, same conversation). */
  retry(messageId: string): void;
  /** Feedback signal → X5 sink. */
  submitFeedback(messageId: string, v: 'up' | 'down'): void;
}
