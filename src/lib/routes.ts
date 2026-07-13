import type { Href } from 'expo-router';

/** Typed-route-safe paths (regenerate with `npx expo start` if routes change). */
export const routes = {
  scanHome: '/(tabs)' as Href,
  /** (lab) full "my listings" view — reached from Home Recent listings "See all". */
  labListings: '/(lab)/(tabs)/listings' as Href,
  /** (lab) dedicated notifications page — reached from the header bell. */
  labNotifications: '/(lab)/notifications' as Href,
  profile: '/(tabs)/profile' as Href,
  scanListingMethod: '/scan/listing-method' as Href,
  scanGroupedReview: '/scan/grouped-review' as Href,
  // Round 2 R1/R2 — per-item editor reached from the review-hub. New route
  // (decision recorded per R-5): a dedicated file rather than adapting
  // detail.tsx, since the per-item editor binds to `queuedItems[index]` via
  // `patchQueuedItem` while detail.tsx still owns the single-product `current`
  // semantics + 4 submit modes. Both screens share `formMapping.ts` so the
  // form↔draft mapping has one source of truth.
  scanGroupedEdit: (index: number) =>
    ({
      pathname: '/scan/grouped-edit',
      params: { index: String(index) },
    }) as unknown as Href,
  scanCamera: '/scan/camera' as Href,
  scanDetection: '/scan/detection' as Href,
  scanReorderPhotos: '/scan/reorder-photos' as Href,
  scanReorderPhotosEdit: () =>
    ({ pathname: '/scan/reorder-photos', params: { mode: 'edit' } }) as unknown as Href,
  scanProcessing: '/scan/processing' as Href,
  scanProcessingV2: '/scan/processing-v2' as Href,
  activityHistory: '/activity/history' as Href,
  scanDetail: '/scan/detail' as Href,
  listingDetail: (batchPk: number) => `/listing/${batchPk}` as Href,
  scanSuccess: (
    batchPk: number,
    batchNumber: number,
    itemCount?: number,
    groupId?: number,
    /**
     * Per-item rows for the success screen list (multi-product submissions).
     * Each entry carries the data we already have from the backend's
     * grouped-listing response; the success screen renders one row per item
     * and lets the user tap into any of them, not just the first.
     */
    items?: { title: string; batchPk: number; batchNumber?: number }[],
  ) =>
    ({
      pathname: '/scan/success',
      params: {
        batchPk: String(batchPk),
        batchNumber: String(batchNumber),
        itemCount: itemCount != null ? String(itemCount) : undefined,
        // W1 (scan_v3) — grouped submits now carry an auction_group id; the
        // success screen surfaces it alongside the canonical batch number.
        // Singles call this without the arg, so the param is conditional.
        groupId: groupId != null ? String(groupId) : undefined,
        // JSON-encoded compact items list. Capped at a few hundred bytes per
        // submission (≤10 products × ~50 char title) — well under URL limits.
        items: items && items.length ? JSON.stringify(items) : undefined,
      },
    }) as unknown as Href,
};
