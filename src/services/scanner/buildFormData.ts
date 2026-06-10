import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { appendSpecsToDescription } from '@/features/scanner/appendSpecsToDescription';
import {
  OTHER_SUBCATEGORY_ID,
  operationStatusForInstallation,
} from '@/features/scanner/constants';
import type { DraftItem, MarketplaceKey, Photo } from '@/stores/scanDraftStore';

/**
 * Web parity — mirrors `marketplaceToAllowedSite` in
 * `GreenBridgeSeller/src/pages/new-submission-upload/utils/buildProductFormData.ts:13-19`.
 * Some marketplaces use short slugs in `allowed_sites[]` even when the env
 * site_type uses a longer name. Exported so the grouped-submit pipeline
 * (`submitGroupedListings.ts`) can derive the same value per product.
 */
export function marketplaceToAllowedSite(marketplace: MarketplaceKey): string {
  if (marketplace === '101machine') return 'machines';
  if (marketplace === '101recycle') return 'recycle';
  if (marketplace === '101it') return '101it';
  return 'LabGreenbidz';
}

const IS_WEB = Platform.OS === 'web';

/**
 * Resolve the category the product actually files under. For a normal pick this
 * is just the chosen leaf (`categoryId`/`categoryName`). When the seller picked
 * "Other (type brand)" (`categoryId === OTHER_SUBCATEGORY_ID`), the product
 * files under the chosen PARENT category instead — web parity. Either id/name
 * may be empty; callers guard before appending.
 */
export function getSubmittedCategory(item: DraftItem): { id: string; name: string } {
  if (item.categoryId === OTHER_SUBCATEGORY_ID) {
    return { id: item.parentCategoryId ?? '', name: item.parentCategoryName ?? '' };
  }
  return { id: item.categoryId ?? '', name: item.categoryName ?? '' };
}

/**
 * The brand the seller typed for "Other" — sent as `suggested_subcategory`.
 * Empty string for a normal subcategory pick (caller omits the field then).
 */
export function getSuggestedSubcategory(item: DraftItem): string {
  return item.categoryId === OTHER_SUBCATEGORY_ID
    ? (item.customSubcategory ?? '').trim()
    : '';
}

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

export type ProductGcsRefs = {
  /** Session id returned by /gcs/upload — round-tripped to create-product-direct. */
  sessionId: string;
  /** Permanent GCS object paths in `photos[]` order. */
  objectNames: string[];
};

export async function buildProductFormData(
  item: DraftItem,
  photos: Photo[],
  opts: { sellerId: number; sellerName: string; siteType: string },
  gcs?: ProductGcsRefs,
) {
  const fd = new FormData();

  if (gcs) {
    // GCS path: photos were pushed to /gcs/upload already; backend reads
    // bytes from cloud storage when these refs are present. Bypasses
    // Wordfence's 9+ image 403 — see Docs/GCS_UPLOAD_INTEGRATION_PLAN.md.
    for (const objectName of gcs.objectNames) {
      fd.append('gcs_image_paths[]', objectName);
    }
    fd.append('gcs_session_id', gcs.sessionId);
  } else {
    // Legacy path — inline image bytes. Still works server-side; used
    // when no GCS upload happened (e.g. older drafts, fallback paths).
    for (let i = 0; i < photos.length; i++) {
      await appendFile(fd, 'images', photos[i], i);
    }
  }

  // Documents stay inline regardless — Wordfence 403 only hits image counts.
  for (let i = 0; i < item.documents.length; i++) {
    await appendDocument(fd, 'documents', item.documents[i], i);
  }

  fd.append('product_title', item.title);
  // S1: fold brand/model/year/weight/dimensions/CO2 into the description
  // body (web parity — see buildProductFormData.ts on web). Backend treats
  // product_content as opaque text.
  fd.append('product_content', appendSpecsToDescription(item));
  fd.append('product_type', 'simple');
  // Category resolution accounts for "Other (type brand)": files under the
  // parent + sends the typed brand as `suggested_subcategory` (web parity).
  const submittedCategory = getSubmittedCategory(item);
  if (submittedCategory.id) {
    fd.append('product_category_ids', submittedCategory.id);
  }
  if (submittedCategory.name) {
    fd.append('category_name', submittedCategory.name);
  }
  const suggestedSubcategory = getSuggestedSubcategory(item);
  if (suggestedSubcategory) {
    fd.append('suggested_subcategory', suggestedSubcategory);
  }

  fd.append('seller_name', opts.sellerName);
  fd.append('post_author_id', String(opts.sellerId));
  fd.append('steps', '1');
  fd.append('quantity', String(item.quantity));
  fd.append('sellerVisible', String(item.sellerVisible));

  item.condition.forEach((c) => fd.append('item_condition[]', c));

  // S5.1: installation IS the canonical operation status. Web parity —
  // ReviewSubmitScreen.tsx:149 overrides `operation_status[]` at submit time
  // based on the user's installation choice. "installed" → ["needDeinstall"]
  // (buyer needs to deinstall before shipping); "deinstalled" → ["deinstalled"]
  // (ready-to-ship). The AI-extracted `item.operationStatus` is ignored at
  // submit; the picker in LocationCard is the single source of truth.
  operationStatusForInstallation(item.installation).forEach((s) =>
    fd.append('operation_status[]', s),
  );

  // S5.2: multi-location. Send one `location[]` entry per array row;
  // backend takes a single `country` form key (web parity — uses the first
  // entry from `locationCountries[]`). Empty rows are pre-filtered by the
  // schema's superRefine so this loop never emits a blank `location[]`.
  item.locations.forEach((addr) => {
    if (addr.trim().length > 0) fd.append('location[]', addr.trim());
  });
  if (item.locationCountries[0]) {
    fd.append('country', item.locationCountries[0]);
  }

  const enableBuyNow = item.priceFormat === 'buyNow';
  fd.append('price_now_enabled', enableBuyNow ? '1' : '0');
  fd.append('price_format', item.priceFormat);
  fd.append('price_currency', item.priceCurrency);
  fd.append('price_per_unit', enableBuyNow ? item.pricePerUnit : '');

  fd.append('replacement_cost_per_unit', '');
  // S1: previously hard-coded to ''. Backend takes float and stores as meta.
  fd.append('weight_per_unit', item.weight || '');

  // S1: item_grade lands in backend `grade` meta (controller/wordPressV2.js:339).
  fd.append('item_grade', item.grade);

  // S1: serial_number is silently dropped by backend today (not in the
  // destructured field list in wordPressV2.js) but web sends it too — keep
  // parity so when the backend adds the slot, mobile records are populated.
  const serial = item.serialNumber?.trim();
  if (serial) fd.append('serial_number', serial);

  // S5.1: marketplace picker is the single source of truth for `allowed_sites[]`,
  // matching web's `buildProductFormData.ts` (which only reads `form.marketplace`).
  // Falls back to env siteType only when marketplaceToAllowedSite returns empty,
  // which shouldn't happen for the 4 known marketplace values.
  const allowedSite = marketplaceToAllowedSite(item.marketplace) || opts.siteType;
  fd.append('allowed_sites[]', allowedSite);

  return fd;
}

/**
 * W1 (scan_v3) — plain-object equivalent of the per-product field set used by
 * `buildProductFormData`. Returned as a JSON-serializable Record so the
 * grouped-submit endpoint can carry N products in a single `products_json`
 * payload (mirrors web's `productMetaFromForm` in
 * `GreenBridgeSeller/.../utils/buildProductFormData.ts:88-133`). Single-listing
 * submit keeps using the FormData builder above (the backend route for that
 * path expects individual form keys, not a JSON blob).
 *
 * Files/documents are NOT included here — the grouped pipeline appends them
 * to FormData as `images_${i}` / `documents_${i}` separately.
 */
export function productMetaFromItem(
  item: DraftItem,
  opts: { sellerId: number; sellerName: string },
): Record<string, string | string[]> {
  const enableBuyNow = item.priceFormat === 'buyNow';
  const meta: Record<string, string | string[]> = {
    product_title: item.title,
    product_content: appendSpecsToDescription(item),
    product_type: 'simple',
    seller_name: opts.sellerName,
    post_author_id: String(opts.sellerId),
    steps: '1',
    quantity: String(item.quantity),
    sellerVisible: String(item.sellerVisible),
    price_now_enabled: enableBuyNow ? '1' : '0',
    price_format: item.priceFormat,
    price_currency: item.priceCurrency,
    price_per_unit: enableBuyNow ? item.pricePerUnit : '',
    replacement_cost_per_unit: '',
    weight_per_unit: item.weight || '',
    item_grade: item.grade,
    item_condition: item.condition,
    operation_status: operationStatusForInstallation(item.installation),
    allowed_sites: [marketplaceToAllowedSite(item.marketplace)],
  };

  // Same "Other (type brand)" resolution as buildProductFormData — this is the
  // grouped-submit path, so it must produce the identical category fields.
  const submittedCategory = getSubmittedCategory(item);
  if (submittedCategory.id) meta.product_category_ids = submittedCategory.id;
  if (submittedCategory.name) meta.category_name = submittedCategory.name;
  const suggestedSubcategory = getSuggestedSubcategory(item);
  if (suggestedSubcategory) meta.suggested_subcategory = suggestedSubcategory;

  const serial = item.serialNumber?.trim();
  if (serial) meta.serial_number = serial;

  const locations = item.locations
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (locations.length) meta.location = locations;

  if (item.locationCountries[0]) {
    meta.country = item.locationCountries[0];
  }

  return meta;
}

export function getSiteType(): string {
  const extra = Constants.expoConfig?.extra ?? {};
  return (extra.SITE_TYPE as string | undefined) ?? 'LabGreenbidz';
}
