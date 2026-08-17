// useMatchesBadge — the LIVE count behind the Matches tab's orange pill.
//
// Replaces `STATIC_BADGES.matches = 3` (the prototype placeholder that spec 08
// §5.1 always intended to be swapped for a real source). That literal rendered
// a "3" on every account, including a brand-new one with zero wants — an App
// Review reviewer saw exactly that.
//
// Definition: the number of matched products across the buyer's ACTIVE wants —
// the same thing the Matches screen's "MATCHES" stat counts. Paused wants are
// excluded on purpose: pausing a want means "stop alerting me", so its matches
// must not nag from the tab bar.
//
// It is a TOTAL, not an unseen count: `listWantMatches` carries no seen/unseen
// marker, so "new" cannot be derived. Both the stat and this badge's a11y copy
// say "matches" for that reason — they previously said "new matches", which
// reported a months-old match set as if it had just arrived.
//
// Cost: ZERO extra network work. It reads the exact React Query keys the
// Matches screen and its WantCards already use (`labKeys.wants()` +
// `labKeys.wantMatches(id)`), so whichever surface mounts first fills the cache
// and the other reads it. Because the tab bar mounts with the (tabs) group, the
// count is right on a cold start instead of only after the user opens the tab.
import { useQueries } from '@tanstack/react-query';

import { WTB_ENABLED } from '@/lib/flags';
import { useAuth } from '@/stores/authStore';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { listWantMatches } from '@/features/lab/data/wtbApi';
import { useWants } from '@/features/lab/hooks/useWants';
import { isActiveStatus } from '@/features/lab/wants/data/wantsView';

/**
 * Matched-product count across the signed-in buyer's active wants.
 *
 * Returns `0` while loading, when signed out, and when `WTB_ENABLED` is off —
 * and `TabBadge` renders nothing at `0`, so the pill simply never appears
 * rather than flashing a placeholder or a "0" that carries no information.
 */
export function useMatchesBadgeCount(): number {
  // Per-account by construction: no profile → no count. Sign-out additionally
  // wipes the query cache (useLogout → queryClient.clear()), so a second
  // account on the same device cannot inherit the first one's number. Nothing
  // here is persisted to MMKV, so a cold start starts from zero and refetches.
  const userId = useAuth((s) => s.profile?.id ?? null);
  const signedIn = userId != null;

  const { wants } = useWants();
  const activeWants = signedIn ? wants.filter((w) => isActiveStatus(w.status)) : [];

  // Same queryKey + enabled as the Matches screen's `useQueries`, so the two
  // share one cache entry per want (no duplicate requests, no divergent count).
  const matchQueries = useQueries({
    queries: activeWants.map((w) => ({
      queryKey: labKeys.wantMatches(w.id),
      queryFn: () => listWantMatches(w.id),
      enabled: WTB_ENABLED,
    })),
  });

  return matchQueries.reduce((total, q) => total + (q.data?.length ?? 0), 0);
}
