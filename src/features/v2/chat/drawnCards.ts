/**
 * Which assistant card types v2 can actually draw — and the filter that keeps
 * the sanitizer honest about it.
 *
 * ── WHY THIS IS ITS OWN FILE ──
 *
 * `streamSanitizer` deletes a reply's field dump whenever a card is present, on
 * the contract that the card shows the same facts. It recognises 13 types
 * (`DRAFT_CARD_TYPES` + `INFO_CARD_TYPES`). v2 draws three. For the other ten
 * the prose was being deleted for a card that then rendered nothing, and the
 * answer collapsed to its lead-in: a seller was told a draft listing existed
 * and shown neither the draft nor the fields. `listing_draft` sits in that gap
 * and is the most important card in the product.
 *
 * The seam is between two components that were each individually correct, so it
 * belongs in a module that can be tested against the REAL sanitizer without
 * rendering anything. It lives outside `ChatCards.tsx` because importing that
 * pulls in the v2 UI barrel, which reaches
 * `react-native-keyboard-controller` — a native module Jest cannot link.
 *
 * Same reason `threadScroll.ts` and `wantBudget.ts` are separate: the rule is
 * worth pinning, and the renderer is not what needs testing.
 */

/**
 * The types with a `case` in `ChatCards.ChatCard`.
 *
 * ⚠️ Keep in step with that switch. Adding a renderer without adding its type
 * here is the harmless direction — the prose merely stays, alongside the card.
 * Adding a type here without a renderer is the bug above.
 */
export const V2_DRAWN_CARD_TYPES: ReadonlySet<string> = new Set([
  'product_list',
  'product',
  'wtb_draft',
]);

/**
 * Keep only the cards v2 draws, for passing to `resolveBotText` /
 * `streamSafeText`. An undrawn type then keeps its full prose, which is the
 * honest fallback: the facts reach the reader as text instead of vanishing
 * between two components that each assumed the other was showing them.
 *
 * Returns `undefined` rather than `[]` when nothing survives. The sanitizer
 * tests `cards?.some(...)`, so the two behave alike there, but `undefined`
 * reads as "no card to honour" at the call site.
 */
export function drawnCards<T extends { type: string }>(cards?: T[]): T[] | undefined {
  const kept = cards?.filter((c) => V2_DRAWN_CARD_TYPES.has(c.type));
  return kept && kept.length > 0 ? kept : undefined;
}
