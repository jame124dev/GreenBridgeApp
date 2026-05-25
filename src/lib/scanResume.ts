import type { Href } from 'expo-router';

import { routes } from '@/lib/routes';
import type { DraftItem, ListingMode } from '@/stores/scanDraftStore';

function resumeRouteForItem(draft: DraftItem): Href {
  if (!draft.photos?.length) return routes.scanCamera;

  if (draft.lastStep === 'detail' || draft.aiSkipped) {
    return routes.scanDetail;
  }
  if (draft.lastStep === 'review' || draft.ai) {
    return routes.scanReview;
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
    return routes.scanListingMethod;
  }

  if (!state.current) return routes.scanListingMethod;
  return resumeRouteForItem(state.current);
}
