import { Redirect } from 'expo-router';

import { useAuth } from '@/stores/authStore';
import { IS_CUSTOMER } from '@/lib/flags';

export default function Index() {
  const profile = useAuth((s) => s.profile);

  // ⚠️ DO NOT re-add an `isPending` redirect here (it used to send pending users
  // to /(auth)/pending, mirroring the AuthGuard). `isPending` only means "not
  // approved in the main users queue" — the state every new app signup starts
  // in — and a pending account is a working BUYER session. Only the SELL path is
  // gated, in launchSellerScan(), off /seller-upgrade/my-status.
  if (!profile) return <Redirect href="/(auth)/login" />;
  // Single destination: the seller `(tabs)` fork was deleted, so every signed-in
  // user lands in the (lab) app.
  return <Redirect href="/(lab)/(tabs)/home" />;
}
