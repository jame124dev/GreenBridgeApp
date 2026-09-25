/**
 * Start a scan run from staged photos and/or documents — ONE definition.
 *
 * Two screens now hand work to the detector: the viewfinder (`app/v2/scan/
 * camera.tsx`) and the intake screen (`app/v2/scan/intake.tsx`). Both have to
 * perform the same three steps in the same order, and the order is
 * load-bearing in a way that fails SILENTLY if it is got wrong — which is
 * exactly the kind of rule that must not be written twice.
 *
 * ⚠️ ORDER IS LOAD-BEARING. `patch()` EARLY-RETURNS when `current` is null
 * (`src/stores/scanDraftStore.ts`) — no throw, no log. A `patch({documents})`
 * written before `start()` is a silent no-op and the documents simply are not
 * in the draft the processing screen reads. `start()` is what creates
 * `current`, so the patch must follow it.
 *
 * ⚠️ WHERE IT HANDS OFF is deliberately still the SHIPPED processing screen,
 * not v2's `analyzing.tsx`. There are two detection mechanisms and they are not
 * interchangeable:
 *
 *   useSmartDetect    POST /wp/analyze-smart-detection-v2 (SSE). What
 *                     `app/scan/processing.tsx` runs. It is how every real scan
 *                     happens today.
 *   recognition-jobs  POST /recognition-jobs + GET /recognition-jobs/:id/stream.
 *                     What `analyzing.tsx` was built to WATCH — it takes a
 *                     `?job=<id>` and follows one. It cannot START a run, so
 *                     routing there with no job id lands on "No scan running".
 *
 * Moving the hand-off is a single change to this file once `analyzing.tsx` can
 * start its own run, instead of a change to every door. That is the point of
 * collecting it here.
 *
 * Known limit, measured on device 2026-09-22: a DOCUMENT-ONLY run whose
 * documents yield no page-images fails downstream with "No photos to apply
 * smart detection to" (`src/features/scanner/applySmartDetection.ts`). A PDF
 * renders to page-images and survives; a CSV/XLSX is row data and does not.
 * Spreadsheets belong to the `csv_row` recognition lane, which is the same
 * hand-off this docblock defers.
 */
import { router } from 'expo-router';

import { useScanDraft, type Photo } from '@/stores/scanDraftStore';
import { routes } from '@/lib/routes';
import type { DraftDoc } from '@/features/v2/scan/pickScanFiles';

export type ScanRunInput = {
  photos: Photo[];
  docs: DraftDoc[];
};

/** True when there is anything at all to analyse. */
export function hasScanInput({ photos, docs }: ScanRunInput): boolean {
  return photos.length > 0 || docs.length > 0;
}

/**
 * Create the draft, attach the documents, and route to the detector.
 *
 * Throws on failure so the caller owns the message — the viewfinder and the
 * intake screen say different things about what is still safe ("your photos are
 * still here" vs "your files are still here").
 */
export async function startScanRun({ photos, docs }: ScanRunInput): Promise<void> {
  await useScanDraft.getState().start(photos);
  if (docs.length > 0) {
    useScanDraft.getState().patch({ documents: docs });
  }
  router.replace(routes.scanProcessing);
}
