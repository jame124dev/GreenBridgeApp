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
   * lives on `batchIds` and the richer per-item rows on `items`.
   */
  batchPk: number;
  batchNumber: number;
  /**
   * One row per submitted product. Used by the multi-product success screen
   * to render a tappable list instead of just the first batch. `title` is
   * taken from the draft we passed in (the backend echoes it but a draft
   * with an empty AI title would otherwise show up blank on the success row).
   */
  items: { title: string; batchPk: number; batchNumber?: number }[];
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

      // Pair each draft with the batch the backend created for it. The
      // backend's `products` array carries `{ index, product_id, batch_id,
      // batch_number, title }`; we trust `items[index].title` over
      // `products[i].title` because the draft is the seller's source of truth
      // (the backend title can be empty when AI failed to extract one).
      const perItem = result.products.map((p) => ({
        title: items[p.index]?.title?.trim() || p.title || `Product ${p.index + 1}`,
        batchPk: p.batch_id,
        batchNumber: p.batch_number,
      }));

      return {
        groupId: result.groupId,
        batchIds: result.batchIds,
        productIds: result.productIds,
        itemCount: items.length,
        batchPk: firstBatch,
        batchNumber: Number(firstBatchNumber),
        items: perItem,
      };
    },
    onSuccess: () => {
      void invalidateRecentSubmissions(profile?.id);
    },
  });
}
