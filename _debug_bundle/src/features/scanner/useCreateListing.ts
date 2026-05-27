import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createBatch } from '@/services/scanner/createBatch';
import { createProduct } from '@/services/scanner/createProduct';
import { getSiteType } from '@/services/scanner/buildFormData';
import type { DraftItem } from '@/stores/scanDraftStore';
import { useScanDraft } from '@/stores/scanDraftStore';
import { useAuth } from '@/stores/authStore';
import { invalidateRecentSubmissions } from '@/features/scanner/invalidateRecentSubmissions';

export function useCreateListing() {
  const { i18n } = useTranslation();
  const profile = useAuth((s) => s.profile);
  const addProductId = useScanDraft((s) => s.addProductId);

  return useMutation({
    mutationFn: async (draft: DraftItem) => {
      if (!profile) throw new Error('You must be signed in to list equipment');

      const siteType = getSiteType();
      const sellerId = profile.id;
      const sellerName = profile.name;

      let productId = draft.productId;

      if (!productId) {
        productId = await createProduct(draft, draft.photos, {
          sellerId,
          sellerName,
          siteType,
          language: i18n.language,
        });
        addProductId(productId);
      }

      const productIds = draft.productIds.length ? draft.productIds : [productId];
      const country = draft.location?.country ?? '';

      const { batchPk, batchNumber } = await createBatch({
        productIds,
        sellerId,
        siteType,
        country,
        visibility: draft.visibility,
        networkSellers: draft.networkSellers,
      });

      return { batchPk, batchNumber, productId };
    },
    onSuccess: (_data, _draft, _ctx) => {
      void invalidateRecentSubmissions(profile?.id);
    },
  });
}
