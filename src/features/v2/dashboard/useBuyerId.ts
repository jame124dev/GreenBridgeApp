/**
 * Who the dashboard is asking about.
 *
 * Every buyer-dashboard endpoint takes the buyer in the PATH
 * (`/buyer/bid/buyer/{id}`, `/wishlist/{id}`, `/inspection/buyer/{id}`), so all
 * three pages need the same answer and must not each invent one. It lives here
 * rather than in `bids/` because it belongs to the section, not to a screen.
 *
 * ⚠️ THOSE ROUTES DO NOT CHECK WHO IS ASKING. They are the unauthenticated
 * identity-parameter class in `Docs/v2/SECURITY-WISHLIST.md` — any id in the
 * path returns that person's bids, saved lots and site visits, with no token.
 * That is exactly why the dev fallback below is `__DEV__`-only: in a release
 * build an unauthenticated user must query NOTHING, not a stranger's data.
 * Loosening this is a security change, not a convenience.
 */
import { useAuth } from '@/stores/authStore';

/**
 * The dev buyer used when nobody is signed in.
 *
 * `574` is the test seller/buyer the security probe in
 * `Docs/v2/SECURITY-WISHLIST.md` used, and on the dev backend it has 11 bids
 * and 6 saved lots — enough to exercise every branch. It has **zero
 * inspections**, so that screen still needs a different id before its real-data
 * pass means anything.
 */
export const DEV_BUYER_ID = 574;

/** The signed-in buyer, or the dev stand-in — never a stand-in in production. */
export function useBuyerId(): number | undefined {
  const profile = useAuth((s) => s.profile);
  if (profile?.id) return profile.id;
  return __DEV__ ? DEV_BUYER_ID : undefined;
}
