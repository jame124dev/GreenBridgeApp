import { Image } from 'expo-image';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Gallery,
  fitContainer,
  useImageResolution,
} from 'react-native-zoom-toolkit';

/**
 * Full-screen, pinch/double-tap-zoomable photo viewer opened by tapping a photo
 * in the Detail carousel.
 *
 * IMPORTANT: do NOT key this component by the opened index from the parent.
 * Remounting an RN <Modal> that contains react-native-zoom-toolkit's <Gallery>
 * crashes on Android Fabric ("addViewAt: child already has a parent") because
 * the native modal window and the gallery's view recycler race during the
 * remount. Keep this mounted; just toggle `visible`.
 *
 * Rendered inside a RN <Modal>, which on Android lives in its own view
 * hierarchy, so the app-root GestureHandlerRootView does NOT reach it — we wrap
 * a fresh GestureHandlerRootView here or the gallery's gestures silently no-op.
 *
 * S6.2.a — StyleSheet block converted to NativeWind classes. The
 * `GestureHandlerRootView` and `SafeAreaView` accept `style` (not className),
 * so the inline `style={{ flex: 1, ... }}` form stays for them; everything
 * else inside renders via className.
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
  const [prevVisible, setPrevVisible] = useState(visible);
  const [index, setIndex] = useState(initialIndex);

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setIndex(initialIndex);
    }
  }

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <Gallery
          data={uris}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          initialIndex={initialIndex}
          onIndexChange={setIndex}
          renderItem={(uri) => <ZoomImage uri={uri} />}
        />

        <SafeAreaView
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
          pointerEvents="box-none"
        >
          <View className="flex-row items-center justify-between px-lg">
            {uris.length > 1 ? (
              <View className="bg-neutral-900/60 rounded-full px-md py-xs">
                <Text className="font-semi text-bodySm text-white">
                  {index + 1}/{uris.length}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <Pressable
              className="w-10 h-10 rounded-full items-center justify-center bg-neutral-900/60"
              onPress={onClose}
              hitSlop={12}
            >
              <X color="#fff" size={22} />
            </Pressable>
          </View>
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
