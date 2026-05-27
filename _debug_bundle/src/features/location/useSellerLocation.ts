import { useCallback, useEffect, useState } from 'react';

import {
  getDeviceLocation,
  hasLocationPermission,
  type LocationResult,
  type ResolvedLocation,
} from '@/services/location/getDeviceLocation';
import { readCachedLocation, writeCachedLocation } from './pickupStore';

/**
 * Seller's current location for the home header. Shows the last-known location
 * instantly from cache, silently refreshes on mount when permission is already
 * granted, and exposes `detect()` for an explicit tap-to-detect (which prompts
 * for permission if needed).
 */
export function useSellerLocation() {
  const [location, setLocation] = useState<ResolvedLocation | null>(() => readCachedLocation());
  const [detecting, setDetecting] = useState(false);

  const save = useCallback((loc: ResolvedLocation) => {
    setLocation(loc);
    writeCachedLocation(loc);
  }, []);

  const detect = useCallback(async (): Promise<LocationResult> => {
    setDetecting(true);
    try {
      const res = await getDeviceLocation();
      if (res.ok) save(res.location);
      return res;
    } finally {
      setDetecting(false);
    }
  }, [save]);

  // On mount, silently refresh only when permission's already granted — never
  // prompts from the home screen unprompted.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await hasLocationPermission())) return;
      const res = await getDeviceLocation();
      if (!cancelled && res.ok) save(res.location);
    })();
    return () => {
      cancelled = true;
    };
  }, [save]);

  return { location, detecting, detect };
}
