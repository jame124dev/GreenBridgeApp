import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { DraftItem, Photo } from '@/stores/scanDraftStore';

const IS_WEB = Platform.OS === 'web';

async function appendFile(
  fd: FormData,
  field: string,
  photo: Photo,
  index: number,
) {
  if (IS_WEB) {
    // Browser FormData needs a real Blob/File, not the { uri, name, type } shape RN uses.
    // expo-camera gives us blob:/ URIs that we can fetch back into a real Blob.
    const blob = await fetch(photo.uri).then((r) => r.blob());
    fd.append(field, blob, `photo-${index}.jpg`);
    return;
  }
  fd.append(field, {
    uri: photo.uri,
    name: `photo-${index}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);
}

async function appendDocument(
  fd: FormData,
  field: string,
  doc: { uri: string; name: string; mimeType: string },
  index: number,
) {
  const name = doc.name || `doc-${index}`;
  if (IS_WEB) {
    const blob = await fetch(doc.uri).then((r) => r.blob());
    fd.append(field, blob, name);
    return;
  }
  fd.append(field, {
    uri: doc.uri,
    name,
    type: doc.mimeType || 'application/octet-stream',
  } as unknown as Blob);
}

export async function buildAnalyzeFormData(photos: Photo[], language: 'en' | 'zh-hant') {
  const fd = new FormData();
  for (let i = 0; i < photos.length; i++) {
    await appendFile(fd, 'images', photos[i], i);
  }
  fd.append('language', language);
  return fd;
}

// Smart-detection endpoint expects the multipart field **`files`** (not
// `images`), images-only (videos/PDFs are ignored server-side and waste the
// 20-file budget). Index order is preserved so `image_indexes` in the response
// line up 1:1 with this Photo[].
export async function buildSmartDetectionFormData(
  photos: Photo[],
  language: 'en' | 'zh-hant',
) {
  const fd = new FormData();
  for (let i = 0; i < photos.length; i++) {
    await appendFile(fd, 'files', photos[i], i);
  }
  fd.append('language', language);
  return fd;
}

export async function buildProductFormData(
  item: DraftItem,
  photos: Photo[],
  opts: { sellerId: number; sellerName: string; siteType: string },
) {
  const fd = new FormData();

  for (let i = 0; i < photos.length; i++) {
    await appendFile(fd, 'images', photos[i], i);
  }

  for (let i = 0; i < item.documents.length; i++) {
    await appendDocument(fd, 'documents', item.documents[i], i);
  }

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
