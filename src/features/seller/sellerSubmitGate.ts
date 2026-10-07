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
import type { OnboardingDetails } from '@/services/onboarding/sellerOnboarding';
import { ONBOARDING_DETAILS_KEY } from '@/features/seller/useSellerStatus';
import { useAuth } from '@/stores/authStore';

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
  if (status?.status !== 'approved') return false;

  /*
   * A DERIVED approval is not a decision — re-check the account itself.
   *
   * `source === 'existing_seller'` means no human approved anything: the server
   * synthesised `approved` purely because `greenbidz_user_type` meta says
   * "seller" (origin/dev `services/sellerUpgradeService.js:391-412`). That was
   * safe while the only way to hold that meta was to be a seller from the old
   * platform. The v2 onboarding broke the assumption — `signup-with-link-v2`
   * writes `greenbidz_user_type = role` alongside `pw_user_status = 'pending'`
   * in one insert (origin/dev `controller/authV3.controller.js:1157-1158`) — so
   * a brand-new, unreviewed seller arrives here already derived-`approved` and
   * could publish straight past admin review. The web never had this hole
   * because its gate reads `pw_user_status` directly.
   *
   * So: an explicit reviewed row still wins on its own (an admin said yes, and
   * that approval does not necessarily flip `pw_user_status` — making this
   * unconditional would lock out every properly approved upgrade). A derived
   * one additionally requires the account not to be awaiting approval.
   *
   * Fails CLOSED, like the rest of this predicate: `isPending` defaults to true
   * only where the session says so, and an unknown session is not pending, so
   * the stricter half applies exactly to the accounts the v2 flow creates —
   * `establishSessionAfterSignup` sets pending at the moment the account is made.
   */
  if (status.source === 'existing_seller' && useAuth.getState().isPending) return false;

  /*
   * An APPROVED seller who never finished the wizard must not publish an empty
   * profile — no company, no tax id, no address. The web prevents this with
   * `SellerOnboardingGuard`, which sends them back to `/auth2?resume=1` before
   * the dashboard; mobile had no equivalent.
   *
   * ⚠️ KEYED ON `sellerType`, NOT ON `onboardingCompleted` ALONE — and that is
   * the whole point of this block.
   *
   * `GET /user/onboarding-details` returns a FULL DEFAULT OBJECT when the row
   * does not exist: `{sellerType: null, …, onboardingCompleted: false}`
   * (origin/dev `controller/authV3.controller.js:1520`). So every seller who
   * predates the v2 wizard — i.e. every existing approved seller on the
   * platform — is indistinguishable from someone who abandoned it, if you read
   * the flag by itself. Gating on `!onboardingCompleted` would have blocked
   * all of them from publishing. `sellerType` is non-null only once the wizard
   * actually recorded an answer, so it is the one field that says "this
   * account entered the v2 flow" rather than "this account has no row".
   *
   * ⚠️ AND THIS HALF FAILS **OPEN**, against the rest of this predicate.
   * Everything above fails closed because an unknown approval must not open
   * the gate. Here the unknown is inverted: a cold or failed cache means we do
   * not know whether a row exists, and refusing on that would again block the
   * legacy population — the larger group, and the one with nothing to fix.
   * `SellerGatePrewarm` warms this on (lab) entry so "unknown" is rare.
   */
  const ob = queryClient.getQueryData<OnboardingDetails>(ONBOARDING_DETAILS_KEY);
  if (ob && ob.sellerType !== null && !ob.onboardingCompleted) return false;

  return true;
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

  /*
   * TWO REASONS TO BE HERE, TWO DOORS.
   *
   * The application screen answers "you are not an approved seller". It does
   * not answer "your seller profile is half-filled" — that person already
   * applied, and sending them to a form about applying is a dead end wearing
   * the wrong label. When the onboarding row says the wizard was started and
   * not finished, the fix is the wizard, which now reopens at the first
   * unanswered step (`features/v2/onboarding/resume.ts`).
   *
   * Same cache read as the gate, so the two cannot disagree about why.
   */
  const ob = queryClient.getQueryData<OnboardingDetails>(ONBOARDING_DETAILS_KEY);
  const unfinishedOnboarding = !!ob && ob.sellerType !== null && !ob.onboardingCompleted;

  // push (not replace): back returns to the review screen with the draft intact.
  router.push(unfinishedOnboarding ? '/(auth)/onboarding-mock' : routes.labSellApply);
}
