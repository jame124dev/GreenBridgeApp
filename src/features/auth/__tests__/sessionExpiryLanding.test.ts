/**
 * A DEAD SESSION MUST NOT REBUILD THE SIGN-IN WALL.
 *
 * Found on device 2026-09-22, and only because two phones were attached to the
 * same Metro at the same moment:
 *
 *   • Realme (no stored profile) → cold boot lands on **v2 Home**, as a guest.
 *   • Samsung (stored profile, refresh token expired) → cold boot lands on the
 *     full-screen **sign-in form**.
 *
 * Same bundle, same second, so the difference is device state, and the only
 * code paths that reach `/(auth)/login` at boot both require a profile:
 * `app/_layout.tsx`'s boot guard (`isSessionExpired()`) and its 401 handler.
 * Both do `reset()` and then `router.replace('/(auth)/login')`.
 *
 * ── WHY THAT IS A BUG AND NOT A POLICY ─────────────────────────────────────
 *
 * `reset()` clears the profile. The person is, from that instant, **a guest** —
 * and this same file states the rule twice, fifteen lines apart:
 *
 *   "⛔ NO GUEST REDIRECT. This used to bounce every session-less user to
 *    /(auth)/login, so a fresh install landed on a sign-in wall and could not
 *    browse a single product. App Review rejected 1.0.3 (21) for it on
 *    2026-08-24 -- Guideline 5.1.1(v)"
 *
 *   "⛔ A 401 FOR A GUEST IS NOT A SESSION EXPIRY … the 5.1.1(v) wall rebuilt
 *    one layer down."
 *
 * The wall was removed for someone who had never signed in, and left standing
 * for everyone who had — which is the larger group, because every account
 * reaches it eventually simply by not opening the app until the refresh token
 * dies.
 *
 * And it is a genuine dead end, not merely a detour: `app/(auth)/login.tsx` has
 * no "continue as guest" affordance (checked), `app/(auth)/_layout.tsx` is a
 * bare `Stack` with `headerShown: false`, and it is reached by `replace`, so
 * there is no back entry either.
 *
 * ── WHAT REPLACES IT ───────────────────────────────────────────────────────
 *
 * Land on `homeRoute()` — where a guest belongs — and SAY the session ended, so
 * being signed out is explained rather than silent. Signing in is then offered
 * at the point of use by `requireAuth()`, which is the pattern the rest of the
 * app already uses.
 *
 * Source assertions rather than a render test: the failure is a route constant
 * inside an effect callback, which renders perfectly and is invisible to a
 * snapshot — the same reasoning as `published.test.ts`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/** Comments stripped — this file discusses `/(auth)/login` at length in prose. */
function codeOf(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
    .join('\n');
}

const ROOT_LAYOUT = 'app/_layout.tsx';
const LOGIN = 'app/(auth)/login.tsx';

describe('an expired session lands a guest in the app, not on a wall', () => {
  /**
   * The premise, pinned. If someone ever adds a "continue as guest" escape to
   * the login screen, the wall stops being a dead end and this whole test
   * should be reconsidered rather than silently kept.
   */
  it('the login screen still offers no way to browse without an account', () => {
    const code = codeOf(LOGIN);

    expect(code).not.toMatch(/continue as (a )?guest/i);
    expect(code).not.toMatch(/keep browsing/i);
  });

  it('does not send a reset session to the sign-in screen', () => {
    const code = codeOf(ROOT_LAYOUT);

    expect(code).not.toMatch(/router\.replace\(\s*['"]\/\(auth\)\/login['"]\s*\)/);
  });

  it('sends it to whatever home means for this build', () => {
    const code = codeOf(ROOT_LAYOUT);

    /**
     * COUNTED, not merely present. One `router.replace(homeRoute())` was
     * already here — the post-auth bounce out of `(auth)` — so a bare
     * `toMatch` passes today and proves nothing about the two session-death
     * paths this test exists for.
     *
     * TWO, not three: the boot guard and the 401 handler share a single
     * `endSession`. That extraction is the point — the bug existed precisely
     * because the same three lines were written twice and only one copy was
     * ever reasoned about. Asserting three call sites would pin the duplication
     * that caused it, so the next assertion checks the SHARING instead.
     *
     * `homeRoute()` and never a hardcoded path: it is the single flag-keyed
     * answer for the front door, and hardcoding is what put the launch
     * redirect a version behind the rest of the app once already.
     */
    const landings = code.match(/router\.replace\(\s*homeRoute\(\)\s*\)/g) ?? [];

    expect(landings).toHaveLength(2);
    expect(code).not.toMatch(/router\.replace\(\s*['"]\/\(lab\)/);
  });

  /**
   * Both death paths go through the one function. The original defect was two
   * hand-written copies of `reset(); router.replace('/(auth)/login')`, of which
   * the guest arm got fixed and this one did not.
   */
  it('routes both session-death paths through one place', () => {
    const code = codeOf(ROOT_LAYOUT);

    const calls = code.match(/endSession\(reset, router\)/g) ?? [];

    expect(calls).toHaveLength(2);
  });

  /**
   * ⚠️ AND IT MUST CLEAR THE CREDENTIALS ON DISK, NOT JUST IN MEMORY.
   *
   * `useAuth.reset()` removes only `auth.approval` and the in-memory state
   * (`src/stores/authStore.ts:62-65`). `auth.profile`, `auth.userId` and both
   * SecureStore tokens survive it — `src/services/auth/logout.ts:14-18` is the
   * only thing that removes them.
   *
   * That was survivable while the dead session was sent to the sign-in screen:
   * the seller signed in and login overwrote the stale row. Landing them on
   * Home instead removes that repair step, so without a `logout()` the SAME
   * expired refresh token is rehydrated on the next cold boot, `isSessionExpired`
   * is true again, and the toast fires again — every launch, for ever. There is
   * also a window each launch, before the async check resolves, where Home
   * renders the signed-in shell and fires account-scoped queries against a dead
   * token.
   *
   * Caught by a review pass, not by me: the original gate asserted only WHERE
   * the landing goes and never what state it left behind.
   */
  it('clears the persisted session, not only the in-memory one', () => {
    const code = codeOf(ROOT_LAYOUT);

    expect(code).toMatch(/logout\(\)/);
  });

  /**
   * Being signed out silently is its own defect: the seller sees their listings
   * vanish and has no idea why.
   */
  it('tells the person their session ended', () => {
    const code = codeOf(ROOT_LAYOUT);

    expect(code).toMatch(/sessionEnded|session ended|signed out/i);
  });
});
