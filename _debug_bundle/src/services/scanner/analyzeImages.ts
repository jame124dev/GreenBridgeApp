import { greenbidz } from '@/api/greenbidzClient';
import { toAnalyzeLanguage } from '@/features/scanner/constants';
import { mapAnalyzeResponse } from '@/features/scanner/mapAnalyze';
import type { AiResult, Photo } from '@/stores/scanDraftStore';

import { buildAnalyzeFormData } from './buildFormData';

export async function analyzeImages(
  photos: Photo[],
  language: string,
  signal?: AbortSignal,
): Promise<AiResult> {
  const lang = toAnalyzeLanguage(language);
  const formData = await buildAnalyzeFormData(photos, lang);
  // Two safeguards for multipart on React Native (new architecture):
  //   1. transformRequest pass-through — stops axios from JSON-stringifying FormData
  //   2. explicit Content-Type — lets RN's networking layer fill in the boundary
  //      (Without this, axios sometimes sets application/x-www-form-urlencoded
  //       or omits the header, and the server rejects the upload as malformed.)
  const res = await greenbidz.post('/wp/analyze-process-images', formData, {
    timeout: 120_000,
    signal,
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });
  if (!res.data?.success) {
    throw new Error(res.data?.message ?? 'AI analysis failed');
  }
  return mapAnalyzeResponse(res.data.data);
}
