import { useAuth } from '@/stores/authStore';

import { useSignInPromptStore, type GateReason } from './signInPromptStore';

/**
 * Run `action` if there is a session; otherwise ask the guest to sign in.
 *
 * Callable from plain event handlers (not a hook), so a button's `onPress` can
 * be wrapped without restructuring the component:
 *
 *   onPress={() => requireAuth('message', () => router.push(threadHref))}
 *
 * Reads the store imperatively via `getState()` on purpose — the caller is a
 * callback, not a render, so subscribing would be wrong.
 */
export function requireAuth(reason: GateReason, action: () => void): void {
  if (useAuth.getState().profile) {
    action();
    return;
  }
  useSignInPromptStore.getState().open(reason);
}

/** True when nobody is signed in — for hiding account-only SECTIONS in a render. */
export function useIsGuest(): boolean {
  return useAuth((s) => !s.profile);
}
