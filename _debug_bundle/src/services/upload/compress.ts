import * as ImageManipulator from 'expo-image-manipulator';

export type CompressedPhoto = {
  uri: string;
  width: number;
  height: number;
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
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}
