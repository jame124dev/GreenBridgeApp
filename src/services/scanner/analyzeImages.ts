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
  const formData = buildAnalyzeFormData(photos, lang);
  const res = await greenbidz.post('/wp/analyze-process-images', formData, {
    timeout: 120_000,
    signal,
  });
  if (!res.data?.success) {
    throw new Error(res.data?.message ?? 'AI analysis failed');
  }
  return mapAnalyzeResponse(res.data.data);
}
