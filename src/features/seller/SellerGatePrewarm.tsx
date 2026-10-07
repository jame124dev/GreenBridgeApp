// SellerGatePrewarm — warm `/seller-upgrade/my-status` into the query cache when
// the (lab) app opens. Renders nothing.
//
// WHY THIS EXISTS: the sell gate in `launchSellerScan()` is a plain function, so
// it reads the CACHE (`queryClient.getQueryData`) rather than a hook — and it
// fails closed, because "may this user list?" has no safe optimistic answer. A
// cold cache therefore reads as "not approved", which would bounce an APPROVED
// seller to the application screen on the first Sell tap of every app launch.
// Fetching the status once on entry removes that bounce without weakening the
// gate: the gate itself is unchanged, it simply has the answer by the time it is
// asked.
//
// Mounted alongside `MarketplacePrewarm` in `app/(lab)/_layout.tsx`. Isolated in
// its own null-rendering component so a status change re-renders this, not the
// whole (lab) navigator.
//
// ⚠️ IT NOW WARMS TWO THINGS, AND THE SECOND ONE FAILS THE OTHER WAY.
// The gate also reads the onboarding row, to stop an approved seller who never
// finished the wizard from publishing an empty profile. That half fails OPEN on
// a cold cache — see the long note in `sellerSubmitGate.ts` — so warming it is
// not merely a convenience here, it is what makes the check effective at all.
import { useSellerUpgradeStatus } from '@/features/seller/useSellerUpgrade';
import { useSellerStatus } from '@/features/seller/useSellerStatus';

export function SellerGatePrewarm(): null {
  // 60s staleTime lives on the hook, so re-entering (lab) does not re-request.
  useSellerUpgradeStatus();
  // Same 60s staleTime, and disabled entirely for guests.
  useSellerStatus();
  return null;
}
