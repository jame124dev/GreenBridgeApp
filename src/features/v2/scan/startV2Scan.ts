/**
 * Start a scan FROM INSIDE v2, landing on v2's own camera.
 *
 * ⚠️ DO NOT call `launchSellerScan()` from a v2 screen. It ends in
 * `router.push(routes.scanCamera)` — the OLD `/scan/camera` — so it walks a v2
 * user straight out of v2 and leaves the six v2 scan screens unreachable. That
 * was found on 2026-09-17 by pressing "Scan it" on Home and landing in the old
 * flow, and `SellingPane`'s `onScan` docblock records it at length.
 *
 * `launchSellerScan` itself is deliberately unchanged: five callers in the
 * SHIPPED UI (lab home ×2, lab chat ×2, the chat controller) must keep landing
 * in the old flow, because the old flow is what they belong to.
 *
 * The two things it does are kept here:
 *
 *  1. `requireAuth('sell', …)` — listing IS account-based, so this is one of
 *     the few actions a guest may be stopped on (Guideline 5.1.1(v)), and it
 *     asks at the point of use rather than at the door.
 *  2. FLUSH-ALWAYS — reset any half-finished scan draft so the flow starts
 *     clean. Skipping it resumes an abandoned draft into a fresh scan.
 *
 * `push`, not `replace`, so Back returns to wherever the scan was started.
 *
 * TODO: `SellingPane.onScan` still inlines this. Point it here when that file
 * is next touched — it was being edited concurrently when this was extracted.
 */
import { router } from 'expo-router';

import { requireAuth } from '@/features/auth/requireAuth';
import { useScanDraft } from '@/stores/scanDraftStore';
import { routes } from '@/lib/routes';

export function startV2Scan(): void {
  requireAuth('sell', () => {
    useScanDraft.getState().reset();
    router.push(routes.v2Camera);
  });
}
