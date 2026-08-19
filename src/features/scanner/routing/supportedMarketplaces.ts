import { greenbidz } from '@/api/greenbidzClient';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

import {
  fallbackMarketplaces,
  normalizeSupported,
  readCachedSupported,
  writeCachedSupported,
} from './supportedMarketplacesCache';

/** One key, shared by the hook and by the `_layout.tsx` prefetch. */
export const SUPPORTED_QUERY_KEY = ['supportedMarketplaces'] as const;

/**
 * GET /mobile-config. On any failure returns the last good cached list, and
 * failing that the build's own marketplace. Never throws — the marketplace
 * picker must not be able to break a scan.
 *
 * NOTE the resolve-on-failure contract: because this never rejects, React
 * Query's `retry` never sees an error and the prefetch in `_layout.tsx` always
 * resolves. That is deliberate; the 404 case (the state of the dev host until
 * the server engineer ships the route) is a normal outcome, not an error.
 *
 * ⚠️ Do NOT re-export the cache helpers from here. The store must not be able
 * to reach axios through this file — see supportedMarketplacesCache.ts's
 * import rule.
 */
export async function fetchSupportedMarketplaces(): Promise<MarketplaceKey[]> {
  try {
    const res = await greenbidz.get('/mobile-config', { timeout: 8_000 });
    const list = normalizeSupported(res.data?.data?.supported_marketplaces);
    if (list.length) {
      writeCachedSupported(list);
      return list;
    }
  } catch {
    // fall through — 404 / offline / malformed all land here
  }
  return readCachedSupported() ?? fallbackMarketplaces();
}
