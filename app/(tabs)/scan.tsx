import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

// The Scan tab is a launcher, not a screen — it immediately routes into the
// scan flow. Behavior is FLUSH-ALWAYS: any in-progress draft, queued grouped
// items, and warm `pendingDetection` are reset on every tap. The planned
// drafts surface will be the only way to resume saved work; Scan tab is
// "start a new scan" only. `getScanResumeRoute` lives in `src/lib/scanResume`
// for that future surface to reuse the precedence tree.
export default function ScanTabRedirect() {
  useFocusEffect(
    useCallback(() => {
      useScanDraft.getState().reset();
      router.replace(
        SMART_DETECT_ENABLED ? routes.scanCamera : routes.scanListingMethod,
      );
    }, []),
  );

  return null;
}
