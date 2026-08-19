/**
 * MULTI-MARKETPLACE UNLOCK (M-3/M-4).
 *
 * This card is intentionally EMPTY. Before the unlock it hid a four-pill
 * marketplace picker behind `MARKETPLACE_LOCKED = true`; that picker now lives
 * in `MarketplaceSheet`, opened from `RoutingChip` at the top of the review
 * screen — the marketplace is a routing DECISION to confirm, not the tenth form
 * field on a ~3,200 px scroll (plan §6.1).
 *
 * The component is kept (rather than deleted) because it is mounted from two
 * screens — app/scan/detail.tsx and app/scan/grouped-edit.tsx — and rendering a
 * picker in either would be the DUPLICATE CONTROL that UX_DESIGN_RULES.md
 * ("Remove duplication") forbids: two controls writing `marketplace` also
 * re-opens the hydration race documented in useDetailController.
 *
 * The `description` render that used to live here moved with the picker. Its
 * guard moved too — see `__tests__/MarketplaceSheet.test.tsx`, which RENDERS the
 * sheet and asserts every option's description, plus
 * `../../__tests__/marketplaceOptions.test.ts`, which pins
 * `MARKETPLACE_OPTIONS[].description` as the ONE home for that copy and asserts
 * this file renders nothing. (An earlier docblock named
 * `__tests__/marketplaceDescriptionRender.test.tsx`; no such file was ever
 * written — the guard landed under the two names above.)
 *
 * Delete this file and its two mount sites in the review-screen restructure,
 * not here.
 */
export function MarketplaceCard() {
  return null;
}
