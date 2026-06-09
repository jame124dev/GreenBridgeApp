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
 * GCS object.
 *
 * Strategy: prefer the **raw** `storage.googleapis.com/...` URL the backend
 * returns in the upload response. The GreenBridgeSeller web client uses raw
 * URLs end-to-end and they work against the production bucket. The /gcs/serve
 * proxy is kept as a fallback for cases where the backend didn't supply a
 * direct URL (e.g. older `/gcs/upload` responses).
 *
 * Why this matters — the backend's `objectName` field is already URL-encoded
 * (e.g. `WALDRICH%20COBURG.pdf`). When we re-encode it via
 * `encodeURIComponent` to build a `/gcs/serve?path=…` query, the `%20`
 * becomes `%2520` and the proxy returns 404 → "could not read the photos".
 * The raw URL is pre-built by the backend correctly and dodges the
 * double-encoding hazard entirely.
 *
 * Dev escape hatch: set `EXPO_PUBLIC_GCS_USE_PROXY_URL=1` in `.env` to force
 * the proxy path (useful when running against a non-public dev bucket).
 */
export function gcsUrlForAnalyze(file: GcsUrlInput): string {
  const forceProxy = process.env.EXPO_PUBLIC_GCS_USE_PROXY_URL === '1';
  if (!forceProxy && file.url && /^https?:\/\//i.test(file.url)) {
    return file.url;
  }
  const extra = Constants.expoConfig?.extra ?? {};
  const base = String(extra.GREENBIDZ_API_URL ?? '').replace(/\/+$/, '');
  // Decode-then-encode pass: if the backend already URL-encoded the object
  // name (spaces → `%20` etc.), we'd double-encode without this step.
  const safeObjectName = decodeURIComponent(file.objectName);
  return `${base}/gcs/serve?path=${encodeURIComponent(safeObjectName)}`;
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
