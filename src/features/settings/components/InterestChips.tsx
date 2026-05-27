import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useLabCategories } from '@/features/scanner/useLabCategories';
import { colors } from '@/theme';

interface Props {
  selected: string[];
  onRemove: (slug: string) => void;
}

export function InterestChips({ selected, onRemove }: Props) {
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
          className="flex-row items-center gap-sm rounded-full px-lg py-xs"
          style={{
            backgroundColor: colors.primarySurface,
            borderWidth: 1,
            borderColor: colors.primaryBorder,
            maxWidth: '100%',
          }}
        >
          <Text variant="bodySm" tone="brand" className="font-semi" numberOfLines={1} style={{ maxWidth: 180 }}>
            {labelFor(slug)}
          </Text>
          <Pressable
            onPress={() => onRemove(slug)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${labelFor(slug)}`}
          >
            <X color={colors.primary} size={12} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
