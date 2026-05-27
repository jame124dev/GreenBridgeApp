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
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { compressPhoto } from '@/services/upload/compress';
import { useScanDraft } from '@/stores/scanDraftStore';
import type { Photo } from '@/stores/scanDraftStore';

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
  // Tap-to-refocus ring. NOTE: expo-camera's CameraView has no point-of-interest
  // focus API (only `autofocus` on/off + `focusDistance`), so this ring is
  // responsiveness feedback — actual focus is continuous AF (autofocus="off").
  // True point focus would need react-native-vision-camera.
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);
  const [focusAnim] = useState(() => new Animated.Value(0));

  // Capture feedback (RN Animated, native driver — no Reanimated babel plugin
  // dependency, so it can't fail at launch). `flashOpacity` drives a brief
  // white full-screen flash; `chipScale` pops the gallery chip when a new
  // photo lands, so multi-shot scanning feels responsive.
  // Lazy useState init holds a stable Animated.Value without a render-phase
  // ref read (the React Compiler rejects `useRef(...).current` in render).
  const [flashOpacity] = useState(() => new Animated.Value(0));
  const [chipScale] = useState(() => new Animated.Value(1));

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
    setZoom(0); // reset zoom on flip — front/rear have different ranges
    setFacing((f) => {
      const next = f === 'back' ? 'front' : 'back';
      // Front camera has no torch — clear flash so the state doesn't lie.
      if (next === 'front') setFlash(false);
      return next;
    });
  };

  // Tap-to-refocus: shows a ring where the user tapped + a light haptic.
  // expo-camera focuses continuously (autofocus="off"); this is the visible
  // acknowledgement, not a point-of-interest focus (unsupported by the SDK).
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

  // Preview gestures: single tap → refocus ring, vertical slide → zoom.
  // (Double-tap-to-flip was dropped — low value for equipment capture, it risked
  // accidental flips to the unused front camera, and removing it lets the tap
  // refocus fire immediately instead of waiting for a double-tap to fail.)
  // expo-camera's `zoom` is 0–1; ~400px of travel = full range. Per-frame
  // functional setState (no ref) — a ref-based throttle trips the project's
  // `react-hooks/refs` rule, and Reanimated isn't wired, so this is the
  // lint-clean approach. Callbacks run on the JS thread (`runOnJS`).
  const zoomPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onChange((e) => {
      // The `zoom` effect drives the pill's show/auto-hide — no ref needed here.
      setZoom((prev) => Math.min(1, Math.max(0, prev - e.changeY / 400)));
    });

  const focusTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .runOnJS(true)
    .onEnd((e) => showFocusRing(e.x, e.y));

  // Tap (refocus) vs. drag (zoom) — Exclusive lets a clear tap win, a drag zoom.
  const previewGesture = Gesture.Exclusive(focusTapGesture, zoomPanGesture);

  if (!permission) {
    return <View style={styles.centered} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionBox}>
        <Text style={styles.permissionTitle}>{t('mobile.camera.permissionTitle')}</Text>
        <Text style={styles.permissionText}>{t('mobile.camera.permissionText')}</Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>{t('mobile.camera.allowCamera')}</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.linkText}>{t('mobile.camera.openSettings')}</Text>
        </Pressable>
        <Pressable style={styles.closeBtn} onPress={() => safeBack()}>
          <Text style={styles.linkText}>{t('mobile.common.cancel')}</Text>
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

  // NEXT goes straight to AI analysis (processing → review) for any photo count.
  // The rearrange/reorder step is no longer in this path — reordering & cover
  // selection still live in the Detail photo carousel, so nothing is lost.
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
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={flash}
        zoom={zoom}
        autofocus="off"
      />

      {/* Transparent gesture catcher over the preview — sits below the controls
          (the overlay is box-none, so taps on actual buttons take priority and
          only preview-area gestures reach here). */}
      <GestureDetector gesture={previewGesture}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />
      </GestureDetector>

      {/* Zoom level pill — visible whenever zoomed in (hidden at 1×). Percent of
          the 0–1 zoom range (expo-camera doesn't expose a real optical factor).
          Derived straight from `zoom` → no state/effect/ref (keeps the gesture
          handler clear of the React Compiler ref + effect-setState rules). */}
      {zoom > 0 ? (
        <View pointerEvents="none" style={styles.zoomPillWrap}>
          <View style={styles.zoomPill}>
            <Text style={styles.zoomPillText}>{`ZOOM · ${Math.round(zoom * 100)}%`}</Text>
          </View>
        </View>
      ) : null}

      {/* Tap-to-refocus ring — pure feedback (continuous AF does the focusing). */}
      {focusRing ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.focusRing,
            {
              left: focusRing.x - 36,
              top: focusRing.y - 36,
              opacity: focusAnim,
              transform: [
                { scale: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] }) },
              ],
            },
          ]}
        />
      ) : null}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* Minimal top bar — just close + flash float over the preview (WhatsApp
            style). Title removed; flip moved to the bottom cluster. */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => safeBack()}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.common.cancel')}
          >
            <X color="#fff" size={22} />
          </Pressable>
          {/* Torch only works on the rear camera — hide the toggle on the
              front-facing camera so it isn't a dead control. */}
          {facing === 'back' ? (
            <Pressable
              onPress={() => setFlash((f) => !f)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={flash ? t('mobile.camera.flashOn') : t('mobile.camera.flashOff')}
            >
              {flash ? <Zap color="#fff" size={20} /> : <ZapOff color="#fff" size={20} />}
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        {/* Viewfinder bracket overlay (v7) — 4 L-shaped corner marks */}
        <View pointerEvents="none" style={styles.viewfinder}>
          <View style={[styles.bracket, styles.bracketTL]} />
          <View style={[styles.bracket, styles.bracketTR]} />
          <View style={[styles.bracket, styles.bracketBL]} />
          <View style={[styles.bracket, styles.bracketBR]} />

          {/* Nameplate guidance — TIP pill only while no photos yet. Once
              photos exist, guidance moves into the capture tray below so it
              never overlaps the thumbnails. */}
          {photos.length === 0 ? (
            <View style={styles.tipPill}>
              <Text style={styles.tipPillStrong}>{t('mobile.camera.tipStrong')}</Text>
              <Text style={styles.tipPillText}>{t('mobile.camera.tipText')}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom group — capture tray (when photos exist) sits directly above
            the control cluster, both anchored to the bottom. */}
        <View style={styles.bottomArea}>
          {photos.length > 0 ? (
            <View style={styles.tray}>
              {/* Tray = review strip (left, scrolls) + an explicit NEXT button
                  (right). The button is the clear "I'm done, continue" affordance
                  that appears the moment a photo exists — so the seller never has
                  to guess that the corner chip advances. Thumbnails are review
                  only now (✕ removes); advancing is the button + the chip. */}
              <View style={styles.trayRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.trayScroll}
                  contentContainerStyle={styles.thumbContent}
                >
                  {photos.map((p, i) => (
                    <View key={p.uri} style={styles.thumbWrap}>
                      <AppImage source={{ uri: p.uri }} style={styles.thumb} />
                      <Pressable
                        style={styles.thumbRemove}
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
                  style={[styles.continueBtn, starting && styles.continueBtnDisabled]}
                  onPress={onNext}
                  disabled={starting}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('mobile.common.next')} · ${photos.length}`}
                >
                  {starting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.continueBtnText}>{t('mobile.common.next')}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.zeroHint}>{t('mobile.camera.zeroHint')}</Text>
          )}

          {/* Control cluster — thumbnail-count chip (advance) · shutter (hero)
              · flip. WhatsApp-symmetric; the chip replaces the old NEXT. */}
          <View style={styles.clusterRow}>
            {/* Left — last photo + count; tap to advance. Dimmed glyph at zero.
                Wrapped in Animated.View so it pops when a new photo lands. */}
            <Animated.View style={{ transform: [{ scale: chipScale }] }}>
            <Pressable
              style={[styles.galleryChip, photos.length === 0 && styles.galleryChipEmpty]}
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
                    style={styles.galleryChipImg}
                  />
                  <View style={styles.galleryChipBadge}>
                    <Text style={styles.galleryChipBadgeText}>{photos.length}</Text>
                  </View>
                </>
              ) : (
                <Images color="rgba(255,255,255,0.5)" size={24} />
              )}
            </Pressable>
            </Animated.View>

            {/* Center — shutter (hero) */}
            <Pressable
              style={[styles.shutter, capturing && styles.shutterDisabled]}
              onPress={capture}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.camera.shutter')}
            >
              {capturing ? (
                <ActivityIndicator color="#14452f" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>

            {/* Right — flip front/rear (double-tap on preview does this too) */}
            <Pressable
              style={styles.iconBtn}
              onPress={flipCamera}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.camera.flipCamera')}
            >
              <SwitchCamera color="#fff" size={24} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Shutter flash — brief white blink on capture. Topmost + non-interactive. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { opacity: flashOpacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' },
  focusRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  zoomPillWrap: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  zoomPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  zoomPillText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  centered: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Viewfinder + feedback pill (v7)
  viewfinder: {
    position: 'absolute',
    top: '15%',
    left: '8%',
    right: '8%',
    bottom: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  bracketTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  bracketTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bracketBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  bracketBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    maxWidth: '90%',
  },
  tipPillStrong: { color: '#fff', fontFamily: fonts.bold, fontSize: 12 },
  tipPillText: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12 },
  zeroHint: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 12,
    marginBottom: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbContent: { gap: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  // Bottom group — capture tray + control cluster, anchored together.
  bottomArea: { paddingBottom: 24, paddingHorizontal: 20, gap: 12 },
  tray: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  trayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trayScroll: { flex: 1 },
  continueBtn: {
    flexShrink: 0,
    minWidth: 84,
    backgroundColor: '#14452f',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  // Left thumbnail-count chip (replaces the old NEXT button)
  galleryChip: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  galleryChipEmpty: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  galleryChipImg: { width: '100%', height: '100%' },
  galleryChipBadge: {
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
  },
  galleryChipBadgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 11 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  permissionBox: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionTitle: { fontFamily: fonts.bold, fontSize: 22, color: '#121c28' },
  permissionText: { fontFamily: fonts.regular, fontSize: 15, color: '#6b7280', textAlign: 'center', marginVertical: 16 },
  primaryBtn: { backgroundColor: '#14452f', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontFamily: fonts.semibold },
  linkText: { color: '#14452f', fontFamily: fonts.semibold, marginTop: 16 },
  closeBtn: { marginTop: 8 },
});
