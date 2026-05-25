import { greenbidz } from '@/api/greenbidzClient';
import { toAnalyzeLanguage } from '@/features/scanner/constants';
import type { DraftItem, Photo } from '@/stores/scanDraftStore';

import { buildProductFormData } from './buildFormData';

export async function createProduct(
  item: DraftItem,
  photos: Photo[],
  opts: { sellerId: number; sellerName: string; siteType: string; language: string },
): Promise<number> {
  const lang = toAnalyzeLanguage(opts.language);
  const formData = buildProductFormData(item, photos, opts);

  const res = await greenbidz.post(
    `/wp/create-product-direct?lang=${lang}&type=${encodeURIComponent(opts.siteType)}`,
    formData,
    { timeout: 120_000 },
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
