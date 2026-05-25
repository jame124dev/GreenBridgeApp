import { useMutation } from '@tanstack/react-query';

import { analyzeImages } from '@/services/scanner/analyzeImages';
import type { Photo } from '@/stores/scanDraftStore';

export function useAnalyzeImages() {
  return useMutation({
    mutationFn: ({
      photos,
      language,
      signal,
    }: {
      photos: Photo[];
      language: string;
      signal?: AbortSignal;
    }) => analyzeImages(photos, language, signal),
  });
}
