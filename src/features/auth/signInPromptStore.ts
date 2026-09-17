import { create } from 'zustand';

/**
 * Which account-based action a guest just reached for. Drives the copy in
 * `SignInPrompt`, so the prompt names the thing they wanted rather than saying
 * "please sign in" and leaving them to guess why.
 */
export type GateReason =
  | 'message'
  | 'want'
  | 'sell'
  | 'notifications'
  | 'account'
  | 'draft'
  | 'offer';

type State = {
  reason: GateReason | null;
  /**
   * Where to send the person BACK to once they have signed in.
   *
   * ⚠️ WHY THIS EXISTS. `app/(auth)/login.tsx` ends with
   * `router.replace(HOME_ROUTE)`, and `HOME_ROUTE` is the hardcoded OLD home
   * `/(lab)/(tabs)/home`. So a guest who was in v2, tapped an account-based
   * control, and signed in was deposited in the OLD UI — v2 gone, and the thing
   * they were trying to do gone with it. Reported from the device repeatedly as
   * "it goes back to the previous version while using".
   *
   * It is a plain path rather than the pending action, deliberately: replaying
   * an arbitrary closure across a navigation and a remount is how you get a
   * write fired twice. Returning someone to the SCREEN they were on is honest
   * and cheap; they press the control again, now signed in, and it works.
   *
   * Only ever honoured for `/v2` paths — see the note in `login.tsx`.
   */
  returnTo: string | null;
  open: (reason: GateReason) => void;
  /** Remember the screen to come back to. Called just before leaving for auth. */
  setReturnTo: (path: string | null) => void;
  close: () => void;
};

/**
 * ⛔ WHY GUESTS EXIST AT ALL — App Review, Guideline 5.1.1(v), 2026-08-24:
 *
 *   "The app requires users to register or log in to access features that are
 *    not account based. Specifically, the app requires users to register before
 *    browsing products. Registration can only be required for account-based
 *    features like adding to cart or checking out."
 *
 * So browsing, searching and the AI assistant are open to everyone, and only
 * genuinely account-based actions ask for an identity. This store is the ONE
 * place that asking happens, so the boundary is auditable: grep `requireAuth(`
 * and you have the full list of what still needs an account.
 *
 * ⚠️ Do NOT go back to redirecting guests at the door (`app/_layout.tsx`,
 * `app/index.tsx`). That is the exact shape 1.0.3 (21) was rejected for.
 */
export const useSignInPromptStore = create<State>((set) => ({
  reason: null,
  returnTo: null,
  open: (reason) => set({ reason }),
  setReturnTo: (path) => set({ returnTo: path }),
  // `returnTo` deliberately SURVIVES close(). The sheet unmounts the moment we
  // navigate to the auth stack, and the whole point is that the path outlives
  // it — login reads it after the sheet is long gone, and clears it itself.
  close: () => set({ reason: null }),
}));
