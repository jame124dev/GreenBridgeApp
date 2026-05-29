import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export type CompressedPhoto = {
  uri: string;
  width: number;
  height: number;
  /**
   * On-disk size of the compressed file in bytes. Undefined if the platform
   * is web (no `documentDirectory`) or the size lookup fails — callers must
   * treat it as optional UX metadata, not load-bearing.
   */
  sizeBytes?: number;
};

export async function compressPhoto(
  uri: string,
  quality = 0.75,
): Promise<CompressedPhoto> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );

  // Read the compressed file's on-disk size so the staged screen can show a
  // real "N photos · 12.4 MB" header. Cheap call (<10ms); failures fall back
  // to `undefined` so the caller can decide whether to show or hide the size.
  let sizeBytes: number | undefined;
  try {
    const info = await FileSystem.getInfoAsync(result.uri);
    if (info.exists && typeof info.size === 'number') {
      sizeBytes = info.size;
    }
  } catch {
    // Web or transient FS error — leave sizeBytes undefined.
  }

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    sizeBytes,
  };
}
