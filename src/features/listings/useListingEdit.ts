/**
 * React Query hooks for the seller listing editor. Follows the existing hook
 * shape in `features/scanner/*` (query-key factory beside the hook, `enabled`
 * guard on a missing id, invalidate the seller's lists on success).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { batchDetailQueryKey } from '@/features/scanner/queryKeys';
import { getSiteType } from '@/services/scanner/buildFormData';

import { fetchListingForEdit, patchSellerListing } from './listingEditApi';
import type {
  ListingEditPatchBody,
  ListingEditPatchResult,
  ListingEditResource,
} from './listingEditTypes';

export const listingEditQueryKey = (productId?: number) =>
  ['listings', 'sellerEdit', productId] as const;

export function useListingEdit(productId: number | undefined) {
  return useQuery<ListingEditResource>({
    queryKey: listingEditQueryKey(productId),
    queryFn: () => fetchListingForEdit(productId!),
    enabled: !!productId && productId > 0,
    // An edit form must never open on a cached snapshot of someone's listing —
    // a pending edit or a sale could have landed since it was last fetched.
    staleTime: 0,
    retry: false,
  });
}

export function useSaveListingEdit(productId: number | undefined, batchPk?: number) {
  const qc = useQueryClient();
  return useMutation<ListingEditPatchResult, unknown, ListingEditPatchBody>({
    mutationFn: (body) => patchSellerListing(productId!, body),
    onSuccess: () => {
      // The edit resource itself now carries a pending_edit / new values.
      void qc.invalidateQueries({ queryKey: listingEditQueryKey(productId) });
      // Anything that renders the seller's listings can be stale after an
      // instant-applied change (title, price and photos show in these lists).
      void qc.invalidateQueries({ queryKey: ['scanner', 'recentSubmissions'] });
      if (batchPk) {
        void qc.invalidateQueries({ queryKey: batchDetailQueryKey(batchPk, getSiteType()) });
      }
    },
  });
}
