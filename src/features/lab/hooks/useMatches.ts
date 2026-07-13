// useMatches — the live Matches-feed hook (NewVersion/dynamic/04 §7).
//
// There is NO `/lab/matches` endpoint. The feed is the UNION of recent matches
// across the buyer's active wants: `GET /wtb` → for each active want
// `GET /wtb/{id}/matches`, flattened + sorted newest-first, then mapped into the
// static `MatchCard` shape via `matchesToFeed` so the screen's existing
// `toMatchVM` adapter + JSX render unchanged (static → live is source-only).
//
// Flag-gated: `enabled` only when `WTB_ENABLED`. With the flag OFF the query does
// not fire (the screen keeps reading `demo.MATCHES` / static `matchesView`), so
// no half-wired state and no 404s against a disabled backend.
import { useQuery } from '@tanstack/react-query';

import { WTB_ENABLED } from '@/lib/flags';
import type { MatchCard } from '@/features/lab/data/demo';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { matchesToFeed } from '@/features/lab/data/matchesFromApi';
import { listWants, listWantMatches, type WtbRequestSummary } from '@/features/lab/data/wtbApi';

/** Active = not paused / fulfilled / expired / deleted. Default (no status) → active. */
function isActive(w: WtbRequestSummary): boolean {
  const s = (w.status ?? 'active').toLowerCase();
  return s === 'active';
}

/** Fetch every active want's matches and flatten into one newest-first feed. */
async function fetchMatchesFeed(): Promise<MatchCard[]> {
  const wants = await listWants();
  const active = wants.filter(isActive);
  const groups = await Promise.all(
    active.map(async (want) => ({
      want,
      // A single want's matches failing must not sink the whole feed.
      matches: await listWantMatches(want.id).catch(() => []),
    })),
  );
  return matchesToFeed(groups);
}

export interface UseMatchesResult {
  /** Mapped feed rows in the static `MatchCard` shape (feed the screen's `toMatchVM`). */
  matches: MatchCard[];
  isLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
  /** True after a successful fetch that returned zero rows (distinct from loading). */
  isEmpty: boolean;
  refetch: () => void;
}

/**
 * Live Matches feed. Returns `{ matches, isLoading, isRefetching, isError,
 * isEmpty, refetch }`. When `WTB_ENABLED` is false the query is disabled and
 * `matches` is `[]` with `isLoading:false` (the screen falls back to static).
 */
export function useMatches(): UseMatchesResult {
  const query = useQuery({
    queryKey: labKeys.matches(),
    queryFn: fetchMatchesFeed,
    enabled: WTB_ENABLED,
  });

  const matches = query.data ?? [];
  return {
    matches,
    isLoading: query.isLoading && WTB_ENABLED,
    isRefetching: query.isRefetching,
    isError: query.isError,
    isEmpty: query.isSuccess && matches.length === 0,
    refetch: () => {
      void query.refetch();
    },
  };
}
