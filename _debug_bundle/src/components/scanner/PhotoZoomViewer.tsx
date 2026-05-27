import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Gallery,
  fitContainer,
  useImageResolution,
} from 'react-native-zoom-toolkit';

import { fonts } from '@/theme';

/**
 * Full-screen, pinch/double-tap-zoomable photo viewer opened by tapping a photo
 * in the Detail carousel. The carousel itself is unchanged — this is an overlay.
 *
 * Rendered inside a RN <Modal>, which on Android lives in its own view
 * hierarchy, so the app-root GestureHandlerRootView does NOT reach it — we wrap
 * a fresh GestureHandlerRootView here or the gallery's gestures silently no-op.
 */
export function PhotoZoomViewer({
  visible,
  photos,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  photos: { uri: string }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const uris = photos.map((p) => p.uri);
  // Seeded from the tapped photo. The parent keys this component by the opened
  // index, so it remounts per open and `initialIndex` is always fresh here —
  // no effect needed to resync.
  const [index, setIndex] = useState(initialIndex);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Gallery
          data={uris}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          initialIndex={initialIndex}
          onIndexChange={setIndex}
          renderItem={(uri) => <ZoomImage uri={uri} />}
        />

        <SafeAreaView style={styles.topBar} pointerEvents="box-none">
          {uris.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {index + 1}/{uris.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <X color="#fff" size={22} />
          </Pressable>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** One zoomable page — sizes the image to fit the screen by its real aspect ratio. */
function ZoomImage({ uri }: { uri: string }) {
  const { width, height } = useWindowDimensions();
  const { resolution } = useImageResolution({ uri });
  const size = resolution
    ? fitContainer(resolution.width / resolution.height, { width, height })
    : { width, height };

  return <Image source={{ uri }} style={size} contentFit="cover" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  counter: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  counterText: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
});
