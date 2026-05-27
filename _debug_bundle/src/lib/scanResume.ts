import type { Href } from 'expo-router';

import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { routes } from '@/lib/routes';
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

export function getScanResumeRoute(state: {
  mode: ListingMode;
  queuedItems: DraftItem[];
  current: DraftItem | null;
}): Href {
  if (state.mode === 'grouped') {
    if (state.queuedItems.length > 0 && !state.current) {
      return routes.scanGroupedReview;
    }
    if (state.current) {
      return resumeRouteForItem(state.current);
    }
    return freshScanRoute;
  }

  if (!state.current) return freshScanRoute;
  return resumeRouteForItem(state.current);
}
