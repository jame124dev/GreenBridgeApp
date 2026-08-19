import { useQuery } from '@tanstack/react-query';

import type { MarketplaceKey } from '@/stores/scanDraftStore';

import { fallbackMarketplaces, readCachedSupported } from './supportedMarketplacesCache';
import { fetchSupportedMarketplaces, SUPPORTED_QUERY_KEY } from './supportedMarketplaces';

/**
 * The marketplaces this install may route to. Synchronous by design: the first
 * render already has the cached-or-fallback list, so no scan screen ever shows
 * a loading state or an empty picker while the config is in flight.
 *
 * ⚠️ `placeholderData`, NEVER `initialData` — blocker (b). React Query v5 stamps
 * `initialData` with `dataUpdatedAt = Date.now()`
 * (query-core/build/modern/query.js:434,:438), so `initialData` + a 30-minute
 * `staleTime` means the query is fresh on mount and `queryFn` NEVER RUNS. The
 * server-driven list would be dead on device and every unit test would still
 * pass. `placeholderData` is resolved in the observer while the query is
 * `pending` (queryObserver.js:265-280) and does not touch `dataUpdatedAt`, so
 * we get the synchronous first value AND the fetch.
 *
 * If you ever must go back to `initialData`, it MUST carry
 * `initialDataUpdatedAt: 0`. There is a test for this —
 * `__tests__/useSupportedMarketplaces.test.tsx`.
 */
export function useSupportedMarketplaces(): MarketplaceKey[] {
  const q = useQuery({
    queryKey: SUPPORTED_QUERY_KEY,
    queryFn: fetchSupportedMarketplaces,
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    placeholderData: () => readCachedSupported() ?? fallbackMarketplaces(),
  });
  return q.data?.length ? q.data : fallbackMarketplaces();
}
