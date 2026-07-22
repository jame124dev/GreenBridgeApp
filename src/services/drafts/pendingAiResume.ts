// pendingAiResume.ts — pure mapper that turns a fetched `pending-ai` draft
// payload (the one the BACKGROUND recognition runner persists server-side)
// into the pieces the scan store needs to resume it: a `MappedSmartDetection`
// plus the index-aligned `sourcePhotos`. No store / network / React — so the
// round-trip is unit-testable with plain JSON.
//
// Follow-up #1 (pre-flag-flip): before this, resuming a `pending-ai` draft
// from "Your drafts" was a no-op-with-toast because the resume shape was
// unverified. It is now verified against the real backend writer
// (101recycle-greenbidz-backend/services/recognitionRunner.js
// `buildPendingAiDraftFields`), which persists:
//
//     payload = { v: 1, kind: "pending-ai", mode, language, result, imageUrls }
//
//   - `result`    is the EXACT `result` SSE event data (a SmartDetectionResponse) —
//                 byte-identical to the synchronous v2 stream's terminal frame,
//                 so it feeds the SAME `mapSmartDetection` transform the live
//                 scan uses (recognitionJobClient.ts:285). Zero server↔client drift.
//   - `imageUrls` is `result.image_urls` verbatim — the canonical image stream
//                 the AI ran against, so it is index-aligned with each product's
//                 `image_indexes`. That alignment is what makes the resumed
//                 `sourcePhotos` valid for `buildPhotoSlices`/`applySmartDetection`.
//
// NOTE the persisted field is `imageUrls` (string[]), NOT the speculative
// `imagesOrdered: {url,objectName}[]` shape the mobile `PendingAiPayload` type
// once guessed at — the mobile app never CREATES a pending-ai draft (the server
// does), so this READER is the source of truth for the shape.
import { mapSmartDetection } from '@/features/scanner/mapSmartDetection';
import type {
  MappedSmartDetection,
  SmartDetectionResponse,
} from '@/features/scanner/smartDetectionTypes';
import type { Photo } from '@/stores/scanDraftStore';

/** The pending-ai payload persisted by the backend recognition runner.
 *  `imageUrls` is tolerated as either the real `string[]` or, defensively, a
 *  `{ url }[]` (mirrors the web `useDraftResume` normalization). */
export interface PendingAiDraftPayload {
  v?: number;
  kind: 'pending-ai';
  mode?: 'single' | 'multi';
  language?: string;
  result: SmartDetectionResponse;
  imageUrls?: (string | { url?: string; objectName?: string })[];
}

export interface PendingAiResume {
  /** Mapped detection, identical to what the live v2 stream produces. */
  mapped: MappedSmartDetection;
  /** Remote GCS photos in canonical order — index-aligned with product image_indexes. */
  sourcePhotos: Photo[];
}

/** Normalize the persisted `imageUrls` to plain URL strings, dropping empties.
 *  Accepts the real `string[]` and, defensively, a `{ url }[]`. */
export function pendingAiImageUrls(payload: Partial<PendingAiDraftPayload> | null | undefined): string[] {
  const raw = payload?.imageUrls;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => (typeof u === 'string' ? u : u?.url ?? ''))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/**
 * Convert a fetched `pending-ai` draft payload into the resume bundle, or
 * `null` when it isn't a resumable pending-ai draft (wrong `kind`, missing
 * `result`, or no images to slice against). Callers degrade gracefully on
 * `null` rather than guessing at a shape.
 *
 * The returned `sourcePhotos` come from `payload.imageUrls` (falling back to
 * the mapper's `responseImageUrls` — the two are the same `result.image_urls`
 * array server-side, but the fallback keeps this robust if a draft were ever
 * written without the top-level list). They are `https` GCS URIs, so
 * `persistPhotosForDraft` keeps them as-is and the detail/detection screens
 * render them directly.
 */
export function mapPendingAiDraft(
  payload: unknown,
  siteType: string,
): PendingAiResume | null {
  const p = payload as Partial<PendingAiDraftPayload> | null | undefined;
  if (!p || p.kind !== 'pending-ai' || !p.result) return null;

  const mapped = mapSmartDetection(p.result as SmartDetectionResponse, siteType);

  const urls = pendingAiImageUrls(p);
  const orderedUrls = urls.length ? urls : mapped.responseImageUrls;
  if (!orderedUrls.length) return null;

  const sourcePhotos: Photo[] = orderedUrls.map((uri) => ({ uri, width: 0, height: 0 }));
  return { mapped, sourcePhotos };
}
