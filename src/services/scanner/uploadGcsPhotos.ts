import { Platform } from 'react-native';

import { greenbidz } from '@/api/greenbidzClient';
import type { Photo } from '@/stores/scanDraftStore';

export { gcsUrlForAnalyze } from './gcsUrl';

// One-shot upload of capture-session photos to Google Cloud Storage via the
// backend's `/gcs/upload` proxy. Bytes touch GCS exactly once per scan
// session; the returned `objectName`s + `sessionId` are reused for both AI
// analysis (`/wp/analyze-smart-detection` URL mode) and product creation
// (`/wp/create-product-direct` with `gcs_image_paths[]` + `gcs_session_id`).
//
// Order is preserved: files are appended to the multipart body in `photos[]`
// order, and the response `files` array round-trips that order — important
// because the smart-detect API's `image_indexes` is index-based.
//
// See Docs/GCS_UPLOAD_INTEGRATION_PLAN.md (W1).

export type GcsUploadedFile = {
  originalName: string;
  objectName: string;
  /** Raw GCS URL — only resolvable if the bucket is publicly readable.
   *  For passing into vision-API endpoints use `gcsUrlForAnalyze(objectName)`. */
  url: string;
  size: number;
};

export type GcsUploadResult = {
  sessionId: string;
  files: GcsUploadedFile[];
};

type UploadResponse = {
  success?: boolean;
  message?: string;
  data?: {
    sessionId?: string;
    files?: {
      originalName?: string;
      objectName?: string;
      url?: string;
      size?: number;
    }[];
  };
};

const IS_WEB = Platform.OS === 'web';

async function appendPhoto(fd: FormData, photo: Photo, index: number) {
  // Same dance as `buildFormData.ts:appendFile` — web FormData needs a real
  // Blob, RN FormData accepts the { uri, name, type } shape.
  const name = `photo-${index}.jpg`;
  if (IS_WEB) {
    const blob = await fetch(photo.uri).then((r) => r.blob());
    fd.append('files', blob, name);
    return;
  }
  fd.append('files', {
    uri: photo.uri,
    name,
    type: 'image/jpeg',
  } as unknown as Blob);
}

export async function uploadGcsPhotos(
  photos: Photo[],
  opts: { sellerId: number; sessionId?: string; signal?: AbortSignal },
): Promise<GcsUploadResult> {
  if (photos.length === 0) {
    throw new Error('uploadGcsPhotos: no photos to upload');
  }
  if (photos.length > 20) {
    throw new Error('uploadGcsPhotos: max 20 files per request');
  }

  const fd = new FormData();
  fd.append('sellerId', String(opts.sellerId));
  if (opts.sessionId) fd.append('sessionId', opts.sessionId);
  for (let i = 0; i < photos.length; i++) {
    await appendPhoto(fd, photos[i], i);
  }

  const res = await greenbidz.post<UploadResponse>('/gcs/upload', fd, {
    timeout: 60_000,
    signal: opts.signal,
    headers: { 'Content-Type': 'multipart/form-data' },
    // Same trick as createProduct.ts — don't let axios JSON-stringify the FD.
    transformRequest: (data) => data,
  });

  if (!res.data?.success) {
    throw new Error(res.data?.message ?? 'GCS upload failed');
  }

  const sessionId = res.data.data?.sessionId;
  const rawFiles = res.data.data?.files;
  if (!sessionId || !Array.isArray(rawFiles) || rawFiles.length === 0) {
    throw new Error('GCS upload returned no files');
  }
  // Defend against a short backend response — callers pair files-by-index
  // with `photos`, so a length mismatch would silently map the wrong URL to
  // the wrong photo at analyze + create time.
  if (rawFiles.length !== photos.length) {
    throw new Error(
      `GCS upload returned ${rawFiles.length} files for ${photos.length} photos`,
    );
  }

  const files: GcsUploadedFile[] = rawFiles.map((f, i) => {
    const objectName = String(f.objectName ?? '').trim();
    if (!objectName) {
      throw new Error(`GCS upload response missing objectName at index ${i}`);
    }
    return {
      originalName: String(f.originalName ?? `photo-${i}.jpg`),
      objectName,
      url: String(f.url ?? ''),
      size: Number(f.size ?? 0),
    };
  });

  return { sessionId, files };
}

