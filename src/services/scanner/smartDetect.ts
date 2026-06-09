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
 * `documentUrls` (optional) — PDF / Word / Excel files the seller picked
 * via the file picker. Backend extracts up to 3 images per PDF, runs the
 * AI on those, and includes them in the response's image stream so
 * detected products can reference them via `document_indexes`. Mirrors
 * the GreenBridgeSeller web client's URL-mode call signature.
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
  documentUrls?: string[],
  sellerId?: number | string,
): Promise<MappedSmartDetection> {
  if (!imageUrls.length && !(documentUrls?.length)) {
    throw new Error(
      'At least one image URL or document URL is required for smart detection',
    );
  }
  const lang = toAnalyzeLanguage(language);

  // Body matches the GreenBridgeSeller web client's working call shape:
  //   { image_urls, document_urls, language, sellerId }
  // `image_urls` is ALWAYS sent (empty array on a docs-only scan) — the
  // backend returns "could not read the photos" when the field is absent,
  // even though docs are present. `sellerId` is required when documents
  // are involved (GCS object-name lookup is scoped per-seller).
  // `site_type` is left out of the body — the axios client already sends
  // it as the `x-platform` header (greenbidzClient.ts:10) which is what
  // the backend reads.
  const body: Record<string, unknown> = {
    image_urls: imageUrls,
    language: lang,
  };
  if (documentUrls?.length) body.document_urls = documentUrls;
  if (sellerId != null) body.sellerId = String(sellerId);

  let res;
  try {
    res = await greenbidz.post<SmartDetectionResponse>(
      '/wp/analyze-smart-detection',
      body,
      {
        timeout: 120_000,
        signal,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err: unknown) {
    // Release builds strip console.* — bake the request + response shape into
    // the rethrown error so the on-screen banner shows what the backend
    // actually rejected. The default axios message ("Request failed with
    // status code 400") tells us nothing about *why*.
    const axiosErr = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    const status = axiosErr.response?.status;
    const data = axiosErr.response?.data;
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const reqStr = JSON.stringify({
      image_urls: imageUrls.length,
      first_image: imageUrls[0]?.slice(0, 120),
      document_urls: documentUrls?.length ?? 0,
      first_doc: documentUrls?.[0]?.slice(0, 120),
      sellerId: sellerId != null ? String(sellerId) : null,
      lang,
    });
    throw new Error(
      `smartDetect ${status ?? '?'} — req:${reqStr} resp:${dataStr?.slice(0, 400) ?? axiosErr.message}`,
    );
  }

  if (!res.data?.success) {
    throw new Error(
      (res.data as { message?: string })?.message ?? 'Smart detection failed',
    );
  }

  return mapSmartDetection(res.data, getSiteType());
}
