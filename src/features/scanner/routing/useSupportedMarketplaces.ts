import { useQuery } from '@tanstack/react-query';

import type { MarketplaceKey } from '@/stores/scanDraftStore';

import { MARKETPLACE_PICKER_ENABLED } from '@/lib/flags';

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
  /*
   * ⚠️ GATED WITH `enabled`, AND THE HOOK ALWAYS RUNS.
   *
   * The first version of this returned early, before `useQuery`, on the
   * reasoning that a BUILD-TIME constant cannot change between renders. That
   * reasoning was wrong and the device said so immediately: "Should have a
   * queue. You are likely calling Hooks conditionally." Fast Refresh re-renders
   * the same component across a module swap, so the hook count DID change — and
   * the unit tests never saw it, because each suite mocks the flag one way for
   * its whole run.
   *
   * `enabled` is the correct lever: the hook order is fixed, and with the
   * picker off `queryFn` never runs, so this build still never asks the server
   * about marketplaces it cannot list to.
   */
  const q = useQuery({
    enabled: MARKETPLACE_PICKER_ENABLED,
    queryKey: SUPPORTED_QUERY_KEY,
    queryFn: fetchSupportedMarketplaces,
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    placeholderData: () => readCachedSupported() ?? fallbackMarketplaces(),
  });
  // Picker off ⇒ this deployment's own marketplace, full stop. Every consumer
  // — v2's 7b, the shipped `RoutingChip`, `MarketplaceSheet` — collapses with
  // it, so no screen is left holding a stale three-option list.
  if (!MARKETPLACE_PICKER_ENABLED) return fallbackMarketplaces();
  return q.data?.length ? q.data : fallbackMarketplaces();
}
