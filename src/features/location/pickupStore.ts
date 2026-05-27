import { mmkv } from '@/lib/mmkv';
import type { ResolvedLocation } from '@/services/location/getDeviceLocation';

const KEY = 'seller.location';

/** Last detected location — shown instantly on the home header and reused to
 *  auto-fill a new listing's pickup address. Single source of truth. */
export function readCachedLocation(): ResolvedLocation | null {
  try {
    const raw = mmkv.getString(KEY);
    return raw ? (JSON.parse(raw) as ResolvedLocation) : null;
  } catch {
    return null;
  }
}

export function writeCachedLocation(loc: ResolvedLocation): void {
  try {
    mmkv.set(KEY, JSON.stringify(loc));
  } catch {
    // best-effort cache
  }
}
