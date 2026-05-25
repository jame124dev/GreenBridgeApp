import Constants from 'expo-constants';

import type { DraftItem, Photo } from '@/stores/scanDraftStore';

function appendFile(
  fd: FormData,
  field: string,
  photo: Photo,
  index: number,
) {
  fd.append(field, {
    uri: photo.uri,
    name: `photo-${index}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);
}

export function buildAnalyzeFormData(photos: Photo[], language: 'en' | 'zh-hant') {
  const fd = new FormData();
  photos.forEach((p, i) => appendFile(fd, 'images', p, i));
  fd.append('language', language);
  return fd;
}

export function buildProductFormData(
  item: DraftItem,
  photos: Photo[],
  opts: { sellerId: number; sellerName: string; siteType: string },
) {
  const fd = new FormData();

  photos.forEach((p, i) => appendFile(fd, 'images', p, i));

  item.documents.forEach((d, i) => {
    fd.append('documents', {
      uri: d.uri,
      name: d.name || `doc-${i}`,
      type: d.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  });

  fd.append('product_title', item.title);
  fd.append('product_content', item.description || '');
  fd.append('product_type', 'simple');
  if (item.categoryId) {
    fd.append('product_category_ids', item.categoryId);
  }
  if (item.categoryName) {
    fd.append('category_name', item.categoryName);
  }

  fd.append('seller_name', opts.sellerName);
  fd.append('post_author_id', String(opts.sellerId));
  fd.append('steps', '1');
  fd.append('quantity', String(item.quantity));
  fd.append('sellerVisible', String(item.sellerVisible));

  item.condition.forEach((c) => fd.append('item_condition[]', c));
  item.operationStatus.forEach((s) => fd.append('operation_status[]', s));

  if (item.location) {
    fd.append('location[]', item.location.address);
    fd.append('country', item.location.country);
  }

  const enableBuyNow = item.priceFormat === 'buyNow';
  fd.append('price_now_enabled', enableBuyNow ? '1' : '0');
  fd.append('price_format', item.priceFormat);
  fd.append('price_currency', item.priceCurrency);
  fd.append('price_per_unit', enableBuyNow ? item.pricePerUnit : '');

  fd.append('replacement_cost_per_unit', '');
  fd.append('weight_per_unit', '');

  const sites = item.allowedSites.length ? item.allowedSites : [opts.siteType];
  sites.forEach((site) => fd.append('allowed_sites[]', site));

  return fd;
}

export function getSiteType(): string {
  const extra = Constants.expoConfig?.extra ?? {};
  return (extra.SITE_TYPE as string | undefined) ?? 'LabGreenbidz';
}
