import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { submitGroupedListings } from '@/services/scanner/submitGroupedListings';
import type { DraftItem } from '@/stores/scanDraftStore';
import { useAuth } from '@/stores/authStore';
import { invalidateRecentSubmissions } from '@/features/scanner/invalidateRecentSubmissions';
import type { BatchVisibility } from '@/types/batch';

type SubmitGroupedInput = {
  items: DraftItem[];
  visibility: BatchVisibility;
  /**
   * Carried for shape parity with the legacy per-product+batch pipeline.
   * The new `/wp/create-grouped-listings` endpoint does not currently expose
   * a `network_sellers` field; sellers who need NETWORK visibility on a
   * grouped submit set it via the visibility param, not a member list. If
   * the backend later accepts per-batch network sellers, thread this in.
   */
  networkSellers: number[];
};

type SubmitGroupedResult = {
  groupId: number;
  batchIds: number[];
  productIds: number[];
  itemCount: number;
  /**
   * Surfaced for compatibility with the success screen, which historically
   * received a single batchPk + batchNumber. We surface the FIRST batch as
   * the canonical "open this from the success screen" target. The full list
   * lives on `batchIds`.
   */
  batchPk: number;
  batchNumber: number;
};

/**
 * W1 (scan_v3) — rewritten to POST a single multipart to
 * `/wp/create-grouped-listings`, replacing the previous per-product loop
 * (`createProduct` × N + `createBatch`). The atomic endpoint creates the
 * auction_group row that the legacy pipeline silently skipped, so mobile
 * grouped listings now show up on the buyer-side group page.
 */
export function useSubmitGroupedListing() {
  const { i18n } = useTranslation();
  const profile = useAuth((s) => s.profile);

  return useMutation({
    mutationFn: async ({
      items,
      visibility,
    }: SubmitGroupedInput): Promise<SubmitGroupedResult> => {
      if (!profile) throw new Error('You must be signed in to list equipment');
      if (items.length === 0) throw new Error('Add at least one item to submit');

      const result = await submitGroupedListings({
        items,
        sellerId: profile.id,
        sellerName: profile.name,
        language: i18n.language,
        visibility,
      });

      const firstBatch = result.batchIds[0];
      const firstBatchNumber = result.products[0]?.batch_number ?? firstBatch;

      return {
        groupId: result.groupId,
        batchIds: result.batchIds,
        productIds: result.productIds,
        itemCount: items.length,
        batchPk: firstBatch,
        batchNumber: Number(firstBatchNumber),
      };
    },
    onSuccess: () => {
      void invalidateRecentSubmissions(profile?.id);
    },
  });
}
