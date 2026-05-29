import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppImage, Sheet, Text } from '@/components/ui';
import type { MappedProduct } from '@/features/scanner/smartDetectionTypes';
import type { Photo } from '@/stores/scanDraftStore';

interface Props {
  visible: boolean;
  /** Index of the product the photo is currently in. */
  fromProductIndex: number;
  products: MappedProduct[];
  photos: Photo[];
  /** Called with the destination product index. */
  onMove: (toProductIndex: number) => void;
  onClose: () => void;
}

/**
 * W5 (scan_v3) — Move-photo destination picker. Opens when the seller taps
 * a thumbnail in step 1 of the detection wizard. Lists every OTHER product
 * group (the source group is filtered out — you can't "move" a photo to
 * its current group). Each row shows the destination group's title + photo
 * count + first-photo thumbnail.
 *
 * Web parity: web uses HTML5 drag-and-drop between groups; mobile uses
 * tap-then-pick. Same end state, friendlier on touch + accessible without
 * gestural skill.
 */
export function MoveToGroupSheet({
  visible,
  fromProductIndex,
  products,
  photos,
  onMove,
  onClose,
}: Props) {
  const { t } = useTranslation();

  // List every product except the source. Preserve original indexes for the
  // move callback (the label uses the visible position but the data carries
  // the canonical product index).
  const destinations = products
    .map((p, idx) => ({ product: p, idx }))
    .filter(({ idx }) => idx !== fromProductIndex);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.detection.moveToGroupTitle', {
        defaultValue: 'Move photo to…',
      })}
      subtitle={t('mobile.detection.moveToGroupSubtitle', {
        defaultValue: 'Pick the group this photo belongs to.',
      })}
      snapTo="60%"
    >
      {destinations.length === 0 ? (
        <View className="px-lg py-md">
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.detection.moveToGroupEmpty', {
              defaultValue: 'No other groups available.',
            })}
          </Text>
        </View>
      ) : (
        destinations.map(({ product, idx }) => {
          const heroIdx = product.imageIndexes[0];
          const heroPhoto = heroIdx !== undefined ? photos[heroIdx] : undefined;
          const title =
            product.fields.title?.trim() ||
            t('mobile.detection.untitledProduct', {
              defaultValue: 'Product #{{n}}',
              n: idx + 1,
            });
          const photoCount = product.imageIndexes.length;
          return (
            <Sheet.Option
              key={`dest-${idx}`}
              label={title}
              description={t('mobile.detection.photosCount', {
                defaultValue: '{{count}} photo(s)',
                count: photoCount,
              })}
              onPress={() => onMove(idx)}
              rightAdornment={
                heroPhoto ? (
                  <AppImage
                    source={{ uri: heroPhoto.uri }}
                    style={{ width: 36, height: 36, borderRadius: 6 }}
                    contentFit="cover"
                  />
                ) : null
              }
            />
          );
        })
      )}
    </Sheet>
  );
}
