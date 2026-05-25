import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDown, ArrowUp, ChevronLeft } from 'lucide-react-native';

import { routes } from '@/lib/routes';
import { useScanDraft, type Photo } from '@/stores/scanDraftStore';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function ReorderPhotosScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === 'edit';
  const pending = useScanDraft((s) => s.pendingPhotos);
  const draft = useScanDraft((s) => s.current);
  const start = useScanDraft((s) => s.start);
  const updatePhotos = useScanDraft((s) => s.updatePhotos);
  const clearPending = useScanDraft((s) => s.clearPendingPhotos);

  const source = isEdit ? draft?.photos : pending;
  const [ordered, setOrdered] = useState<Photo[]>(() => (source ? [...source] : []));
  const [prevSource, setPrevSource] = useState(source);
  const [saving, setSaving] = useState(false);

  if (source !== prevSource) {
    setPrevSource(source);
    setOrdered(source ? [...source] : []);
  }

  useEffect(() => {
    if (!source?.length) {
      router.replace(isEdit ? routes.scanReview : routes.scanCamera);
    }
  }, [source, isEdit]);

  const moveUp = (index: number) => {
    setOrdered((prev) => moveItem(prev, index, index - 1));
  };

  const moveDown = (index: number) => {
    setOrdered((prev) => moveItem(prev, index, index + 1));
  };

  const onConfirm = async () => {
    if (!ordered.length || saving) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updatePhotos(ordered);
        router.back();
      } else {
        await start(ordered);
        clearPending();
        router.replace(routes.scanProcessing);
      }
    } catch {
      Alert.alert('Could not save photos', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!ordered.length) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color="#13171f" size={24} />
        </Pressable>
        <Text style={styles.title}>Rearrange photos</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.subtitle}>First photo is the main listing image.</Text>

      <View style={styles.list}>
        {ordered.map((p, index) => (
          <View key={`${p.uri}-${index}`} style={styles.row}>
            <Image source={{ uri: p.uri }} style={styles.thumb} />
            <Text style={styles.indexLabel}>{index === 0 ? 'Cover' : `#${index + 1}`}</Text>
            <View style={styles.moveBtns}>
              <Pressable
                style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}
                onPress={() => moveUp(index)}
                disabled={index === 0}
              >
                <ArrowUp color="#0a4a2f" size={20} />
              </Pressable>
              <Pressable
                style={[styles.moveBtn, index === ordered.length - 1 && styles.moveBtnDisabled]}
                onPress={() => moveDown(index)}
                disabled={index === ordered.length - 1}
              >
                <ArrowDown color="#0a4a2f" size={20} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.confirm, saving && styles.confirmDisabled]}
        onPress={onConfirm}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmText}>{isEdit ? 'Save order' : 'Continue'}</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb', paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 8,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#13171f' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6b7280', marginBottom: 16 },
  list: { flex: 1, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    padding: 10,
    gap: 12,
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  indexLabel: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#13171f' },
  moveBtns: { flexDirection: 'row', gap: 8 },
  moveBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f4f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: { opacity: 0.35 },
  confirm: {
    backgroundColor: '#0a4a2f',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmDisabled: { opacity: 0.6 },
  confirmText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
