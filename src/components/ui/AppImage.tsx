import { Image, type ImageProps } from 'expo-image';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme';

// Thin wrapper around `expo-image` so every image in the app gets memory+disk
// caching, a soft fade-in, and a neutral placeholder background for free.
// Callers pass only `source` + `style`; the defaults below are overridable.
//
// NOTE: `expo-image` is a native module — it requires a dev-client build
// (`npx expo run:android`) or Expo Go with Metro restarted (`--clear`). If you
// hit `Cannot find native module 'ExpoImage'`, the running binary predates the
// install; rebuild the dev client.

export type AppImageProps = ImageProps;

export function AppImage({ style, ...rest }: AppImageProps) {
  return (
    <Image
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      style={[styles.placeholder, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.surfaceSubtle },
});
