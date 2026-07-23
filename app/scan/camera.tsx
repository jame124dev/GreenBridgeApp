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
import { X, Zap, ZapOff, SwitchCamera, FolderOpen, FileText } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
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
/**
 * Document picked from the device — anything that isn't an image (PDFs,
 * Word, Excel, .txt, etc.). Shape matches `DraftItem.documents` in the
 * scan-draft store so the array can be patched in directly at submit time.
 */
type DraftDoc = { uri: string; name: string; mimeType: string };

/**
 * Pre-emptively flatten a picked document's filename to an ASCII-safe form.
 *
 * Why: RN's native multipart FormData on Android URL-encodes the filename
 * in the `Content-Disposition` header (e.g. space → `%20`, `(` → `%28`).
 * The backend's parser then stores that *encoded* string as the literal GCS
 * object name. When we later send the returned `url` to smart-detect, GCS
 * unescapes `%20` back to a space and 404s because the stored object has
 * the literal three-character `%20` in its name. Stripping non-safe chars
 * before upload makes the round-trip identity, no encoding involved.
 *
 * Real example: `"TRENNJAEGER (1).pdf"` → `"TRENNJAEGER_1.pdf"`.
 */
function safeDocumentName(rawName: string): string {
  let s = (rawName || '').trim();
  try {
    // If the picker already gave us a URL-encoded name (some Android
    // ContentResolvers do), decode first so we don't double-mangle.
    s = decodeURIComponent(s);
  } catch {
    // Malformed % sequence — keep the original string.
  }
  let safe = s.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
  const dot = safe.lastIndexOf('.');
  if (dot <= 0) return safe || 'document';
  const base = safe.slice(0, dot).replace(/^_+|_+$/g, '') || 'document';
  return base + safe.slice(dot);
}

/**
 * P3 — per-mime size cap (bytes). Mirrors backend per-mime caps in
 * `controller/wordPressSmart.js:2534-2548` and `services/officeDocs.js`.
 * Returns `null` for unknown extensions so the picker doesn't second-guess
 * — server-side classification handles those.
 */
const CAP_BY_EXT: Record<string, number> = {
  '.docx': 25 * 1024 * 1024,
  '.pptx': 25 * 1024 * 1024,
  '.xlsx': 50 * 1024 * 1024,
  '.csv': 50 * 1024 * 1024,
  '.pdf': 50 * 1024 * 1024,
};

function capForFile(name: string | undefined, _size: number | undefined): number | null {
  if (!name) return null;
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = name.slice(dot).toLowerCase();
  return CAP_BY_EXT[ext] ?? null;
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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
  // Documents picked from the device (PDFs, Word, Excel, etc.). Carried into
  // the draft at submit time so they ship alongside the listing's photos.
  // Images selected via the same picker are compressed and merged into
  // `photos` instead — same flow as the camera-captured ones.
  const [docs, setDocs] = useState<DraftDoc[]>([]);
  const [picking, setPicking] = useState(false);
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

  /**
   * Open the system file picker (DocumentPicker) — accepts any file type
   * since the user asked for "all document files and images". Images get
   * routed into `photos` (same compressed shape as camera captures) so the
   * AI pipeline sees them just like a captured shot. Anything else lands in
   * `docs` and ships as a draft document attachment.
   *
   * `multiple: true` so the user can grab a batch in one trip; cancellations
   * and per-file failures are swallowed silently except for a "nothing
   * picked" path that posts a brief Alert.
   */
  const pickFiles = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const newPhotos: Photo[] = [];
      const newDocs: DraftDoc[] = [];
      const oversize: { name: string; size: number; limit: number }[] = [];

      for (const asset of result.assets) {
        const isImage =
          (asset.mimeType ?? '').toLowerCase().startsWith('image/') ||
          /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(asset.name ?? '');
        if (isImage) {
          try {
            const compressed = await compressPhoto(asset.uri);
            newPhotos.push({
              uri: compressed.uri,
              width: compressed.width,
              height: compressed.height,
              sizeBytes: compressed.sizeBytes,
            });
          } catch {
            // Skip files that fail compression — the picker can return
            // odd content URIs that ImageManipulator chokes on. Other
            // picks in the same batch should still go through.
          }
        } else {
          // P3 — mime-aware client-side size pre-flight (Phase 2 office docs).
          // Mirrors backend per-mime caps at
          // `controller/wordPressSmart.js:2534-2548` so users get a fast local
          // rejection instead of waiting through an upload + non-fatal SSE.
          // Server is still authoritative; this is a UX optimization, not a
          // security boundary.
          const limit = capForFile(asset.name, asset.size);
          if (limit != null && typeof asset.size === 'number' && asset.size > limit) {
            oversize.push({ name: asset.name || 'document', size: asset.size, limit });
            continue;
          }
          newDocs.push({
            uri: asset.uri,
            name: safeDocumentName(asset.name || 'document'),
            mimeType: asset.mimeType || 'application/octet-stream',
          });
        }
      }

      if (newPhotos.length) {
        setPhotos((prev) => [...prev, ...newPhotos]);
        popChip();
      }
      if (newDocs.length) {
        setDocs((prev) => [...prev, ...newDocs]);
      }
      if (oversize.length === 1) {
        const o = oversize[0];
        Alert.alert(
          t('mobile.camera.docTooLargeTitle', { defaultValue: 'File too large' }),
          t('mobile.camera.docTooLargeBody', {
            name: o.name,
            size: humanBytes(o.size),
            limit: humanBytes(o.limit),
            defaultValue: `${o.name} is ${humanBytes(o.size)} — over the ${humanBytes(o.limit)} limit for this format. Save as a smaller file and try again.`,
          }),
        );
      } else if (oversize.length > 1) {
        Alert.alert(
          t('mobile.camera.docTooLargeTitle', { defaultValue: 'File too large' }),
          t('mobile.camera.docMultipleTooLargeBody', {
            count: oversize.length,
            defaultValue: `${oversize.length} files were over their size limit and were skipped. The largest cap is 50 MB (DOCX/PPTX is 25 MB).`,
          }),
        );
      } else if (!newPhotos.length && !newDocs.length) {
        Alert.alert(
          t('mobile.camera.pickFailedTitle', { defaultValue: 'Could not add files' }),
          t('mobile.camera.pickFailedBody', {
            defaultValue: 'The selected files could not be processed.',
          }),
        );
      }
    } catch {
      haptics.error();
      Alert.alert(
        t('mobile.camera.pickFailedTitle', { defaultValue: 'Could not add files' }),
        t('mobile.camera.pickFailedBody', {
          defaultValue: 'The selected files could not be processed.',
        }),
      );
    } finally {
      setPicking(false);
    }
  };

  const removeDoc = (index: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const onNext = async () => {
    // Photos OR documents (or both) can proceed — backend smart-detect now
    // analyzes PDF page-images alongside captured photos. Docs-only is no
    // longer a manual-entry shortcut: processing.tsx + useSmartDetect
    // handle the docs-only path by uploading PDFs to GCS and passing
    // `document_urls` to /wp/analyze-smart-detection (mirrors web).
    if (starting) return;
    if (photos.length === 0 && docs.length === 0) return;
    setStarting(true);
    try {
      await useScanDraft.getState().start(photos);
      if (docs.length > 0) {
        useScanDraft.getState().patch({ documents: docs });
      }
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
        autofocus="on"
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

          {/* TIP pill — rides the TOP edge of the bracket rectangle so it
              reads as a label for the focus area rather than floating in
              the middle. JetBrains Mono caps for the technical feel that
              matches the rest of the brand. Only shows when no photos. */}
          {photos.length === 0 ? (
            <View
              className="flex-row items-center"
              style={{
                position: 'absolute',
                top: -14,
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderRadius: 999,
                maxWidth: '95%',
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 10,
                  letterSpacing: 0.8,
                }}
                numberOfLines={1}
              >
                {`${t('mobile.camera.tipStrong').toUpperCase()} ${t('mobile.camera.tipText').toUpperCase().trim()}`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingBottom: 24, paddingHorizontal: 20, gap: 12 }}>
          {/* Unified attachments strip — photo thumbnails AND document chips
              live in ONE horizontal scroll, with the emerald NEXT button
              pinned to the right edge. Previously this was two separate
              strips (docs above, photos below) which felt noisy; combining
              them communicates "this is your captured stack" with a single
              visual unit. Only renders when there's something to show OR
              when zero — falls back to the zeroHint text. */}
          {photos.length > 0 || docs.length > 0 ? (
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.55)',
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
                  contentContainerStyle={{ gap: 8, alignItems: 'center' }}
                >
                  {/* Photos first — thumbnails with a small × overlay. */}
                  {photos.map((p, i) => (
                    <View key={p.uri} style={{ position: 'relative' }}>
                      <AppImage
                        source={{ uri: p.uri }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.6)',
                        }}
                      />
                      <Pressable
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.5)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => removePhoto(i)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.common.remove', { defaultValue: 'Remove photo' })}
                      >
                        <X color="#fff" size={11} strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ))}

                  {/* Documents after — file chips inline with the thumbs. */}
                  {docs.map((d, i) => (
                    <View
                      key={`${d.uri}-${i}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        height: 56,
                        paddingLeft: 10,
                        paddingRight: 6,
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 10,
                        maxWidth: 160,
                      }}
                    >
                      <FileText color="#fff" size={16} />
                      <Text
                        numberOfLines={1}
                        style={{
                          color: '#fff',
                          fontFamily: fonts.semibold,
                          fontSize: 12,
                          flexShrink: 1,
                        }}
                      >
                        {d.name}
                      </Text>
                      <Pressable
                        onPress={() => removeDoc(i)}
                        hitSlop={6}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.camera.removeDoc', {
                          defaultValue: 'Remove document',
                        })}
                      >
                        <X color="#fff" size={11} strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>

                {/* Primary forward action — emerald capsule. Only enabled
                    when we have at least one photo (AI flow requires it). */}
                <Pressable
                  style={{
                    flexShrink: 0,
                    minWidth: 88,
                    backgroundColor: '#00B289',
                    paddingHorizontal: 16,
                    paddingVertical: 11,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: starting ? 0.5 : 1,
                  }}
                  onPress={onNext}
                  disabled={starting}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('mobile.common.next')} · ${photos.length + docs.length}`}
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
          ) : null}

          {/* Bottom control row — three buttons sharing the same visual
              vocabulary as the top bar (close + flash use the same round
              translucent circles). Labels removed; the icons (folder for
              files, switch-camera for flip) are universally read in
              camera UIs. Removing the dark squares + caps labels drops
              the visual weight that made the previous iteration feel
              "off" against the camera feed. */}
          <View
            className="flex-row items-center justify-between"
            style={{ paddingHorizontal: 8 }}
          >
            {/* LEFT: Add files — same iconBtnStyle as the top-bar close
                and flash buttons. The Animated.View carries popChip's
                bounce on a successful pick. */}
            <Animated.View style={{ transform: [{ scale: chipScale }] }}>
              <Pressable
                style={{ ...iconBtnStyle, opacity: picking ? 0.6 : 1 }}
                onPress={pickFiles}
                disabled={picking}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.camera.pickFiles', {
                  defaultValue: 'Add files',
                })}
                accessibilityHint={t('mobile.camera.pickFilesHint', {
                  defaultValue:
                    'PDF, DOCX, PPTX, XLSX, CSV — DOCX/PPTX up to 25 MB, others up to 50 MB',
                })}
              >
                {picking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <FolderOpen color="#fff" size={22} />
                )}
              </Pressable>
            </Animated.View>

            {/* CENTER: Shutter — large white-bordered ring, visually
                dominates the row. No label. */}
            <Pressable
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
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
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#fff',
                  }}
                />
              )}
            </Pressable>

            {/* RIGHT: Flip camera — same iconBtnStyle as the left. */}
            <Pressable
              style={iconBtnStyle}
              onPress={flipCamera}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.camera.flipCamera')}
            >
              <SwitchCamera color="#fff" size={22} />
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
