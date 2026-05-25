import type { Href } from 'expo-router';

/** Typed-route-safe paths (regenerate with `npx expo start` if routes change). */
export const routes = {
  scanHome: '/(tabs)' as Href,
  profile: '/(tabs)/profile' as Href,
  scanListingMethod: '/scan/listing-method' as Href,
  scanGroupedReview: '/scan/grouped-review' as Href,
  scanCamera: '/scan/camera' as Href,
  scanReorderPhotos: '/scan/reorder-photos' as Href,
  scanReorderPhotosEdit: () =>
    ({ pathname: '/scan/reorder-photos', params: { mode: 'edit' } }) as unknown as Href,
  scanProcessing: '/scan/processing' as Href,
  activityHistory: '/activity/history' as Href,
  scanReview: '/scan/review' as Href,
  scanDetail: '/scan/detail' as Href,
  listingDetail: (batchPk: number) => `/listing/${batchPk}` as Href,
  scanSuccess: (batchPk: number, batchNumber: number, itemCount?: number) =>
    ({
      pathname: '/scan/success',
      params: {
        batchPk: String(batchPk),
        batchNumber: String(batchNumber),
        itemCount: itemCount != null ? String(itemCount) : undefined,
      },
    }) as unknown as Href,
};
