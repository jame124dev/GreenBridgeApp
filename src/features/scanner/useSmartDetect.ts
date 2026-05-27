import { useMutation } from '@tanstack/react-query';

import { smartDetect } from '@/services/scanner/smartDetect';
import type { Photo } from '@/stores/scanDraftStore';

export function useSmartDetect() {
  return useMutation({
    mutationFn: ({
      photos,
      language,
      signal,
    }: {
      photos: Photo[];
      language: string;
      signal?: AbortSignal;
    }) => smartDetect(photos, language, signal),
  });
}
