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
import { routes } from '@/lib/routes';

export function v2ResumeRoute(state: ScanResumeState): Href {
  const single = state.mode !== 'grouped' && state.current && state.current.photos.length > 0;
  return single ? routes.v2ReviewPhotos : getScanResumeRoute(state);
}
