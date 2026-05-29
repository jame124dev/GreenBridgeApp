import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { brand } from '@/constants/theme';

interface Props {
  text: string;
  ai?: boolean;
  required?: boolean;
}

/**
 * Label-caps field label with optional red `*` and an AI badge.
 *
 * S6.2.b2.i — converted to NativeWind. `letterSpacing: 0.6` (legacy) cannot be
 * expressed in our Tailwind scale; preserved via inline `style={{ letterSpacing }}`.
 */
export function FieldLabel({ text, ai, required }: Props) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text
        className={`font-label text-md ${required ? 'text-brand-destructive' : 'text-brand-text-muted'}`}
        style={{ letterSpacing: 0.6 }}
      >
        {text}
        {required ? ' *' : ''}
      </Text>
      {ai ? (
        <View className="flex-row items-center gap-xxs bg-brand-primary-accent px-1.5 rounded-xs" style={{ paddingVertical: 1 }}>
          <MaterialIcons name="auto-awesome" size={11} color={brand.primary} />
          <Text className="font-label text-brand-primary" style={{ fontSize: 10 }}>AI</Text>
        </View>
      ) : null}
    </View>
  );
}
