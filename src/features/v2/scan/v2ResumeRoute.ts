/**
 * Where a SINGLE-ITEM draft opens in v2 — the companion to
 * `openMultiItemDraft`, and the second half of the same rule: a draft opened
 * from v2 stays in v2.
 *
 * ── WHY IT IS ITS OWN MODULE ───────────────────────────────────────────────
 *
 * This function existed twice, byte-identical, in `SellingPane.tsx:146` and
 * `app/v2/drafts.tsx:81`, each carrying a comment saying the other one must
 * match. That is a promise, not a mechanism. `openMultiItemDraft` was already
 * extracted for exactly this reason on the multi-item side; this is the same
 * treatment for the single-item side, so the two v2 surfaces that list drafts
 * cannot drift.
 *
 * ── SINGLE-PRODUCT ONLY, AND THAT IS NOT A STUB ────────────────────────────
 *
 * v2's review flow reads ONE item through `useReviewItem()`; there is no v2
 * grouped-review screen, so a grouped draft routed there would land on a screen
 * that cannot show it. Grouped drafts keep the shipped path, which handles them
 * today. Anything without photos also falls through to the shipped resolver —
 * the answer there is the camera.
 */
import type { Href } from 'expo-router';

import { getScanResumeRoute, type ScanResumeState } from '@/lib/scanResume';

/**
 * ⚠️ `if`/`return`, not a ternary — deliberately.
 *
 * `single ? routes.v2ReviewPhotos : getScanResumeRoute(state)` makes TypeScript
 * resolve expo-router's generated route union across BOTH branches at once, and
 * that union passed the limit when `app/v2/scan/item.tsx` was added
 * (`typedRoutes: true`, `app.config.ts:266`): `TS2590: Expression produces a
 * union type that is too complex to represent`. Returning each branch
 * separately types each against `Href` on its own and never builds the
 * combined union. Same reason `scanResume.ts` has `pickFreshScanRoute()`.
 */
export function v2ResumeRoute(state: ScanResumeState): Href {
  /*
    ── THE SINGLE-ITEM OVERRIDE WAS REMOVED (2026-09-25) ─────────────────────

    This used to be:

        const single = state.mode !== 'grouped'
          && state.current && state.current.photos.length > 0;
        if (single) return routes.v2ReviewPhotos;

    …on the rule stated at the top of this file: "a draft opened from v2 stays
    in v2". That rule was already only half true, and the half that failed is
    the visible one — v2 has no grouped-review screen, so MULTI-ITEM drafts
    have always fallen through to `/scan/grouped-review`. The result was two
    editors for the same draft list: resume a one-item draft and you landed in
    `app/v2/scan/review/*`; resume a ten-item draft and you landed in
    `app/scan/*`. Same screen, same tap, different product.

    `app/scan/*` is the flow that is live — it is where detection, the review
    hub (with its Export to Excel) and the item editor are, and it is what the
    seller sees after a scan. So resuming now follows the same path as scanning:

      single item → `/scan/detail`          (via `resumeRouteForItem`)
      multi item  → `/scan/grouped-review`
      no photos   → the camera

    All three come from `getScanResumeRoute`, which already encoded exactly
    this. Nothing here needs to decide any more.

    ⚠️ This function is KEPT rather than inlined. Three surfaces call it —
    `app/v2/drafts.tsx`, `SellingPane.tsx` and `surfaceDraftReady.tsx` — and it
    exists because the logic was once duplicated byte-for-byte across two of
    them with a comment asking the other to keep in step. If v2 ever grows its
    own grouped-review screen and the "stays in v2" rule becomes true, this is
    the one place to restore the fork.
  */
  return getScanResumeRoute(state);
}
