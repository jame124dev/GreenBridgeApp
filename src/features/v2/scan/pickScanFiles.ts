/**
 * Pick files for a scan — the document lane, lifted out of the shipped camera.
 *
 * ── PROVENANCE ────────────────────────────────────────────────────────────
 *
 * Every rule in this file is a PORT of `app/scan/camera.tsx`, not a new
 * design. That screen has been through real use and the edges it handles were
 * each found the hard way:
 *
 *   `safeDocumentName`   app/scan/camera.tsx:60-74
 *   `CAP_BY_EXT`         app/scan/camera.tsx:82-96
 *   `humanBytes`         app/scan/camera.tsx:98-102
 *   `pickScanFiles`      app/scan/camera.tsx:305-403
 *
 * It lives here rather than inside `app/v2/scan/camera.tsx` so the two cameras
 * cannot drift on the SIZE CAPS or the FILENAME FLATTENING — both of which are
 * agreements with the backend, not preferences.
 *
 * ⚠️ `app/scan/camera.tsx` STILL HOLDS ITS OWN COPY. It was left untouched on
 * purpose: it is the live seller camera, this session cannot verify it on a
 * device, and a refactor of a shipped capture path is not what the document
 * gap needed. Pointing it here is the follow-up — when that happens, delete
 * its four local helpers rather than leaving two definitions of a cap.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────
 *
 * No Alerts, no i18n, no store writes, no auth check. It returns what the
 * person picked and what it had to refuse; the screen decides what to say and
 * where the files go. That is what makes the classification and the caps
 * testable without a renderer.
 */
import * as DocumentPicker from 'expo-document-picker';

import { compressPhoto } from '@/services/upload/compress';
import type { Photo } from '@/stores/scanDraftStore';

/**
 * A document picked from the device — anything that is not an image.
 *
 * The shape matches `DraftItem.documents` (`src/stores/scanDraftStore.ts:163`)
 * so the array can be patched straight into the draft.
 */
export type DraftDoc = { uri: string; name: string; mimeType: string };

/** A file the local pre-flight refused, with the numbers the message needs. */
export type OversizeFile = { name: string; size: number; limit: number };

export type PickedFiles = {
  /** The person dismissed the picker. Nothing to say, nothing to add. */
  canceled: boolean;
  /** Images, already compressed — they join the captured shots. */
  photos: Photo[];
  /** Everything else — PDFs, Word, Excel, CSV, plain text. */
  docs: DraftDoc[];
  /** Refused locally, before the upload. */
  oversize: OversizeFile[];
};

/**
 * Pre-emptively flatten a picked document's filename to an ASCII-safe form.
 *
 * Why: RN's native multipart FormData on Android URL-encodes the filename in
 * the `Content-Disposition` header (space → `%20`, `(` → `%28`). The backend's
 * parser then stores that *encoded* string as the literal GCS object name.
 * When the returned `url` is later sent to smart-detect, GCS unescapes `%20`
 * back to a space and 404s, because the stored object has the literal
 * three-character `%20` in its name. Stripping non-safe characters before
 * upload makes the round-trip an identity, with no encoding involved.
 *
 * Real example: `"TRENNJAEGER (1).pdf"` → `"TRENNJAEGER_1.pdf"`.
 */
export function safeDocumentName(rawName: string): string {
  let s = (rawName || '').trim();
  try {
    // Some Android ContentResolvers hand back an already-encoded name; decode
    // first so it is not double-mangled.
    s = decodeURIComponent(s);
  } catch {
    // Malformed % sequence — keep the original string.
  }
  const safe = s.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
  const dot = safe.lastIndexOf('.');
  if (dot <= 0) return safe || 'document';
  const base = safe.slice(0, dot).replace(/^_+|_+$/g, '') || 'document';
  return base + safe.slice(dot);
}

/**
 * Per-mime size cap, in bytes.
 *
 * Mirrors the backend's caps in `controller/wordPressSmart.js:2534-2548` and
 * `services/officeDocs.js`. The server stays authoritative — this is a fast
 * local rejection so nobody waits through an upload to be told no, NOT a
 * security boundary.
 */
const CAP_BY_EXT: Record<string, number> = {
  '.docx': 25 * 1024 * 1024,
  '.pptx': 25 * 1024 * 1024,
  '.xlsx': 50 * 1024 * 1024,
  '.csv': 50 * 1024 * 1024,
  '.pdf': 50 * 1024 * 1024,
};

/** `null` for an unknown extension — server-side classification handles those. */
export function capForFile(name: string | undefined): number | null {
  if (!name) return null;
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  return CAP_BY_EXT[name.slice(dot).toLowerCase()] ?? null;
}

/**
 * The mime the BACKEND accepts for a given extension.
 *
 * ⚠️ Android does not hand back the mime the server expects. Measured on the
 * Realme 7 (2026-09-22) with
 * `content query --uri content://media/external/file --projection mime_type`:
 * a `.csv` comes back as **`text/comma-separated-values`**, the legacy IANA
 * name. The backend's accept-list (`services/officeDocs.js` OFFICE_MIMES) has
 * only `text/csv` and `application/csv`, and `isOfficeDocMime()` is mime-ONLY
 * with no extension fallback — so the file never routes to the office-docs
 * reader and the seller is told *"We couldn't read this file."* while the
 * progress rail cheerfully reports "Reading 1 document(s)...".
 *
 * Normalising here rather than server-side because that accept-list is shared
 * with the web, which sends `text/csv` from a browser and is unaffected; a
 * change there is a backend deploy for a client-specific quirk. The durable
 * fix is still to give `isOfficeDocMime` the extension fallback its own
 * docblock already asks for — *"callers that have a filename should trust the
 * EXTENSION over this mime"* (`services/officeDocs.js:30`).
 */
const MIME_BY_EXT: Record<string, string> = {
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pdf': 'application/pdf',
};

/**
 * Prefer the EXTENSION's mime over whatever the content resolver reported.
 *
 * Only for extensions we know; anything else keeps the reported mime so the
 * server's own classification still decides. This deliberately overrides even
 * a plausible-looking mime, because `application/vnd.ms-excel` is handed out
 * for `.csv` by Windows machines with Excel installed — the exact overload the
 * backend warns about.
 */
export function mimeForDocument(name: string | undefined, reported: string | undefined): string {
  const n = name ?? '';
  const dot = n.lastIndexOf('.');
  const byExt = dot >= 0 ? MIME_BY_EXT[n.slice(dot).toLowerCase()] : undefined;
  return byExt ?? reported ?? 'application/octet-stream';
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * An image picked from Files is a PHOTO, not a document.
 *
 * Checked by extension as well as mime because Android content URIs routinely
 * arrive as `application/octet-stream`, and a JPEG sent down the document lane
 * is a file the detector cannot read.
 */
export function isImageAsset(asset: { mimeType?: string | null; name?: string | null }): boolean {
  return (
    (asset.mimeType ?? '').toLowerCase().startsWith('image/') ||
    /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(asset.name ?? '')
  );
}

/**
 * Open the system file picker and sort what comes back.
 *
 * The picker accepts EVERY type on purpose: the seller was asked for "the
 * spec sheet", and a filtered picker that greys out the file they are looking
 * at is worse than one that accepts it and explains the refusal.
 */
export async function pickScanFiles(): Promise<PickedFiles> {
  const empty: PickedFiles = { canceled: true, photos: [], docs: [], oversize: [] };

  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return empty;

  const photos: Photo[] = [];
  const docs: DraftDoc[] = [];
  const oversize: OversizeFile[] = [];

  for (const asset of result.assets) {
    if (isImageAsset(asset)) {
      try {
        const compressed = await compressPhoto(asset.uri);
        photos.push({
          uri: compressed.uri,
          width: compressed.width,
          height: compressed.height,
          sizeBytes: compressed.sizeBytes,
        });
      } catch {
        // Skip a file that fails compression — the picker can return content
        // URIs ImageManipulator chokes on, and the rest of the batch should
        // still go through.
      }
      continue;
    }

    const limit = capForFile(asset.name);
    if (limit != null && typeof asset.size === 'number' && asset.size > limit) {
      oversize.push({ name: asset.name || 'document', size: asset.size, limit });
      continue;
    }
    const name = safeDocumentName(asset.name || 'document');
    docs.push({
      uri: asset.uri,
      name,
      // Extension first — see `mimeForDocument`. Android's `.csv` mime is not
      // one the backend accepts.
      mimeType: mimeForDocument(name, asset.mimeType ?? undefined),
    });
  }

  return { canceled: false, photos, docs, oversize };
}
