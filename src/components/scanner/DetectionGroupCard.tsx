import { Pressable, ScrollView, View } from 'react-native';

import { AppImage, Text } from '@/components/ui';
import type { Photo } from '@/stores/scanDraftStore';

type Props = {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  /**
   * Optional thumbnail strip rendered inside the card — used by the "multiple
   * products" option to let users sanity-check the AI grouping before
   * committing. Pass an array of arrays (one inner array per detected group)
   * for the multi card; omit for the single card.
   */
  groupThumbs?: Photo[][];
};

/**
 * Radio-card primitive for `scan/detection.tsx`. Two of these stack — single
 * vs multi. The multi variant carries a per-group horizontal thumb strip so
 * users can visually verify the AI's grouping (per §2.2 plan).
 *
 * Selection is a controlled prop, not local — the parent screen owns the
 * radio group and applies `forceMode` on Continue.
 *
 * S6.2.a — StyleSheet block converted to NativeWind classes. The `Pressable`
 * style prop accepts a function with `({ pressed })` — kept as inline style
 * for the `opacity-95` pressed feedback because className doesn't compose
 * cleanly with the pressed-callback signature. The `brand-*` classes here
 * come from `tailwind.config.js`'s brand extension (me_plan W6).
 */
export function DetectionGroupCard({
  selected,
  onSelect,
  title,
  description,
  groupThumbs,
}: Props) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => (pressed ? { opacity: 0.95 } : null)}
      className={`rounded-xl border-2 p-md bg-brand-surface ${
        selected ? 'bg-brand-primary-surface border-brand-primary' : 'border-brand-border'
      }`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      <View className="flex-row items-start gap-md">
        <View
          className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center mt-[2px] ${
            selected ? 'border-brand-primary' : 'border-brand-border'
          }`}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {selected ? (
            <View className="w-[10px] h-[10px] rounded-full bg-brand-primary" />
          ) : null}
        </View>
        <View className="flex-1">
          <Text variant="bodyMd" className="font-bold text-neutral-900">
            {title}
          </Text>
          <Text variant="bodySm" className="text-neutral-500 mt-xs">
            {description}
          </Text>
        </View>
      </View>

      {groupThumbs && groupThumbs.length > 0 ? (
        <View className="mt-md gap-sm">
          {groupThumbs.map((thumbs, gi) => (
            <View key={`group-${gi}`} className="flex-row items-center gap-sm">
              <Text
                variant="caption"
                className="font-bold text-neutral-500 w-[28px]"
              >
                {`#${gi + 1}`}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingRight: 10 }}
              >
                {thumbs.map((p, ti) => (
                  <AppImage
                    key={`${p.uri}-${ti}`}
                    source={{ uri: p.uri }}
                    style={{ width: 56, height: 56, borderRadius: 8 }}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
