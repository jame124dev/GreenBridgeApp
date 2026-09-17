/**
 * THE POST-AUTH GATEKEEPER — one place that decides where you land after
 * signing in or registering.
 *
 * ── WHY THIS IS ONE FUNCTION AND NOT THREE ─────────────────────────────────
 *
 * Signing in from a v2 screen used to eject you into the OLD UI. Reported from
 * the device more than once, in the user's words: "it goes back to the previous
 * version while using". It was never a v2 bug — every v2 screen was clean, so
 * the `v2 exits into the old UI` suite could not see it. The ejection lived in
 * the shared auth stack, in THREE separate places, each with its own copy of
 * the same hardcoded constant:
 *
 *   1. `app/(auth)/login.tsx`     → onSuccess and the ACCOUNT_PENDING branch
 *   2. `app/(auth)/register.tsx`  → the same two shapes again
 *   3. `app/_layout.tsx` AuthGuard → `if (profile && inAuthGroup) replace(HOME)`
 *
 * (3) is the reason patching (1) and (2) alone does not work. It is a global
 * effect keyed on `profile`, so the instant login sets a profile while the
 * route is still inside `(auth)`, it fires and replaces the destination the
 * screen just chose. Two redirects race and the hardcoded one often wins. Fix
 * the screens only and the bug appears to be fixed, intermittently — the worst
 * possible outcome.
 *
 * So all three call THIS, and `v2Inventory.test.ts` asserts none of them still
 * contains a bare `router.replace(HOME_ROUTE)`.
 *
 * ── WHY A PATH AND NOT THE PENDING ACTION ──────────────────────────────────
 *
 * `requireAuth(reason, action)` discards `action` for a guest, and this does
 * not resurrect it. Replaying an arbitrary closure across a navigation, an auth
 * round-trip and a remount is how a write fires twice. Returning someone to the
 * SCREEN they were on is honest and cheap: they press the control again, now
 * signed in, and it works.
 *
 * ── WHY IT IS SCOPED TO /v2 ────────────────────────────────────────────────
 *
 * This runs in the SHIPPED auth stack. Old-UI users must keep landing exactly
 * where they land today, so anything that is not a `/v2` path falls through to
 * the same `HOME_ROUTE` replace that shipped. The v2 fix cannot regress the
 * live app, because for the live app this function is the identity.
 */
import type { Href } from 'expo-router';

import { useSignInPromptStore } from '@/features/auth/signInPromptStore';
import { V2_UI_ENABLED } from '@/lib/flags';

/**
 * The old UI's home. Mirrored in `app/_layout.tsx`, `login.tsx` and
 * `register.tsx`, which all predate this module — kept as the fallback so the
 * shipped behaviour is byte-identical when no v2 return path is pending.
 */
export const LEGACY_HOME = '/(lab)/(tabs)/home';

/** v2's Home (6a/6b). */
export const V2_HOME = '/v2';

/**
 * WHERE "HOME" IS, for the whole app — the one answer, flag-driven.
 *
 * ⚠️ THIS IS THE FIX FOR "it keeps showing the old screen". Until now, *four*
 * separate places each hardcoded `/(lab)/(tabs)/home`, so even with v2 built,
 * verified and reachable, every one of these dropped you back into the old UI:
 *
 *   • `app/index.tsx`             — the LAUNCH redirect, i.e. opening the app
 *   • `app/_layout.tsx` AuthGuard — the post-auth bounce out of `(auth)`
 *   • `app/(auth)/login.tsx`      — fallback when no v2 return is pending
 *   • `app/(auth)/register.tsx`   — same
 *
 * Fixing only the post-auth return (2026-09-16) left the LAUNCH one, which is
 * why a fresh open still landed on the old home and the fix looked like it had
 * not worked. It had — it just did not cover the front door.
 *
 * Everything keys off one flag, so there is exactly one switch:
 *   `EXPO_PUBLIC_V2_UI=1` → the app IS v2.
 *   unset/0                → the app is the old UI, byte-identical to today.
 *
 * ⚠️ `EXPO_PUBLIC_*` is inlined at BUNDLE time. Changing it needs a Metro
 * restart, not a reload — a reload will appear to do nothing and cost you
 * twenty minutes.
 */
export function homeRoute(): Href {
  return (V2_UI_ENABLED ? V2_HOME : LEGACY_HOME) as Href;
}

/** A return path is only honoured if it points back into v2. */
function isV2Path(path: string | null): path is string {
  return !!path && path.startsWith('/v2');
}

/**
 * Where to send someone once they are authenticated.
 *
 * ⚠️ CONSUMES the stored path. Called from up to three racing redirects, and
 * whichever fires first wins — the others then correctly see `null` and fall
 * back to `LEGACY_HOME`, which is a no-op because the first one already landed
 * on the right screen. Clearing also stops a later sign-in from the OLD UI
 * inheriting a stale v2 destination.
 */
export function postAuthLanding(): Href {
  const { returnTo, setReturnTo } = useSignInPromptStore.getState();
  // No specific screen owed → whatever "home" means for this build.
  if (!isV2Path(returnTo)) return homeRoute();
  setReturnTo(null);
  return returnTo as Href;
}

/**
 * True when a v2 return is pending — for the AuthGuard, which must NOT bounce
 * someone to the legacy home while a v2 landing is still owed to them.
 *
 * Read-only on purpose: the guard asks "is this mine to handle?", and the
 * screen that actually navigates is the one that consumes the path.
 */
export function hasPendingV2Return(): boolean {
  return isV2Path(useSignInPromptStore.getState().returnTo);
}
