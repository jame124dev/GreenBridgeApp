import { useMutation } from '@tanstack/react-query';

import { smartDetect, smartDetectFromUrls } from '@/services/scanner/smartDetect';
import { smartDetectStream } from '@/services/scanner/smartDetectStream';
import {
  type GcsDocumentInput,
  type GcsUploadedFile,
  uploadGcsDocuments,
  uploadGcsPhotos,
} from '@/services/scanner/uploadGcsPhotos';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';
import { smartDetectV2Enabled } from '@/features/scanner/smartDetectV2Enabled';
import type { SmartStreamEvent } from '@/features/scanner/smartDetectStreamTypes';
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
      documents,
      language,
      signal,
      onEvent,
    }: {
      photos: Photo[];
      /**
       * PDFs / Word / Excel / any non-image attachments picked via the
       * file picker. Uploaded to the same `/gcs/upload` endpoint as
       * photos; backend extracts up to 3 images per PDF and includes
       * them in the smart-detect image stream. Returned product
       * `documentIndexes` reference this array.
       */
      documents?: GcsDocumentInput[];
      language: string;
      signal?: AbortSignal;
      /**
       * v2 SSE progress sink. Receives stage/detection/product/pdf_pages/
       * (non-fatal) error events as they stream in, so the processing screen
       * can render real progress. Ignored on the v1 path (no streaming).
       */
      onEvent?: (e: SmartStreamEvent) => void;
    }) => {
      const sellerId = useAuth.getState().profile?.id;
      if (!sellerId) {
        // No auth context → can't upload to GCS. Stay on the legacy multipart
        // path. That path only supports images; document analysis is a
        // signed-in feature.
        if (documents && documents.length > 0) {
          throw new Error('Sign in required to analyze documents');
        }
        return smartDetect(photos, language, signal);
      }

      // Upload photos when we have any. Skipped entirely on a docs-only
      // scan so the seller can run AI on a PDF without a paired photo.
      let sessionId: string | undefined;
      let imageFiles: GcsUploadedFile[] = [];
      if (photos.length > 0) {
        const r = await uploadGcsPhotos(photos, { sellerId, signal });
        sessionId = r.sessionId;
        imageFiles = r.files;
      }

      // Upload documents in a sibling `/gcs/upload` call. Reuses the
      // image-upload session id so both land in the same GCS prefix.
      let documentFiles: GcsUploadedFile[] = [];
      if (documents && documents.length > 0) {
        const r = await uploadGcsDocuments(documents, {
          sellerId,
          sessionId,
          signal,
        });
        sessionId = sessionId ?? r.sessionId;
        documentFiles = r.files;
      }

      // Persist photo uri→objectName so submit (useCreateListing) can use
      // `gcs_image_paths[]` later without re-sending bytes. Docs aren't
      // mirrored into the gcs map yet — submit-time still attaches them
      // via multipart in buildProductFormData. (Web does the same.)
      if (sessionId && imageFiles.length > 0) {
        const entries: Record<string, string> = {};
        for (let i = 0; i < photos.length; i++) {
          const file = imageFiles[i];
          if (file) entries[photos[i].uri] = file.objectName;
        }
        if (Object.keys(entries).length > 0) {
          useScanDraft.getState().mergeGcs(sessionId, entries);
        }
      }

      const imageUrls = imageFiles.map((f) => gcsUrlForAnalyze(f));
      const documentUrls = documentFiles.length
        ? documentFiles.map((f) => gcsUrlForAnalyze(f))
        : undefined;
      // Pass sellerId — backend uses it to scope GCS object-name lookups
      // when document_urls are present. The web client sends it; without
      // it the docs-only path returns "could not read the photos".
      //
      // v2: same body + same final mapped result as v1, but streamed over SSE
      // so the screen can show real progress. Flag-gated (default off), native
      // only; web + flag-off fall back to the v1 blocking POST. The mutation's
      // return type is identical either way, so onSuccess is unchanged.
      return smartDetectV2Enabled()
        ? smartDetectStream(imageUrls, language, signal, documentUrls, sellerId, onEvent)
        : smartDetectFromUrls(imageUrls, language, signal, documentUrls, sellerId);
    },
  });
}
