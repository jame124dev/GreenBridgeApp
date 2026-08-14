// sellerSubmitGate — THE definition of "may this user PUBLISH a listing?".
//
// ⚠️ POLICY (changed deliberately): approval is required to SUBMIT a listing for
// review, NOT to author one. Anyone signed in may photograph equipment, run the
// AI, edit the draft and save it. The one-time seller-details step appears at the
// moment they ask us to publish — the point where it is obviously relevant and
// where they have already seen what the product does for them.
//
// Previously this gate sat at the ENTRY to the scan flow (`launchSellerScan` and
// `resumeDraftById`), which meant a user tapping "photograph equipment" was sent
// to a company-details form before seeing a single thing work.
//
// There are exactly TWO ways a listing reaches the backend, and both call the
// predicate below rather than carrying their own copy:
//
//   1. `app/scan/grouped-review.tsx` → `useSubmitGroupedListing`
//      → POST /wp/create-grouped-listings   (one or many products)
//   2. `src/features/scanner/components/detail/useDetailController.ts`
//      (`onSubmitSingle`) → `useCreateListing`
//      → POST /wp/create-product-direct + create batch   (single product)
//
// Miss either and the gate is decorative: the two paths hit DIFFERENT endpoints,
// and neither endpoint enforces seller approval server-side.
//
// ⚠️ WHY THE FORK CHECK IS PART OF THE PREDICATE, NOT THE CALL SITE.
// Both submit paths are shared with the SELLER fork (`EXPO_PUBLIC_USER_TYPE`
// unset → `app/(tabs)/*`). Seller-fork users never fetch
// `/seller-upgrade/my-status` (`SellerGatePrewarm` is mounted only in
// `app/(lab)/_layout.tsx`), so a status-only predicate would fail closed for
// every one of them and push them at `/(lab)/sell/apply` — a route that fork does
// not even mount. The seller build is not currently shipped (all three
// `eas.json` profiles set `EXPO_PUBLIC_USER_TYPE: "customer"`), which is exactly
// why this would have been invisible until someone flipped the flag.
//
// Fails CLOSED inside the customer fork: `undefined` (never fetched), `null`
// (no application AND not an existing seller), `pending`, `rejected` and any
// unrecognised value all mean no.
import { router } from 'expo-router';

import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { IS_CUSTOMER } from '@/lib/flags';
import { queryClient } from '@/lib/queryClient';
import { routes } from '@/lib/routes';
import type { SellerUpgradeStatus } from '@/services/seller/sellerUpgrade';

/**
 * True when the user may submit a listing for review.
 *
 * Reads the query CACHE rather than `useCanSell()` because the choke points are
 * plain callbacks, not hooks. Keyed off the seller-upgrade STATUS, never off "is
 * my session pending": approval also arrives via the plain admin users queue and
 * via company assignment, neither of which creates an upgrade row — the backend's
 * `getUserUpgradeStatus` answers `approved` for those accounts from
 * `greenbidz_user_type` meta, which is what makes an existing seller pass here.
 */
export function canSubmitListing(): boolean {
  // Seller fork: listing IS the product, and there is no upgrade row to read.
  if (!IS_CUSTOMER) return true;
  const status = queryClient.getQueryData<SellerUpgradeStatus | null>(SELLER_UPGRADE_KEY);
  return status?.status === 'approved';
}

/**
 * Send a blocked user to the seller application instead of publishing.
 *
 * Their work is NOT lost: the scan draft lives in `useScanDraft`, which is a
 * plain in-memory store, so it is still there when they come back — and
 * `/(lab)/sell/apply` renders all four states (no application → form, pending →
 * "with our team", rejected → the reason above a prefilled form, approved →
 * straight back in).
 *
 * Marks the status stale on the way so that screen renders the SERVER's answer —
 * that is what makes the gate self-correcting for a cold cache or an approval
 * granted a minute ago. Inactive queries are not refetched by an invalidate, so
 * this costs no request until the screen mounts and observes.
 */
export function redirectToSellerApplication(): void {
  void queryClient.invalidateQueries({ queryKey: SELLER_UPGRADE_KEY });
  // push (not replace): back returns to the review screen with the draft intact.
  router.push(routes.labSellApply);
}
