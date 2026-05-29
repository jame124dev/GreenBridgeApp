import { greenbidz } from '@/api/greenbidzClient';
import { marketplaceToPlatform, toAnalyzeLanguage } from '@/features/scanner/constants';
import type { DraftItem, Photo } from '@/stores/scanDraftStore';

import { buildProductFormData, type ProductGcsRefs } from './buildFormData';

export async function createProduct(
  item: DraftItem,
  photos: Photo[],
  opts: { sellerId: number; sellerName: string; siteType: string; language: string },
  /** When present, photos are referenced by GCS object name instead of inline
   *  multipart bytes — bypasses the Wordfence 9+ image 403. The session id
   *  comes from `/gcs/upload`. Object names must be in `photos[]` order so
   *  the backend's image-index assumptions hold. */
  gcs?: ProductGcsRefs,
): Promise<number> {
  const lang = toAnalyzeLanguage(opts.language);
  const formData = await buildProductFormData(item, photos, opts, gcs);

  // W3 (scan_v3): `?type=` now derives from `item.marketplace` not the env
  // siteType — sellers whose multi-marketplace build (101LAB / 101MACHINE /
  // 101IT / 101RECYCLE) lets them choose a different marketplace per item
  // get routed to the right backend site. Falls back to env when the
  // marketplace doesn't map (defensive — all 4 known values map cleanly).
  const platform = marketplaceToPlatform(item.marketplace) ?? opts.siteType;

  // Multipart safeguards — see analyzeImages.ts for why these are needed.
  const res = await greenbidz.post(
    `/wp/create-product-direct?lang=${lang}&type=${encodeURIComponent(platform)}`,
    formData,
    {
      timeout: 120_000,
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    },
  );

  if (!res.data?.success) {
    throw new Error(res.data?.message ?? 'Failed to create product');
  }

  const productId = res.data?.data?.product_id;
  if (!productId) {
    throw new Error('Product created but no product_id returned');
  }

  return Number(productId);
}
