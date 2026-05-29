import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { safeBack } from '@/lib/safeBack';
import { brand } from '@/constants/theme';

export function DetailAppBar() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-md px-lg py-2.5 border-b border-brand-border-strong bg-brand-background">
      <Pressable
        onPress={() => safeBack()}
        hitSlop={10}
        className="p-xs"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
      >
        <MaterialIcons name="arrow-back" size={22} color={brand.foreground} />
      </Pressable>
      <Text className="font-heading text-5xl text-brand-foreground">
        {t('mobile.detail.title')}
      </Text>
    </View>
  );
}
