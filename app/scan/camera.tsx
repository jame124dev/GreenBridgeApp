import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Zap, ZapOff, SwitchCamera } from 'lucide-react-native';

import { routes } from '@/lib/routes';
import { compressPhoto } from '@/services/upload/compress';
import { useScanDraft } from '@/stores/scanDraftStore';
import type { Photo } from '@/stores/scanDraftStore';

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [starting, setStarting] = useState(false);
  const setPendingPhotos = useScanDraft((s) => s.setPendingPhotos);

  if (!permission) {
    return <View style={styles.centered} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionBox}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>
          Allow camera access to scan equipment nameplates and photos.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.linkText}>Open settings</Text>
        </Pressable>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
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
    } catch {
      Alert.alert('Capture failed', 'Could not take photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const onNext = async () => {
    if (photos.length === 0 || starting) return;
    if (photos.length > 1) {
      setStarting(true);
      try {
        await setPendingPhotos(photos);
        router.push(routes.scanReorderPhotos);
      } catch {
        Alert.alert('Could not save photos', 'Please try again.');
      } finally {
        setStarting(false);
      }
      return;
    }
    setStarting(true);
    useScanDraft
      .getState()
      .start(photos)
      .then(() => router.push(routes.scanProcessing))
      .catch(() => Alert.alert('Could not save photos', 'Please try again.'))
      .finally(() => setStarting(false));
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={flash}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <X color="#fff" size={24} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable onPress={() => setFlash((f) => !f)} style={styles.iconBtn}>
              {flash ? <Zap color="#fff" size={22} /> : <ZapOff color="#fff" size={22} />}
            </Pressable>
            <Pressable
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              style={styles.iconBtn}
            >
              <SwitchCamera color="#fff" size={22} />
            </Pressable>
          </View>
        </View>

        {photos.length > 0 ? (
          <ScrollView horizontal style={styles.thumbStrip} contentContainerStyle={styles.thumbContent}>
            {photos.map((p, i) => (
              <View key={p.uri} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Pressable style={styles.thumbRemove} onPress={() => removePhoto(i)}>
                  <X color="#fff" size={14} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.bottomBar}>
          <Pressable
            style={[styles.shutter, capturing && styles.shutterDisabled]}
            onPress={capture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#0a4a2f" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>

          <Pressable
            style={[styles.nextBtn, (photos.length === 0 || starting) && styles.nextDisabled]}
            onPress={onNext}
            disabled={photos.length === 0 || starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>Next ({photos.length})</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbStrip: { maxHeight: 88, marginBottom: 8 },
  thumbContent: { paddingHorizontal: 16, gap: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  bottomBar: { alignItems: 'center', paddingBottom: 24, gap: 16 },
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
  nextBtn: {
    backgroundColor: '#0a4a2f',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextDisabled: { opacity: 0.4 },
  nextText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  permissionBox: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#13171f' },
  permissionText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#6b7280', textAlign: 'center', marginVertical: 16 },
  primaryBtn: { backgroundColor: '#0a4a2f', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  linkText: { color: '#0a4a2f', fontFamily: 'Inter_600SemiBold', marginTop: 16 },
  closeBtn: { marginTop: 8 },
});
