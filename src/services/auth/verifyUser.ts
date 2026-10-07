/**
 * `GET /user/verify-user` — the server's own answer about the signed-in account.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The app had no way to know whether someone's email was verified. The auth
 * store's `approval` object is only populated from loginV3's ACCOUNT_PENDING
 * body, and that body does NOT carry one — confirmed against dev 2026-10-06,
 * where a pending login returns exactly:
 *
 *   { success, code: 'ACCOUNT_PENDING', message, userId, role, name, company }
 *
 * `login.ts` already treats it as optional (`if (body.approval)`), so nothing
 * was broken — but `emailVerified` defaulted to "verified" forever, and the
 * "confirm your email" card could never appear for anyone. It was built
 * correct and unreachable.
 *
 * This endpoint has the fact, alongside the authoritative account status:
 *   `{ user: { accountStatus: 'pending', emailVerified: false, … } }`
 *
 * ⚠️ FOR DISPLAY, NOT FOR THE PUBLISH GATE. `canSubmitListing()` reads the
 * seller-upgrade status and the session's pending flag, and must keep doing
 * so. Adding a third opinion about "may this person publish?" is how a padlock
 * starts disagreeing with the thing it is drawn next to — the web keeps one
 * source of truth for exactly this reason.
 */
import { greenbidz } from '@/api/greenbidzClient';

export type VerifiedUser = {
  /** `'pending' | 'profile_incomplete' | 'approved'` — the server's word. */
  accountStatus: string | null;
  emailVerified: boolean | null;
};

/**
 * `null` for every field we were not actually told, rather than a guess.
 * The caller decides what an unknown means; here it must not be invented,
 * because "we do not know" and "verified" lead to different screens.
 */
export async function fetchVerifiedUser(): Promise<VerifiedUser> {
  const res = await greenbidz.get<{ success?: boolean; user?: Record<string, unknown> }>(
    '/user/verify-user',
  );
  const u = res.data?.user;
  if (!res.data?.success || !u) throw new Error('Could not read the account');
  return {
    accountStatus: typeof u.accountStatus === 'string' ? u.accountStatus : null,
    emailVerified: typeof u.emailVerified === 'boolean' ? u.emailVerified : null,
  };
}
