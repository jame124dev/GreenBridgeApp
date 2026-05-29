import { useMutation } from '@tanstack/react-query';

import { smartDetect, smartDetectFromUrls } from '@/services/scanner/smartDetect';
import { uploadGcsPhotos } from '@/services/scanner/uploadGcsPhotos';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';
import { useAuth } from '@/stores/authStore';
import { useScanDraft, type Photo } from '@/stores/scanDraftStore';

/**
 * Smart-detect with one byte upload per scan session (plan W3).
 *
 * Pipeline (single `isPending`):
 *   1. `uploadGcsPhotos` — push the capture's photos to `/gcs/upload` once.
 *   2. Merge the returned `{ uri → objectName }` entries into the draft store
 *      (`mergeGcs`) so the later product-create submit can use
 *      `gcs_image_paths[]` instead of re-sending bytes.
 *   3. `smartDetectFromUrls` — call `/wp/analyze-smart-detection` with the
 *      `image_urls` JSON mode. Vision API fetches each URL through the
 *      `/gcs/serve` proxy.
 *
 * Falls back to the legacy multipart `smartDetect` when there's no seller
 * profile (shouldn't happen on a guarded screen, but defensive — keeps the
 * mutation unconditionally async).
 *
 * Same external surface as before (`{ photos, language, signal? }` → mapped
 * detection) so call sites in `processing.tsx` don't change.
 */
export function useSmartDetect() {
  return useMutation({
    mutationFn: async ({
      photos,
      language,
      signal,
    }: {
      photos: Photo[];
      language: string;
      signal?: AbortSignal;
    }) => {
      const sellerId = useAuth.getState().profile?.id;
      if (!sellerId) {
        // No auth context → can't upload to GCS. Stay on the legacy path so
        // we don't break anonymous-ish dev flows.
        return smartDetect(photos, language, signal);
      }

      const { sessionId, files } = await uploadGcsPhotos(photos, {
        sellerId,
        signal,
      });

      // Persist uri→objectName so submit (useCreateListing) can use
      // `gcs_image_paths[]` later without re-uploading bytes.
      const entries: Record<string, string> = {};
      for (let i = 0; i < photos.length; i++) {
        const file = files[i];
        if (file) entries[photos[i].uri] = file.objectName;
      }
      if (Object.keys(entries).length > 0) {
        useScanDraft.getState().mergeGcs(sessionId, entries);
      }

      const imageUrls = files.map((f) => gcsUrlForAnalyze(f));
      return smartDetectFromUrls(imageUrls, language, signal);
    },
  });
}
