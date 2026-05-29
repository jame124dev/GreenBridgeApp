import Constants from 'expo-constants';

import type { ProductGcsRefs } from './buildFormData';

// Pure helpers for the GCS upload flow. Kept dependency-free (no axios, no
// native modules) so jest can import these without spinning up the
// react-native runtime.
//
// See Docs/GCS_UPLOAD_INTEGRATION_PLAN.md §6 + W5.

type GcsUrlInput = {
  /** Permanent GCS object path returned from /gcs/upload. */
  objectName: string;
  /** Raw `storage.googleapis.com/...` URL — only resolvable if the bucket is
   *  publicly readable. Used by the dev escape hatch. */
  url?: string;
};

/**
 * Build the public URL that the smart-detect vision API will use to fetch a
 * GCS object. Defaults to the `/gcs/serve` proxy (backend 302's to a fresh
 * signed URL — works regardless of bucket-level public-read).
 *
 * Dev escape hatch: set `EXPO_PUBLIC_GCS_USE_RAW_URL=1` in `.env` to send the
 * raw `storage.googleapis.com/...` URL instead. Useful when running against a
 * dev backend with a publicly-readable bucket.
 */
export function gcsUrlForAnalyze(file: GcsUrlInput): string {
  if (process.env.EXPO_PUBLIC_GCS_USE_RAW_URL === '1' && file.url) {
    return file.url;
  }
  const extra = Constants.expoConfig?.extra ?? {};
  const base = String(extra.GREENBIDZ_API_URL ?? '').replace(/\/+$/, '');
  return `${base}/gcs/serve?path=${encodeURIComponent(file.objectName)}`;
}

type GcsLookup = {
  sessionId: string;
  objectNameByPhotoUri: Record<string, string>;
};
type PhotoLike = { uri: string };

/**
 * Build `ProductGcsRefs` for the photos of a specific draft item. Returns
 * null when GCS state is absent OR any photo URI is missing an entry —
 * caller should fall back to the legacy inline-multipart path (or trigger
 * a re-upload before retry).
 *
 * Object names are returned in `photos[]` order so the backend's image-index
 * assumptions hold. See plan W4.c.
 */
export function getGcsRefsForItem(
  photos: readonly PhotoLike[],
  gcs: GcsLookup | null | undefined,
): ProductGcsRefs | null {
  if (!gcs || photos.length === 0) return null;
  const objectNames: string[] = [];
  for (const p of photos) {
    const name = gcs.objectNameByPhotoUri[p.uri];
    if (!name) return null;
    objectNames.push(name);
  }
  return { sessionId: gcs.sessionId, objectNames };
}
