import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createBatch } from '@/services/scanner/createBatch';
import { createProduct } from '@/services/scanner/createProduct';
import { getSiteType } from '@/services/scanner/buildFormData';
import type { DraftItem } from '@/stores/scanDraftStore';
import { useScanDraft } from '@/stores/scanDraftStore';
import { useAuth } from '@/stores/authStore';
import { invalidateRecentSubmissions } from '@/features/scanner/invalidateRecentSubmissions';
import type { BatchVisibility } from '@/types/batch';

type SubmitGroupedInput = {
  items: DraftItem[];
  visibility: BatchVisibility;
  networkSellers: number[];
};

export function useSubmitGroupedListing() {
  const { i18n } = useTranslation();
  const profile = useAuth((s) => s.profile);

  return useMutation({
    mutationFn: async ({ items, visibility, networkSellers }: SubmitGroupedInput) => {
      if (!profile) throw new Error('You must be signed in to list equipment');
      if (items.length === 0) throw new Error('Add at least one item to submit');

      const siteType = getSiteType();
      const sellerId = profile.id;
      const sellerName = profile.name;
      const language = i18n.language;

      const { setQueuedItemProductId } = useScanDraft.getState();
      const productIds: number[] = [];

      for (const item of items) {
        const latest = useScanDraft.getState().queuedItems.find((i) => i.id === item.id) ?? item;
        let productId = latest.productId;
        if (!productId) {
          productId = await createProduct(latest, latest.photos, {
            sellerId,
            sellerName,
            siteType,
            language,
          });
          setQueuedItemProductId(item.id, productId);
        }
        productIds.push(productId);
      }

      const country = items[0]?.location?.country ?? '';

      const { batchPk, batchNumber } = await createBatch({
        productIds,
        sellerId,
        siteType,
        country,
        visibility,
        networkSellers,
      });

      return { batchPk, batchNumber, itemCount: items.length, productIds };
    },
    onSuccess: () => {
      void invalidateRecentSubmissions(profile?.id);
    },
  });
}
