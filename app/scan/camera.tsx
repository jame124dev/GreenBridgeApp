import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { fonts } from '@/theme/typography';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { X, Zap, ZapOff, SwitchCamera, Images } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppImage } from '@/components/ui';
import { LocationPrimerSheet } from '@/features/location/LocationPrimerSheet';
import { useScanLocationPrimer } from '@/features/location/useScanLocationPrimer';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { compressPhoto } from '@/services/upload/compress';
import { useScanDraft } from '@/stores/scanDraftStore';
import type { Photo } from '@/stores/scanDraftStore';

/**
 * S6.2.b2.ii — StyleSheet.create dissolved into inline style objects. The
 * camera UI is heavy on overlays (rgba semi-transparent backgrounds, percent
 * positioning, absolute layout), shadow specs, and dynamic transform values —
 * none of which map cleanly to NativeWind classes. className is used where it
 * adds value (flex utilities, brand-* colors, simple spacing); inline `style`
 * carries the rest. Reusable values are pulled to top-level `const` objects.
 */
const iconBtnStyle = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(0,0,0,0.45)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const bracketBase = {
  position: 'absolute' as const,
  width: 36,
  height: 36,
  borderColor: 'rgba(255,255,255,0.85)',
};

export default function CameraScreen() {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);
  const [focusAnim] = useState(() => new Animated.Value(0));

  const [flashOpacity] = useState(() => new Animated.Value(0));
  const [chipScale] = useState(() => new Animated.Value(1));

  // Soft pre-prompt for location auto-fill on the review screen. Fires only
  // after camera permission is granted; if location is already granted the
  // hook silently fetches + caches and the sheet never shows.
  const locationPrimer = useScanLocationPrimer(permission?.granted === true);

  const runShutterFlash = () => {
    flashOpacity.setValue(0.7);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const popChip = () => {
    chipScale.setValue(1);
    Animated.sequence([
      Animated.timing(chipScale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
      Animated.spring(chipScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const flipCamera = () => {
    haptics.tap();
    setZoom(0);
    setFacing((f) => {
      const next = f === 'back' ? 'front' : 'back';
      if (next === 'front') setFlash(false);
      return next;
    });
  };

  const showFocusRing = (x: number, y: number) => {
    haptics.tap();
    setFocusRing({ x, y });
    focusAnim.setValue(1);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 700,
      delay: 250,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setFocusRing(null);
    });
  };

  const zoomPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onChange((e) => {
      setZoom((prev) => Math.min(1, Math.max(0, prev - e.changeY / 400)));
    });

  const focusTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .runOnJS(true)
    .onEnd((e) => showFocusRing(e.x, e.y));

  const previewGesture = Gesture.Exclusive(focusTapGesture, zoomPanGesture);

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: '#f7f9fb', padding: 24 }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#121c28' }}>
          {t('mobile.camera.permissionTitle')}
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            color: '#6b7280',
            textAlign: 'center',
            marginVertical: 16,
          }}
        >
          {t('mobile.camera.permissionText')}
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{
            backgroundColor: '#14452f',
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 8,
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.camera.allowCamera')}
        >
          <Text style={{ color: '#fff', fontFamily: fonts.semibold }}>
            {t('mobile.camera.allowCamera')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openSettings()}
          accessibilityRole="link"
          accessibilityLabel={t('mobile.camera.openSettings')}
        >
          <Text style={{ color: '#14452f', fontFamily: fonts.semibold, marginTop: 16 }}>
            {t('mobile.camera.openSettings')}
          </Text>
        </Pressable>
        <Pressable
          style={{ marginTop: 8 }}
          onPress={() => safeBack()}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.common.cancel')}
        >
          <Text style={{ color: '#14452f', fontFamily: fonts.semibold, marginTop: 16 }}>
            {t('mobile.common.cancel')}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    haptics.heavy();
    runShutterFlash();
    setCapturing(true);
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!shot?.uri) return;
      const compressed = await compressPhoto(shot.uri);
      setPhotos((prev) => [
        ...prev,
        {
          uri: compressed.uri,
          width: compressed.width,
          height: compressed.height,
          sizeBytes: compressed.sizeBytes,
        },
      ]);
      popChip();
    } catch {
      haptics.error();
      Alert.alert(t('mobile.camera.captureFailedTitle'), t('mobile.camera.captureFailedBody'));
    } finally {
      setCapturing(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const onNext = async () => {
    if (photos.length === 0 || starting) return;
    setStarting(true);
    try {
      await useScanDraft.getState().start(photos);
      router.push(routes.scanProcessing);
    } catch {
      Alert.alert(t('mobile.camera.savePhotosFailedTitle'), t('mobile.camera.savePhotosFailedBody'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={flash}
        zoom={zoom}
        autofocus="off"
      />

      <GestureDetector gesture={previewGesture}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />
      </GestureDetector>

      {zoom > 0 ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' }}
        >
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
            }}
          >
            <Text
              style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.5 }}
            >
              {`ZOOM · ${Math.round(zoom * 100)}%`}
            </Text>
          </View>
        </View>
      ) : null}

      {focusRing ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.9)',
            left: focusRing.x - 36,
            top: focusRing.y - 36,
            opacity: focusAnim,
            transform: [
              { scale: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] }) },
            ],
          }}
        />
      ) : null}

      <SafeAreaView className="flex-1 justify-between" pointerEvents="box-none">
        <View
          className="flex-row justify-between items-center"
          style={{ paddingHorizontal: 16, paddingTop: 8 }}
        >
          <Pressable
            onPress={() => safeBack()}
            hitSlop={12}
            style={iconBtnStyle}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.common.cancel')}
          >
            <X color="#fff" size={22} />
          </Pressable>
          {facing === 'back' ? (
            <Pressable
              onPress={() => setFlash((f) => !f)}
              style={iconBtnStyle}
              accessibilityRole="button"
              accessibilityLabel={flash ? t('mobile.camera.flashOn') : t('mobile.camera.flashOff')}
            >
              {flash ? <Zap color="#fff" size={20} /> : <ZapOff color="#fff" size={20} />}
            </Pressable>
          ) : (
            <View style={iconBtnStyle} />
          )}
        </View>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '15%',
            left: '8%',
            right: '8%',
            bottom: '30%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              ...bracketBase,
              top: 0,
              left: 0,
              borderTopWidth: 3,
              borderLeftWidth: 3,
              borderTopLeftRadius: 6,
            }}
          />
          <View
            style={{
              ...bracketBase,
              top: 0,
              right: 0,
              borderTopWidth: 3,
              borderRightWidth: 3,
              borderTopRightRadius: 6,
            }}
          />
          <View
            style={{
              ...bracketBase,
              bottom: 0,
              left: 0,
              borderBottomWidth: 3,
              borderLeftWidth: 3,
              borderBottomLeftRadius: 6,
            }}
          />
          <View
            style={{
              ...bracketBase,
              bottom: 0,
              right: 0,
              borderBottomWidth: 3,
              borderRightWidth: 3,
              borderBottomRightRadius: 6,
            }}
          />

          {photos.length === 0 ? (
            <View
              className="flex-row items-center"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: 'rgba(0,0,0,0.65)',
                borderRadius: 20,
                maxWidth: '90%',
              }}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 12 }}>
                {t('mobile.camera.tipStrong')}
              </Text>
              <Text
                style={{ color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12 }}
              >
                {t('mobile.camera.tipText')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingBottom: 24, paddingHorizontal: 20, gap: 12 }}>
          {photos.length > 0 ? (
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 16,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {photos.map((p, i) => (
                    <View key={p.uri} style={{ position: 'relative' }}>
                      <AppImage
                        source={{ uri: p.uri }}
                        style={{ width: 64, height: 64, borderRadius: 8 }}
                      />
                      <Pressable
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          borderRadius: 10,
                          padding: 2,
                        }}
                        onPress={() => removePhoto(i)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.common.remove', { defaultValue: 'Remove photo' })}
                      >
                        <X color="#fff" size={14} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Pressable
                  style={{
                    flexShrink: 0,
                    minWidth: 84,
                    backgroundColor: '#14452f',
                    paddingHorizontal: 16,
                    paddingVertical: 11,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: starting ? 0.6 : 1,
                  }}
                  onPress={onNext}
                  disabled={starting}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('mobile.common.next')} · ${photos.length}`}
                >
                  {starting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text
                      style={{
                        color: '#fff',
                        fontFamily: fonts.bold,
                        fontSize: 13,
                        letterSpacing: 0.5,
                      }}
                    >
                      {t('mobile.common.next')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text
              className="text-center"
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontFamily: fonts.regular,
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {t('mobile.camera.zeroHint')}
            </Text>
          )}

          <View
            className="flex-row items-center justify-between"
            style={{ paddingHorizontal: 8 }}
          >
            <Animated.View style={{ transform: [{ scale: chipScale }] }}>
              <Pressable
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor:
                    photos.length === 0
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(255,255,255,0.8)',
                  backgroundColor:
                    photos.length === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.45)',
                }}
                onPress={onNext}
                disabled={photos.length === 0 || starting}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.camera.viewPhotos', { count: photos.length })}
              >
                {starting ? (
                  <ActivityIndicator color="#fff" />
                ) : photos.length > 0 ? (
                  <>
                    <AppImage
                      source={{ uri: photos[photos.length - 1].uri }}
                      style={{ width: '100%', height: '100%' }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 5,
                        borderRadius: 11,
                        backgroundColor: '#14452f',
                        borderWidth: 2,
                        borderColor: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 11 }}>
                        {photos.length}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Images color="rgba(255,255,255,0.5)" size={24} />
                )}
              </Pressable>
            </Animated.View>

            <Pressable
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 4,
                borderColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.25)',
                opacity: capturing ? 0.6 : 1,
              }}
              onPress={capture}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.camera.shutter')}
            >
              {capturing ? (
                <ActivityIndicator color="#14452f" />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#fff',
                  }}
                />
              )}
            </Pressable>

            <Pressable
              style={iconBtnStyle}
              onPress={flipCamera}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.camera.flipCamera')}
            >
              <SwitchCamera color="#fff" size={24} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#fff',
          opacity: flashOpacity,
        }}
      />

      <LocationPrimerSheet
        visible={locationPrimer.shouldShowPrimer}
        accepting={locationPrimer.accepting}
        onAccept={locationPrimer.onAccept}
        onDecline={locationPrimer.onDecline}
      />
    </View>
  );
}
