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

/**
 * Document payload accepted by `uploadGcsDocuments` — same shape as the
 * draft's `documents` field. `mimeType` is preserved on the multipart
 * upload so the backend can route the file (PDFs go through the page
 * extractor; other docs are kept as raw attachments).
 */
export type GcsDocumentInput = {
  uri: string;
  name: string;
  mimeType: string;
};

async function appendDocument(fd: FormData, doc: GcsDocumentInput) {
  // Same web/native fork as `appendPhoto`. On web we fetch the blob from
  // the URI (data: or http:); on native we hand the {uri,name,type} shape
  // to RN's FormData and it streams the file directly.
  if (IS_WEB) {
    const blob = await fetch(doc.uri).then((r) => r.blob());
    fd.append('files', blob, doc.name);
    return;
  }
  fd.append('files', {
    uri: doc.uri,
    name: doc.name,
    type: doc.mimeType,
  } as unknown as Blob);
}

/**
 * Upload PDFs / Word / Excel / other documents through the same
 * `/gcs/upload` endpoint that handles photos. Backend mime-sniffs each
 * file and routes accordingly — PDFs get their pages extracted into
 * images that the AI then analyzes (returned in the smart-detect
 * response's `image_urls`).
 *
 * `sessionId` is forwarded when present so a single scan session's
 * photos + docs land in the same GCS prefix.
 *
 * Response shape mirrors `uploadGcsPhotos`; callers consume the same
 * `GcsUploadedFile[]` array.
 */
export async function uploadGcsDocuments(
  documents: GcsDocumentInput[],
  opts: { sellerId: number; sessionId?: string; signal?: AbortSignal },
): Promise<GcsUploadResult> {
  if (documents.length === 0) {
    throw new Error('uploadGcsDocuments: no documents to upload');
  }
  if (documents.length > 20) {
    throw new Error('uploadGcsDocuments: max 20 files per request');
  }

  const fd = new FormData();
  fd.append('sellerId', String(opts.sellerId));
  if (opts.sessionId) fd.append('sessionId', opts.sessionId);
  // Skip the server-side AI content gate (same as the web sell-flow's fast
  // path). Without this, `/gcs/upload` runs a "valid marketplace product?"
  // check and REJECTS non-product/blank images → returns `files:[]` +
  // `rejected:[…]` → the caller throws "GCS upload returned no files". The AI
  // detect step downstream does its own identification, so the gate is redundant
  // here and just blocks legitimate uploads.
  fd.append('validate', 'false');
  for (const doc of documents) {
    await appendDocument(fd, doc);
  }

  const res = await greenbidz.post<UploadResponse>('/gcs/upload', fd, {
    timeout: 60_000,
    signal: opts.signal,
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });

  if (!res.data?.success) {
    throw new Error(res.data?.message ?? 'GCS document upload failed');
  }
  const sessionId = res.data.data?.sessionId;
  const rawFiles = res.data.data?.files;
  if (!sessionId || !Array.isArray(rawFiles) || rawFiles.length === 0) {
    throw new Error('GCS document upload returned no files');
  }
  if (rawFiles.length !== documents.length) {
    throw new Error(
      `GCS document upload returned ${rawFiles.length} files for ${documents.length} documents`,
    );
  }
  const files: GcsUploadedFile[] = rawFiles.map((f, i) => {
    const objectName = String(f.objectName ?? '').trim();
    if (!objectName) {
      throw new Error(`GCS upload response missing objectName at index ${i}`);
    }
    return {
      originalName: String(f.originalName ?? documents[i].name),
      objectName,
      url: String(f.url ?? ''),
      size: Number(f.size ?? 0),
    };
  });
  return { sessionId, files };
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
  // Skip the server-side AI content gate (same as the web sell-flow's fast
  // path). Without this, `/gcs/upload` runs a "valid marketplace product?"
  // check and REJECTS non-product/blank images → returns `files:[]` +
  // `rejected:[…]` → the caller throws "GCS upload returned no files". The AI
  // detect step downstream does its own identification, so the gate is redundant
  // here and just blocks legitimate uploads.
  fd.append('validate', 'false');
  for (let i = 0; i < photos.length; i++) {
    await appendPhoto(fd, photos[i], i);
  }

  const res = await greenbidz.post<UploadResponse>('/gcs/upload', fd, {
    timeout: 60_000,
    signal: opts.signal,
    headers: { 'Content-Type': 'multipart/form-data' },
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

