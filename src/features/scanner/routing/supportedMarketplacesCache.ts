import { marketplaceFromSiteType } from '@/features/scanner/constants';
import { mmkv } from '@/lib/mmkv';
import { getSiteType } from '@/services/scanner/buildFormData';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

/**
 * M-12, the AXIOS-FREE half.
 *
 * ⚠️ IMPORT RULE: `src/stores/scanDraftStore.ts` and `app/scan/processing.tsx`
 * import THIS module and never `./supportedMarketplaces`. That module imports
 * `@/api/greenbidzClient`, which at module load calls
 * `attachGreenbidzInterceptors` (greenbidzClient.ts:24) and pulls in
 * interceptors -> services/auth/logout -> features/lab/messages/socket
 * (socket.io-client) + lib/secureStorage. None of that belongs in the scan
 * store's graph, and `scanDraftStore.test.ts` /
 * `scanDraftStore.hydrate.test.ts` are the two suites that would inherit it.
 *
 * Everything here is safe in those suites already: `@/lib/mmkv` is mocked in
 * both, `constants.ts` has ZERO imports (verified), and `getSiteType` reads
 * `Constants.expoConfig.extra` (buildFormData.ts:290-293) which the store
 * already imports.
 */

const CACHE_KEY = 'scan.supportedMarketplaces';
export const SUPPORTED_CACHE_KEY = CACHE_KEY;

const KNOWN: readonly MarketplaceKey[] = ['101lab', '101machine', '101it', '101recycle'];

/**
 * The build's OWN marketplace — the fail-closed answer. Identical to 1.0.3
 * behaviour, so an offline seller, a 404, or a malformed payload can never
 * make the app worse than the version already in the store.
 */
export function fallbackMarketplaces(): MarketplaceKey[] {
  return [marketplaceFromSiteType(getSiteType()) ?? '101lab'];
}

/** Keep KNOWN order (the app renders in it) and drop anything unrecognised. */
export function normalizeSupported(value: unknown): MarketplaceKey[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(
    value.filter((v): v is string => typeof v === 'string').map((v) => v.trim().toLowerCase()),
  );
  return KNOWN.filter((m) => wanted.has(m));
}

export function readCachedSupported(): MarketplaceKey[] | null {
  const raw = mmkv.getString(CACHE_KEY);
  if (!raw) return null;
  try {
    const list = normalizeSupported(JSON.parse(raw));
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export function writeCachedSupported(list: MarketplaceKey[]): void {
  if (!list.length) return; // never cache an empty list over a good one
  mmkv.set(CACHE_KEY, JSON.stringify(list));
}

/**
 * The synchronous answer for the two non-React call sites (the store's lock 2
 * and the analyze path's lock 3). Cache first, build's own site type second.
 *
 * ⚠️ blocker (a): on a FRESH INSTALL the cache is empty, so this returns ONE
 * marketplace and `routingNeedsAsk` returns false — the first scan would behave
 * exactly like 1.0.3 and stamp `marketplaceConfirmed: true`. The launch
 * prefetch in `app/_layout.tsx` is what makes that not happen; do not ship one
 * without the other.
 */
export function supportedNow(): MarketplaceKey[] {
  const cached = readCachedSupported();
  return cached && cached.length ? cached : fallbackMarketplaces();
}
