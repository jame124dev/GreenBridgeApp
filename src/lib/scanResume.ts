import type { Href } from 'expo-router';

import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { routes } from '@/lib/routes';
import type { MappedSmartDetection } from '@/features/scanner/smartDetectionTypes';
import type { DraftItem, ListingMode } from '@/stores/scanDraftStore';

// Fresh-scan entry: smart-detection opens the camera directly (the AI picks
// single vs multiple); the legacy flow opens the listing-method picker.
const freshScanRoute: Href = SMART_DETECT_ENABLED
  ? routes.scanCamera
  : routes.scanListingMethod;

function resumeRouteForItem(draft: DraftItem): Href {
  if (!draft.photos?.length) return routes.scanCamera;

  // Review was merged into Detail — once AI has run (or the user reached
  // detail/review previously, including older persisted drafts with
  // lastStep 'review'), resume straight into the Detail edit screen.
  if (
    draft.lastStep === 'detail' ||
    draft.lastStep === 'review' ||
    draft.aiSkipped ||
    draft.ai
  ) {
    return routes.scanDetail;
  }
  return routes.scanProcessing;
}

export type ScanResumeState = {
  mode: ListingMode;
  queuedItems: DraftItem[];
  current: DraftItem | null;
  // Memory-only handshake from processing → detection. Only set during the
  // session that ran AI; lost on cold start. When present, the user was
  // mid-detection and we route them straight back to that screen.
  pendingDetection?: MappedSmartDetection | null;
};

// Resume decisions live here as a single tree. Evaluated top to bottom so
// the most specific in-progress state wins. The staged screen was removed
// per product call — capture now flows camera → processing directly, so
// `pendingPhotos` no longer carries an active resume target.
export function getScanResumeRoute(state: ScanResumeState): Href {
  // 1. Warm resume: user was on the detection screen this session.
  //    Only reachable when pendingDetection survived in memory.
  if (state.pendingDetection) return routes.scanDetection;

  // 2. Grouped session: existing behavior, queue and current draft as before.
  if (state.mode === 'grouped') {
    if (state.queuedItems.length > 0 && !state.current) {
      return routes.scanGroupedReview;
    }
    if (state.current) {
      return resumeRouteForItem(state.current);
    }
    return freshScanRoute;
  }

  // 3. Single-mode draft: continue editing where the user left off.
  if (state.current) return resumeRouteForItem(state.current);

  return freshScanRoute;
}
