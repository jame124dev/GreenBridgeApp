import type { Href } from 'expo-router';

/** Typed-route-safe paths (regenerate with `npx expo start` if routes change). */
export const routes = {
  scanHome: '/(tabs)' as Href,
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
  activityHistory: '/activity/history' as Href,
  scanDetail: '/scan/detail' as Href,
  listingDetail: (batchPk: number) => `/listing/${batchPk}` as Href,
  scanSuccess: (
    batchPk: number,
    batchNumber: number,
    itemCount?: number,
    groupId?: number,
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
      },
    }) as unknown as Href,
};
