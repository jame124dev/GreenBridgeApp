import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { useLabCategories } from '@/features/scanner/useLabCategories';

interface Props {
  visible:  boolean;
  selected: string[];
  onToggle: (slug: string) => void;
  onClose:  () => void;
}

export function InterestsSheet({ visible, selected, onToggle, onClose }: Props) {
  const { t } = useTranslation();
  const { data } = useLabCategories();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.settings.interests')}
      subtitle={t('mobile.settings.interestsOptional', { defaultValue: 'Pick the equipment types you list most.' })}
      snapTo="65%"
      maxHeight={460}
    >
      {(data?.categories ?? []).map((cat, i) => (
        <View key={cat.slug} style={{ marginTop: i > 0 ? 8 : 0 }}>
          {/* Parent: section header (uppercase, filled bg, tappable to select the parent itself). */}
          <Sheet.Option
            header
            label={cat.name}
            active={selected.includes(cat.slug)}
            onPress={() => onToggle(cat.slug)}
          />
          {/* Subcategories: regular bordered cards. */}
          {(cat.subcategories ?? []).map((sub) => (
            <Sheet.Option
              key={sub.slug}
              label={sub.name}
              active={selected.includes(sub.slug)}
              onPress={() => onToggle(sub.slug)}
            />
          ))}
        </View>
      ))}
    </Sheet>
  );
}
