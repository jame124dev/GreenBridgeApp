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
      snapTo="65%"
    >
      {(data?.categories ?? []).map((cat) => (
        <View key={cat.slug}>
          <Sheet.Option
            label={cat.name}
            active={selected.includes(cat.slug)}
            onPress={() => onToggle(cat.slug)}
          />
          {(cat.subcategories ?? []).map((sub) => (
            <Sheet.Option
              key={sub.slug}
              label={sub.name}
              active={selected.includes(sub.slug)}
              onPress={() => onToggle(sub.slug)}
              indent
            />
          ))}
        </View>
      ))}
    </Sheet>
  );
}
