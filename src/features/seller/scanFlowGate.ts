// scanFlowGate — THE definition of "may this user reach the seller scan flow?".
//
// There are exactly TWO choke points in front of `/scan/*` authoring screens,
// and both call the predicate below rather than carrying their own copy:
//
//   1. `src/features/lab/scan/launchSellerScan.ts` — the five chat/home "upload
//      photos / documents" entry points.
//   2. `src/features/scanner/useResumeDraft.ts` (`resumeDraftById`) — resuming a
//      SAVED draft, which lands on `/scan/detail`, `/scan/grouped-review`,
//      `/scan/detection`, or — for a draft with no photos —`/scan/camera`.
//      Reached from three surfaces: the drafts list (`app/scan/drafts.tsx`), the
//      (lab) Home draft rail (`HomeRecentListings`) and the background-recognition
//      "View" toast (`surfaceDraftReady`), so guarding the shared core covers all
//      three the same way gating `launchSellerScan` covers its five.
//
// ⚠️ WHY THE FORK CHECK IS PART OF THE PREDICATE, NOT THE CALL SITE.
// `useResumeDraft` is shared with the SELLER fork (`EXPO_PUBLIC_USER_TYPE` unset
// → `app/(tabs)/*`). Seller-fork users never fetch `/seller-upgrade/my-status`
// (`SellerGatePrewarm` is mounted only in `app/(lab)/_layout.tsx`), so a
// status-only predicate would fail closed for every one of them and push them at
// `/(lab)/sell/apply` — a route that fork does not even mount. The seller build is
// not currently shipped (all three `eas.json` profiles set
// `EXPO_PUBLIC_USER_TYPE: "customer"`), which is exactly why this would have been
// invisible until someone flipped the flag.
//
// Fails CLOSED inside the customer fork: `undefined` (never fetched), `null`
// (never applied), `pending`, `rejected` and any unrecognised value all mean no.
import { router } from 'expo-router';

import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { IS_CUSTOMER } from '@/lib/flags';
import { queryClient } from '@/lib/queryClient';
import { routes } from '@/lib/routes';
import type { SellerUpgradeStatus } from '@/services/seller/sellerUpgrade';

/**
 * True when the user may enter the seller scan flow.
 *
 * Reads the query CACHE rather than `useCanSell()` because both choke points are
 * plain functions, not hooks. Keyed off the seller-upgrade STATUS, never off
 * "is my session pending": approval also arrives via the plain admin users queue,
 * which flips `pw_user_status` but creates no upgrade row.
 */
export function canEnterScanFlow(): boolean {
  // Seller fork: listing IS the product, and there is no upgrade row to read.
  if (!IS_CUSTOMER) return true;
  const status = queryClient.getQueryData<SellerUpgradeStatus | null>(SELLER_UPGRADE_KEY);
  return status?.status === 'approved';
}

/**
 * Send a blocked user to the seller application instead of the scan flow.
 *
 * Marks the status stale on the way so the application screen renders the
 * SERVER's answer — that is what makes the gate self-correcting for a cold cache
 * or an approval granted a minute ago. Inactive queries are not refetched by an
 * invalidate, so this costs no request until the screen mounts and observes.
 */
export function redirectToSellerApplication(): void {
  void queryClient.invalidateQueries({ queryKey: SELLER_UPGRADE_KEY });
  // push (not replace): back returns to whatever they tapped.
  router.push(routes.labSellApply);
}
