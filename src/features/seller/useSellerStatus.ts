/**
 * The three facts a seller needs told, and currently is not told at all.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Signing the same account into the WEB on 2026-10-06 showed it being handed
 * three things the app never says:
 *
 *   · "Seller account pending approval — creating new listings, orders,
 *     payouts and messaging unlock once an admin approves your account, this
 *     usually takes up to 24 hours."
 *   · "Verify your email — we sent a verification link to <address>", with a
 *     Resend button.
 *   · padlocks on the sections that are actually locked.
 *
 * The app showed the same account nothing. It looks exactly as it would for an
 * approved seller, and the block is discovered only at the moment of
 * publishing — after photographing equipment and waiting on the AI. That is
 * the gap this hook feeds.
 *
 * ⚠️ IT REPORTS, IT DOES NOT GATE. Publishing is gated by `canSubmitListing()`
 * and nothing else; a second predicate that could disagree with it is how a
 * padlock starts lying about where you can go. The web learned this the hard
 * way and now keeps one source of truth (`restrictedRoutes.ts`: "Two things
 * consume this and they MUST agree"). Everything here is for DISPLAY.
 */
import { useQuery } from '@tanstack/react-query';

import { fetchOnboardingDetails } from '@/services/onboarding/sellerOnboarding';
import { fetchVerifiedUser } from '@/services/auth/verifyUser';
import { useAuth } from '@/stores/authStore';

/** The one cache key for the seller's onboarding row. */
export const ONBOARDING_DETAILS_KEY = ['onboarding', 'details'] as const;
/** The one cache key for the server's view of the signed-in account. */
export const VERIFIED_USER_KEY = ['auth', 'verify-user'] as const;

export type SellerStatus = {
  /** Signed in at all. Everything below is meaningless without it. */
  signedIn: boolean;
  /** Awaiting admin approval — `pw_user_status` is not yet `approved`. */
  awaitingApproval: boolean;
  /**
   * Their email is confirmed.
   *
   * Defaults to TRUE when unknown, which is the deliberate direction: this
   * only decides whether to NAG. Nagging a verified seller to verify is worse
   * than staying quiet, and nothing is gated on it.
   */
  emailVerified: boolean;
  /** They have an account but never finished the seller questions. */
  onboardingIncomplete: boolean;
  /** Still fetching — render nothing rather than flashing a wrong state. */
  loading: boolean;
};

export function useSellerStatus(): SellerStatus {
  const profile = useAuth((s) => s.profile);
  const isPending = useAuth((s) => s.isPending);
  const approval = useAuth((s) => s.approval);
  const signedIn = !!profile;

  /*
   * Only asked for once there is someone to ask about. `enabled` keeps this
   * off entirely for guests — who are the majority of app opens and must not
   * pay a request to be told they have no seller profile.
   */
  const { data, isLoading } = useQuery({
    queryKey: ONBOARDING_DETAILS_KEY,
    queryFn: () => fetchOnboardingDetails(profile!.id),
    enabled: signedIn,
    staleTime: 60_000,
    retry: 1,
  });

  /**
   * The server's own view of the account.
   *
   * ⚠️ NOT `approval.email_verified` — loginV3's ACCOUNT_PENDING body does not
   * carry an `approval` object at all (checked against dev 2026-10-06), so
   * that path always resolved to the "verified" default and the confirm-email
   * card could never appear for anyone. See `services/auth/verifyUser.ts`.
   */
  const { data: verified } = useQuery({
    queryKey: VERIFIED_USER_KEY,
    queryFn: fetchVerifiedUser,
    enabled: signedIn,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    signedIn,
    /*
     * The session flag OR the server's word. `isPending` is set at sign-in and
     * never refreshed, so on its own it goes stale the moment an admin acts;
     * `accountStatus` is live but needs a request. Either saying "pending" is
     * enough to show the card — the cost of a stale card is a wrong sentence,
     * and the cost of missing it is someone discovering the block by hitting
     * it. Neither of these decides whether publishing is allowed.
     */
    awaitingApproval:
      signedIn && (isPending || verified?.accountStatus === 'pending'),
    /*
     * Only a definite `false` from the server nags. `null` (not asked, or the
     * field was absent) and the legacy `approval` object both fall back to
     * "verified", because telling a verified seller to verify is worse than
     * silence and nothing is gated on it.
     */
    emailVerified:
      verified?.emailVerified ?? approval?.email_verified ?? true,
    /*
     * Unknown is NOT incomplete. A failed request must not accuse someone of
     * an unfinished profile they may well have finished — the nudge would send
     * them into a wizard that immediately resumes to the end.
     */
    onboardingIncomplete: signedIn && data ? !data.onboardingCompleted : false,
    loading: signedIn && isLoading,
  };
}
