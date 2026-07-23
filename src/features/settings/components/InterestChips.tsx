import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { brand } from '@/constants/theme';

interface Props {
  selected: string[];
  onRemove: (slug: string) => void;
}

export function InterestChips({ selected, onRemove }: Props) {
  const { t } = useTranslation();
  const { data } = useLabCategories();

  const labelFor = (slug: string) => {
    for (const cat of data?.categories ?? []) {
      if (cat.slug === slug) return cat.name;
      for (const sub of cat.subcategories ?? []) {
        if (sub.slug === slug) return sub.name;
      }
    }
    return slug;
  };

  if (selected.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-sm mt-md">
      {selected.map((slug) => (
        <View
          key={slug}
          className="flex-row items-center gap-sm rounded-full px-lg py-xs max-w-full bg-brand-primary-surface border border-brand-primary-border"
        >
          <Text
            variant="bodySm"
            tone="brand"
            className="font-semi max-w-[180px]"
            numberOfLines={1}
          >
            {labelFor(slug)}
          </Text>
          <Pressable
            onPress={() => onRemove(slug)}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.settings.removeInterest', {
              name: labelFor(slug),
              defaultValue: 'Remove {{name}}',
            })}
          >
            {/* `X` is a native SVG — color must come through the `color` prop,
                not a className. brand.primary preserves the deep-forest brand. */}
            <X color={brand.primary} size={12} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
