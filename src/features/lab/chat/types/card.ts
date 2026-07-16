// Chat domain type — A2 §12 / A4 §10.4. A committed or streamed response card.
//
// Same shape as the legacy `TurnCard` (`stores/threadStore.ts`); the two are
// reconciled in PR-6/PR-7 so the type layer no longer depends on the store
// (today `chat/types.ts` imports `TurnCard` FROM the store — an inversion this
// module exists to fix). Scoped to the chat feature; imported explicitly.
//
// UNUSED by production until PR-6.

/** `type` selects the renderer (A4 CardRegistry); `data` is the opaque payload.
 *  `LabCardType` is an open union (A3 §10.4) so `string` keeps unknown/forward
 *  cards renderable-or-ignorable rather than a closed set. */
export interface Card {
  type: string;
  data: unknown;
}
