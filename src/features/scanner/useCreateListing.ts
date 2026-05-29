import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createBatch } from '@/services/scanner/createBatch';
import { createProduct } from '@/services/scanner/createProduct';
import { getSiteType } from '@/services/scanner/buildFormData';
import { getGcsRefsForItem } from '@/services/scanner/gcsUrl';
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
        // W4.c: when the session-level GCS map covers every photo in this
        // item, send `gcs_image_paths[]` instead of inline image bytes —
        // dodges the Wordfence 9+ photo 403. If any URI is missing (retake
        // after the GCS upload, or no upload at all), `getGcsRefsForItem`
        // returns null and we fall back to legacy multipart upload.
        const gcs = getGcsRefsForItem(draft.photos, useScanDraft.getState().gcs) ?? undefined;
        productId = await createProduct(draft, draft.photos, {
          sellerId,
          sellerName,
          siteType,
          language: i18n.language,
        }, gcs);
        addProductId(productId);
      }

      const productIds = draft.productIds.length ? draft.productIds : [productId];
      // S5.2: country flows from the first `locationCountries[]` entry — same
      // convention web uses (single backend country slot, first row wins).
      const country = draft.locationCountries[0] ?? '';

      const { batchPk, batchNumber } = await createBatch({
        productIds,
        sellerId,
        // W3 (scan_v3): `?type=` for the batch endpoint now follows the
        // marketplace chosen on the draft, matching the product endpoint.
        marketplace: draft.marketplace,
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
