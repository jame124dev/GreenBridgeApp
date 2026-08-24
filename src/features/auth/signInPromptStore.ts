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
  open: (reason: GateReason) => void;
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
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}));
