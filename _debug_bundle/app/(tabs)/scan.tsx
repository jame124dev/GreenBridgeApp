import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

// The Scan tab is a launcher, not a screen — it immediately routes into the
// scan flow. `useFocusEffect` re-runs on every tab tap so each entry starts
// fresh. When smart-detection is the default, we reset any abandoned session
// (so a stale grouped mode/queue can't leak) and open the camera directly;
// otherwise we fall back to the single-vs-grouped listing-method picker.
export default function ScanTabRedirect() {
  useFocusEffect(
    useCallback(() => {
      if (SMART_DETECT_ENABLED) {
        useScanDraft.getState().reset();
        router.replace(routes.scanCamera);
      } else {
        router.replace(routes.scanListingMethod);
      }
    }, []),
  );
  return null;
}
