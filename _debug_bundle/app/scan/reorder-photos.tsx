import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, GripVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import ReorderableList, {
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import { AppImage, Button, HStack, Screen } from '@/components/ui';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { useScanDraft, type Photo } from '@/stores/scanDraftStore';
import { colors, fonts, fontSize, radius, spacing } from '@/theme';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function ReorderPhotosScreen() {
  const { t } = useTranslation();
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
      router.replace(isEdit ? routes.scanDetail : routes.scanCamera);
    }
  }, [source, isEdit]);

  const onReorder = ({ from, to }: ReorderableListReorderEvent) =>
    setOrdered((prev) => moveItem(prev, from, to));

  const onConfirm = async () => {
    if (!ordered.length || saving) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updatePhotos(ordered);
        safeBack();
      } else {
        await start(ordered);
        clearPending();
        router.replace(routes.scanProcessing);
      }
    } catch {
      Alert.alert(t('mobile.reorder.savingTitle'), t('mobile.reorder.savingBody'));
    } finally {
      setSaving(false);
    }
  };

  if (!ordered.length) return null;

  return (
    <Screen scroll={false} contentContainerStyle={styles.screen}>
      <HStack align="center" justify="space-between" style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text style={styles.title}>{t('mobile.reorder.heading')}</Text>
        <View style={{ width: 24 }} />
      </HStack>

      <Text style={styles.subtitle}>{t('mobile.reorder.dragToReorder')}</Text>

      <ReorderableList
        data={ordered}
        onReorder={onReorder}
        keyExtractor={(p) => p.uri}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        renderItem={({ item, index }) => (
          <PhotoRow
            photo={item}
            index={index}
            label={index === 0 ? t('mobile.reorder.cover') : `#${index + 1}`}
          />
        )}
      />

      <View style={styles.confirm}>
        <Button
          label={isEdit ? t('mobile.reorder.saveOrder') : t('mobile.reorder.continueBtn')}
          onPress={onConfirm}
          loading={saving}
          fullWidth
        />
      </View>
    </Screen>
  );
}

/**
 * A draggable photo row. Long-press anywhere on the row (or grab the handle) to
 * start the drag — `useReorderableDrag()` reads the list context, so this must
 * be rendered by ReorderableList's `renderItem`.
 */
function PhotoRow({ photo, index, label }: { photo: Photo; index: number; label: string }) {
  const drag = useReorderableDrag();
  return (
    <Pressable onLongPress={drag} delayLongPress={180} style={styles.row}>
      <HStack gap="xl" align="center">
        <AppImage source={{ uri: photo.uri }} style={styles.thumb} />
        <Text style={[styles.indexLabel, index === 0 && styles.coverLabel]}>{label}</Text>
        <Pressable onLongPress={drag} delayLongPress={180} hitSlop={12} style={styles.dragHandle}>
          <GripVertical color={colors.mutedForeground} size={22} />
        </Pressable>
      </HStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: spacing['3xl'] },
  header: { paddingTop: spacing.md, marginBottom: spacing.md },
  title: { fontFamily: fonts.heading, fontSize: fontSize['3xl'], color: colors.foreground },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.mutedForeground,
    marginBottom: spacing['3xl'],
  },
  list: { flex: 1 },
  listContent: { gap: spacing.lg, paddingBottom: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  indexLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  coverLabel: { color: colors.primary },
  dragHandle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: { marginTop: spacing.lg },
});
