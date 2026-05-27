import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { DraftItem, Photo } from '@/stores/scanDraftStore';

// Web shim: expo-file-system/legacy has no documentDirectory in browsers.
// Photos come back as blob: URIs from expo-camera and stay valid for the
// life of the page, so we just keep them in-memory and skip disk persistence.
// Drafts won't survive a hard reload on web — that's acceptable for browser QA.
const IS_WEB = Platform.OS === 'web';

const SCAN_DIR = `${FileSystem.documentDirectory ?? ''}scan-drafts/`;

export type DraftDocument = DraftItem['documents'][number];

async function ensureScanDir() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Document directory is not available');
  }
  const info = await FileSystem.getInfoAsync(SCAN_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SCAN_DIR, { intermediates: true });
  }
}

function fileExtension(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i) : '';
}

/** Copy compressed captures into documentDirectory so MMKV drafts survive app restarts. */
export async function persistPhotosForDraft(
  photos: Photo[],
  draftId: string,
): Promise<Photo[]> {
  if (IS_WEB) return photos;
  await ensureScanDir();

  const persisted: Photo[] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const dest = `${SCAN_DIR}${draftId}-${i}.jpg`;
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists && photo.uri === dest) {
      persisted.push(photo);
      continue;
    }
    await FileSystem.copyAsync({ from: photo.uri, to: dest });
    persisted.push({ ...photo, uri: dest });
  }
  return persisted;
}

/** Persist supporting docs the same way as photos (survives app restart). */
export async function persistDocumentsForDraft(
  documents: DraftDocument[],
  draftId: string,
): Promise<DraftDocument[]> {
  if (!documents.length) return [];
  if (IS_WEB) return documents;
  await ensureScanDir();

  const persisted: DraftDocument[] = [];
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const ext = fileExtension(doc.name) || '';
    const dest = `${SCAN_DIR}${draftId}-doc-${i}${ext}`;
    if (doc.uri.startsWith(SCAN_DIR)) {
      const info = await FileSystem.getInfoAsync(doc.uri);
      if (info.exists) {
        persisted.push(doc);
        continue;
      }
    }
    await FileSystem.copyAsync({ from: doc.uri, to: dest });
    persisted.push({ ...doc, uri: dest });
  }
  return persisted;
}

export async function verifyDraftPhotos(photos: Photo[]): Promise<boolean> {
  if (!photos.length) return false;
  if (IS_WEB) return true; // in-memory blob URIs — assume valid for the session
  for (const photo of photos) {
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists) return false;
  }
  return true;
}

export async function verifyDraftDocuments(documents: DraftDocument[]): Promise<boolean> {
  if (IS_WEB) return true;
  for (const doc of documents) {
    const info = await FileSystem.getInfoAsync(doc.uri);
    if (!info.exists) return false;
  }
  return true;
}

/** Verify all local files for an in-progress scan session. */
export async function verifyScanSessionFiles(state: {
  current: DraftItem | null;
  queuedItems: DraftItem[];
  pendingPhotos: Photo[] | null;
}): Promise<boolean> {
  if (state.pendingPhotos?.length && !(await verifyDraftPhotos(state.pendingPhotos))) {
    return false;
  }
  const items = [...state.queuedItems, ...(state.current ? [state.current] : [])];
  for (const item of items) {
    if (!(await verifyDraftPhotos(item.photos))) return false;
    if (!(await verifyDraftDocuments(item.documents))) return false;
  }
  return true;
}
