import { useCallback, useEffect, useState } from 'react';

import {
  getDeviceLocation,
  hasLocationPermission,
} from '@/services/location/getDeviceLocation';

import {
  markPrimerShown,
  wasPrimerShown,
  writeCachedLocation,
} from './pickupStore';

export type LocationPrimerState = {
  /** Whether the soft pre-prompt sheet should be visible. */
  shouldShowPrimer: boolean;
  /** "Use location" — triggers native OS prompt then geocodes + caches. */
  onAccept: () => Promise<void>;
  /** "Not now" — hides the sheet without prompting; respects user's deferral. */
  onDecline: () => void;
  /** True while OS prompt + fetch in flight, so the sheet can show a spinner. */
  accepting: boolean;
};

/**
 * Soft pre-prompt orchestration for the scan flow's location ask. Per the
 * permission-strategy doc: when the user opens the camera, this hook decides
 * whether to surface a one-time soft pre-prompt explaining the auto-fill value
 * before the OS prompt. If permission's already granted, the GPS read happens
 * silently in the background and the sheet never shows. The "shown" flag
 * persists across launches via MMKV so we don't re-ask within the same install;
 * the explicit "Use my location" button on the detail screen remains the
 * re-prompt path.
 *
 * @param active — pass `true` only once the camera permission has been granted
 *                  and the camera screen is the active surface; pass `false`
 *                  otherwise so the effect doesn't fire from a hidden screen.
 */
export function useScanLocationPrimer(active: boolean): LocationPrimerState {
  const [shouldShowPrimer, setShouldShowPrimer] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      if (await hasLocationPermission()) {
        const res = await getDeviceLocation();
        if (!cancelled && res.ok) writeCachedLocation(res.location);
        return;
      }
      if (wasPrimerShown()) return;
      if (!cancelled) setShouldShowPrimer(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const onAccept = useCallback(async () => {
    setAccepting(true);
    try {
      const res = await getDeviceLocation();
      if (res.ok) writeCachedLocation(res.location);
    } finally {
      markPrimerShown();
      setShouldShowPrimer(false);
      setAccepting(false);
    }
  }, []);

  const onDecline = useCallback(() => {
    markPrimerShown();
    setShouldShowPrimer(false);
  }, []);

  return { shouldShowPrimer, onAccept, onDecline, accepting };
}
