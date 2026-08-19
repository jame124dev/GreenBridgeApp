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
 * guard moved too — see `__tests__/marketplaceDescriptionRender.test.tsx`, which
 * now RENDERS the sheet instead of grepping this file's source.
 *
 * Delete this file and its two mount sites in the review-screen restructure,
 * not here.
 */
export function MarketplaceCard() {
  return null;
}
