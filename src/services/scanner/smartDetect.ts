import { greenbidz } from '@/api/greenbidzClient';
import { toAnalyzeLanguage } from '@/features/scanner/constants';
import { mapSmartDetection } from '@/features/scanner/mapSmartDetection';
import type {
  MappedSmartDetection,
  SmartDetectionResponse,
} from '@/features/scanner/smartDetectionTypes';
import type { Photo } from '@/stores/scanDraftStore';

import { buildSmartDetectionFormData, getSiteType } from './buildFormData';

/**
 * POST /wp/analyze-smart-detection — sends images, returns the AI's single-vs-
 * multiple verdict already mapped into client field bundles. The mapped result
 * carries `products[i].imageIndexes` (into the `photos` array passed in here)
 * so the caller can slice the local photos per detected product.
 *
 * Higher latency than analyze-process-images (N+1 sequential model calls) — the
 * 120s timeout matches the server cap.
 */
export async function smartDetect(
  photos: Photo[],
  language: string,
  signal?: AbortSignal,
): Promise<MappedSmartDetection> {
  if (!photos.length) {
    throw new Error('At least one photo is required for smart detection');
  }
  const lang = toAnalyzeLanguage(language);
  const formData = await buildSmartDetectionFormData(photos, lang);
  // Tell the backend which marketplace this is for, so it injects that
  // platform's category list into the AI prompt and returns a matched
  // `product_cat.id`. Without this the AI gets no list → product_cat = {id:""}
  // → the review hub shows "category missing". (wordPressSmart.js:677-680)
  formData.append('site_type', getSiteType());

  const res = await greenbidz.post<SmartDetectionResponse>(
    '/wp/analyze-smart-detection',
    formData,
    {
      timeout: 120_000,
      signal,
      // Same multipart safeguards as analyzeImages: pass FormData through
      // untouched + let RN fill the boundary header.
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    },
  );

  if (!res.data?.success) {
    throw new Error(
      (res.data as { message?: string })?.message ?? 'Smart detection failed',
    );
  }

  return mapSmartDetection(res.data, getSiteType());
}

/**
 * URL-mode variant of smart detection — bytes never touch this endpoint.
 * `image_urls` are fetched server-side by the vision API (must be publicly
 * resolvable; mobile builds them via `gcsUrlForAnalyze`).
 *
 * Same response shape as `smartDetect`, including `products[i].imageIndexes`
 * which index into `imageUrls` in the order passed.
 *
 * See Docs/GCS_UPLOAD_INTEGRATION_PLAN.md (W2).
 */
export async function smartDetectFromUrls(
  imageUrls: string[],
  language: string,
  signal?: AbortSignal,
): Promise<MappedSmartDetection> {
  if (!imageUrls.length) {
    throw new Error('At least one image URL is required for smart detection');
  }
  const lang = toAnalyzeLanguage(language);

  const res = await greenbidz.post<SmartDetectionResponse>(
    '/wp/analyze-smart-detection',
    // `site_type` lets the backend inject the marketplace's category list into
    // the AI prompt so it returns a matched `product_cat.id` (else category
    // comes back empty → "category missing"). See wordPressSmart.js:677-680.
    { image_urls: imageUrls, language: lang, site_type: getSiteType() },
    {
      timeout: 120_000,
      signal,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (!res.data?.success) {
    throw new Error(
      (res.data as { message?: string })?.message ?? 'Smart detection failed',
    );
  }

  return mapSmartDetection(res.data, getSiteType());
}
