import { mmkv } from '@/lib/mmkv';
import type { ResolvedLocation } from '@/services/location/getDeviceLocation';

const KEY = 'seller.location';
const PRIMER_KEY = 'seller.location.primerShown';

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

/** Has the scan-flow soft pre-prompt been shown to this install already? */
export function wasPrimerShown(): boolean {
  try {
    return mmkv.getBoolean(PRIMER_KEY) ?? false;
  } catch {
    return false;
  }
}

/** Mark the soft pre-prompt as shown so we don't re-ask within the same
 *  install. Re-prompts come from the detail screen's explicit
 *  "Use my location" affordance instead. */
export function markPrimerShown(): void {
  try {
    mmkv.set(PRIMER_KEY, true);
  } catch {
    // best-effort
  }
}
