import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { AppImage, Button, Text } from '@/components/ui';
import { PhotosCard } from '@/features/scanner/components/detail';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';

import type { ListingEditImage } from '../listingEditTypes';

interface Props {
  images: ListingEditImage[];
  onChange: (next: ListingEditImage[]) => void;
  /** Removed count, for the summary line. */
  removedCount: number;
  /** Photo edits go through review under `split`; the wording follows. */
  needsReview: boolean;
}

/**
 * The listing's photos, using the SAME `PhotosCard` the scan-detail editor uses
 * for the gallery, plus the one thing v1 adds: removal.
 *
 * `PhotosCard` already owns a single overlay action slot (`onRearrange`), so
 * "Manage photos" reuses it instead of introducing a second strip of thumbs —
 * two photo lists on one screen would be the duplicate control the UX rules
 * forbid. Adding photos is deliberately absent: the v1 contract allows deletion
 * only.
 */
export function ListingPhotosSection({ images, onChange, removedCount, needsReview }: Props) {
  const { t } = useTranslation();
  const [managing, setManaging] = useState(false);

  const photos = images.map((i) => ({ uri: i.url }));
  const atMinimum = images.length <= 1;

  const remove = (attachmentId: number) => {
    if (atMinimum) return;
    haptics.tap();
    onChange(images.filter((i) => i.attachment_id !== attachmentId));
  };

  return (
    <View className="gap-sm">
      {photos.length > 0 ? (
        <PhotosCard
          photos={photos}
          rearrangeLabel={t('mobile.listingEdit.photosManage')}
          onRearrange={() => setManaging(true)}
        />
      ) : (
        <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl">
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.listingEdit.photosNone')}
          </Text>
        </View>
      )}

      {removedCount > 0 ? (
        <Text variant="bodySm" tone="secondary" className="px-xs">
          {/* `n`, not `count` — an i18next `count` option switches on plural
              suffixes, and the non-English bundles here carry no `_one` form.
              A plain interpolation is unambiguous in all six locales. */}
          {needsReview
            ? t('mobile.listingEdit.photosRemovedReview', { n: removedCount })
            : t('mobile.listingEdit.photosRemovedInstant', { n: removedCount })}
        </Text>
      ) : null}

      <Modal
        visible={managing}
        transparent
        animationType="slide"
        onRequestClose={() => setManaging(false)}
        statusBarTranslucent
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(18,28,40,0.45)' }}>
          <View className="bg-brand-surface rounded-t-lg p-2xl gap-md" style={{ maxHeight: '80%' }}>
            <Text variant="subtitle" tone="primary">
              {t('mobile.listingEdit.photosManage')}
            </Text>
            <Text variant="bodySm" tone="tertiary">
              {atMinimum
                ? t('mobile.listingEdit.photosLastOne')
                : t('mobile.listingEdit.photosManageHint')}
            </Text>

            <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {images.map((img, idx) => (
                <View
                  key={img.attachment_id}
                  className="flex-row items-center bg-brand-surface-muted rounded-sm p-sm"
                  style={{ gap: 12 }}
                >
                  <AppImage
                    source={{ uri: img.url }}
                    style={{ width: 64, height: 48, borderRadius: 6 }}
                  />
                  <Text variant="bodySm" tone="secondary" className="flex-1" numberOfLines={1}>
                    {t('mobile.listingEdit.photoNumber', { index: idx + 1 })}
                  </Text>
                  <Pressable
                    onPress={() => remove(img.attachment_id)}
                    disabled={atMinimum}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: atMinimum }}
                    accessibilityLabel={t('mobile.listingEdit.photosRemoveA11y', {
                      index: idx + 1,
                    })}
                    className="flex-row items-center px-md py-sm rounded-xs border"
                    style={{
                      gap: 4,
                      opacity: atMinimum ? 0.4 : 1,
                      borderColor: brand.destructive,
                    }}
                  >
                    <MaterialIcons name="delete-outline" size={16} color={brand.destructive} />
                    <Text variant="caption" tone="danger" className="font-semi">
                      {t('mobile.listingEdit.photosRemove')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <Button
              label={t('mobile.listingEdit.photosDone')}
              onPress={() => setManaging(false)}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
