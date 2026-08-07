import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { AppImage } from '@/components/ui';
import { PhotoZoomViewer } from '@/components/scanner/PhotoZoomViewer';
import { brand } from '@/constants/theme';

interface Props {
  photos: { uri: string; sourceLabel?: string }[];
  rearrangeLabel: string;
  /** Omit to HIDE the control. A visible button that only says "coming soon" is
   *  a Guideline 2.1 (App Completeness) rejection risk — Apple treats
   *  placeholder features as an unfinished app. Screens without a real
   *  implementation must not render the affordance at all. */
  onRearrange?: () => void;
  onAddMore?: () => void;
}

/**
 * Hero gallery: a 16:9 cover image with a counter + Rearrange overlay, plus a
 * horizontal thumbnail strip ending in an "ADD MORE" tile.
 *
 * S6.2.b2.i — converted to NativeWind. Thumb dimensions (96×54), counter
 * overlay color (rgba(18,28,40,0.6)), and ScrollView contentContainerStyle
 * kept inline because the Tailwind scale doesn't carry those values.
 */
export function PhotosCard({ photos, rearrangeLabel, onRearrange, onAddMore }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!photos.length) return null;

  const activeIdx = Math.min(active, photos.length - 1);
  const heroW = width - 16 * 2;
  const heroH = Math.round((heroW * 9) / 16);

  return (
    <View className="gap-sm">
      <View className="rounded-sm overflow-hidden border border-brand-border-strong bg-brand-surface">
        <Pressable
          onPress={() => setViewerIndex(activeIdx)}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('mobile.detail.viewPhoto', {
            defaultValue: 'View photo {{idx}} of {{total}}',
            idx: activeIdx + 1,
            total: photos.length,
          })}
        >
          <AppImage source={{ uri: photos[activeIdx].uri }} style={{ width: '100%', height: heroH }} />
        </Pressable>
        <View
          className="absolute top-2.5 left-2.5 rounded-pill px-sm flex-row items-center"
          style={{ backgroundColor: 'rgba(18, 28, 40, 0.6)', paddingVertical: 2, gap: 6 }}
        >
          <Text className="font-label-medium text-base text-white">
            {activeIdx + 1}/{photos.length}
          </Text>
          {/* P4 — office-doc origin caption (e.g. "sheet 仁義廠", "slide 3").
              Hidden for camera captures and PDF pages (sourceLabel undefined). */}
          {photos[activeIdx]?.sourceLabel ? (
            <Text
              className="font-label-medium text-base text-white"
              style={{ opacity: 0.85, maxWidth: 180 }}
              numberOfLines={1}
            >
              · {photos[activeIdx].sourceLabel}
            </Text>
          ) : null}
        </View>
        {onRearrange ? (
        <Pressable
          className="absolute top-2.5 right-2.5 flex-row items-center gap-xs bg-brand-surface border border-brand-border-strong rounded-xs px-sm"
          style={{ paddingVertical: 6 }}
          onPress={onRearrange}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={rearrangeLabel}
        >
          <MaterialIcons name="photo-library" size={16} color={brand.primary} />
          <Text className="font-label text-base text-brand-primary" numberOfLines={1}>
            {rearrangeLabel}
          </Text>
        </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {photos.map((p, i) => (
          <Pressable
            key={p.uri}
            onPress={() => setActive(i)}
            className={`rounded-xs overflow-hidden border ${i === activeIdx ? 'border-2 border-brand-primary' : 'border-brand-border-strong'}`}
            style={{ width: 96, height: 54 }}
            accessibilityRole="radio"
            accessibilityState={{ selected: i === activeIdx }}
            accessibilityLabel={t('mobile.detail.selectThumb', {
              defaultValue: 'Select photo {{idx}}',
              idx: i + 1,
            })}
            // P4 polish — office-doc origin label for screen readers browsing
            // the thumb strip (96×54 too small for visible caption; hero overlay
            // shows the visible version when this thumb becomes active).
            accessibilityHint={p.sourceLabel}
          >
            <AppImage source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} />
          </Pressable>
        ))}
        {onAddMore ? (
        <Pressable
          className="rounded-xs border border-brand-border-strong border-dashed items-center justify-center gap-xxs"
          style={{ width: 96, height: 54 }}
          onPress={onAddMore}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.detail.addMorePhotos', { defaultValue: 'Add more photos' })}
        >
          <MaterialIcons name="add-a-photo" size={20} color={brand.textMuted} />
          <Text className="font-label text-brand-text-muted" style={{ fontSize: 9, letterSpacing: 0.5 }}>
            {t('mobile.detail.addMore', { defaultValue: 'ADD MORE' })}
          </Text>
        </Pressable>
        ) : null}
      </ScrollView>

      <PhotoZoomViewer
        visible={viewerIndex !== null}
        photos={photos}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}
