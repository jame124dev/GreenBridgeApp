// useAttachmentPicker — the (lab) customer-app chat/composer attachment pickers.
// Wraps `expo-image-picker` (camera + library) and `expo-document-picker` (spec
// sheets / manuals / CSVs) and maps every picked asset onto a `ComposerAttachment`
// staged in `useComposer`. `useLabTurn.start()` then reads those staged
// attachments and routes the next turn to `/detect/stream` (AI detect → draft)
// instead of `/chat/stream`.
//
// Conventions mirror the seller scanner (`useDetailController`, `DocumentsCard`):
//  - request permission before opening the camera/library; on denied → toast +
//    return (never crash), on user-cancel → return silently.
//  - `haptics.tap()` on a successful pick (selection feel).
import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { toast } from 'sonner-native';

import { haptics } from '@/lib/haptics';
import { useComposer, type ComposerAttachment } from '@/features/lab/stores/composerStore';

/** Document MIME types we accept: PDF, common Office formats, and CSV. */
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
];

/** Derive a display name from a URI when the picker gives us no filename. */
function nameFromUri(uri: string, isImage: boolean): string {
  const tail = uri.split(/[\\/]/).pop() ?? '';
  if (tail && tail.includes('.')) return tail;
  return isImage ? 'photo.jpg' : 'document';
}

export type UseAttachmentPicker = {
  /** Open the camera for a single photo. Requests camera permission first. */
  pickCamera: () => Promise<void>;
  /** Open the photo library (multi-select). Requests library permission first. */
  pickLibrary: () => Promise<void>;
  /** Open the system document picker (PDF/office/csv, multi-select). */
  pickDocument: () => Promise<void>;
};

export function useAttachmentPicker(): UseAttachmentPicker {
  const stage = useCallback((attachment: ComposerAttachment) => {
    useComposer.getState().addAttachment(attachment);
    haptics.tap();
  }, []);

  const pickCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.error('Camera access needed', {
        description: 'Enable camera access in Settings to snap a photo.',
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;
    for (const a of result.assets) {
      stage({ uri: a.uri, name: a.fileName ?? nameFromUri(a.uri, true), isImage: true });
    }
  }, [stage]);

  const pickLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Photo access needed', {
        description: 'Enable photo access in Settings to attach a photo.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;
    for (const a of result.assets) {
      stage({ uri: a.uri, name: a.fileName ?? nameFromUri(a.uri, true), isImage: true });
    }
  }, [stage]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: DOC_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    for (const a of result.assets) {
      stage({ uri: a.uri, name: a.name ?? nameFromUri(a.uri, false), isImage: false });
    }
  }, [stage]);

  return { pickCamera, pickLibrary, pickDocument };
}
