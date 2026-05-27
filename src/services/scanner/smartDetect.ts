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
