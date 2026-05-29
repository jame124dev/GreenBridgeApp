import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, GripVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import ReorderableList, {
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import { AppImage, Button, HStack, Screen, Text } from '@/components/ui';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { useScanDraft, type Photo } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * S6.2.b1 — StyleSheet block removed. `ReorderableList` is a 3rd-party
 * component that requires `style` + `contentContainerStyle` props (not
 * className); kept as inline objects for those two slots. Everything else
 * (header, subtitle, row, drag handle) renders via NativeWind classes.
 */
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
    <Screen scroll={false} contentContainerStyle={{ flex: 1, paddingBottom: 16 }}>
      <View className="pt-sm mb-sm">
        <HStack align="center" justify="space-between">
          <Pressable
            onPress={() => safeBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
          >
            <ChevronLeft color={brand.foreground} size={24} />
          </Pressable>
          <Text variant="subtitle" className="font-bold">
            {t('mobile.reorder.heading')}
          </Text>
          <View style={{ width: 24 }} />
        </HStack>
      </View>

      <Text variant="bodyMd" tone="tertiary" className="mb-md">
        {t('mobile.reorder.dragToReorder')}
      </Text>

      <ReorderableList
        data={ordered}
        onReorder={onReorder}
        keyExtractor={(p) => p.uri}
        contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
        style={{ flex: 1 }}
        renderItem={({ item, index }) => (
          <PhotoRow
            photo={item}
            index={index}
            label={index === 0 ? t('mobile.reorder.cover') : `#${index + 1}`}
          />
        )}
      />

      <View className="mt-sm">
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
    <Pressable
      onLongPress={drag}
      delayLongPress={180}
      className="bg-brand-surface rounded-lg border border-brand-border p-md"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Long press to reorder"
    >
      <HStack gap="xl" align="center">
        <AppImage source={{ uri: photo.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
        <Text
          variant="bodyMd"
          className={`flex-1 font-semi ${index === 0 ? 'text-brand-primary' : 'text-neutral-900'}`}
        >
          {label}
        </Text>
        <Pressable
          onLongPress={drag}
          delayLongPress={180}
          hitSlop={12}
          className="w-10 h-10 rounded-lg bg-brand-primary-surface items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Drag handle"
        >
          <GripVertical color={brand.mutedForeground} size={22} />
        </Pressable>
      </HStack>
    </Pressable>
  );
}
