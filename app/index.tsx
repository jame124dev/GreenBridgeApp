import { Redirect } from 'expo-router';

import { useAuth } from '@/stores/authStore';
import { IS_CUSTOMER } from '@/lib/flags';
import { homeRoute } from '@/features/v2/routing/postAuthLanding';

export default function Index() {
  const profile = useAuth((s) => s.profile);

  // ⚠️ DO NOT re-add an `isPending` redirect here (it used to send pending users
  // to /(auth)/pending, mirroring the AuthGuard). `isPending` only means "not
  // approved in the main users queue" — the state every new app signup starts
  // in — and a pending account is a working BUYER session. Only the SELL path is
  // gated, in launchSellerScan(), off /seller-upgrade/my-status.
  // ⛔ GUESTS GO STRAIGHT IN. This used to be
  // `<Redirect href="/(auth)/login" />`, which meant a fresh install could not
  // see a single product -- exactly what App Review rejected 1.0.3 (21) for on
  // 2026-08-24 under Guideline 5.1.1(v): "the app requires users to register
  // before browsing products". Browsing, search and the AI assistant are not
  // account-based, so they must be open. Account-based actions ask for an
  // identity at the point of use instead -- see `requireAuth()`.
  // Single destination: the seller `(tabs)` fork was deleted, so every signed-in
  // user lands in the (lab) app.
  //
  // ⚠️ THE FRONT DOOR. This used to hardcode `/(lab)/(tabs)/home`, which is why
  // the app still opened on the OLD UI after the post-auth return was fixed —
  // the return worked, but nothing had changed where LAUNCH goes. `homeRoute()`
  // is now the single answer for the whole app, keyed on `EXPO_PUBLIC_V2_UI`.
  // With the flag unset this is byte-identical to what shipped.
  return <Redirect href={homeRoute()} />;
}
