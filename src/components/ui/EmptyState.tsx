import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/constants/theme';
import { Text } from './Text';
import { Button, type ButtonVariant } from './Button';

type Props = {
  icon?: React.ReactNode;
  iconBg?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  loose?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  iconBg = colors.neutral[100],
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'secondary',
  loose,
  style,
}: Props) {
  return (
    <View
      className={`items-center justify-center px-5xl ${loose ? 'py-5xl' : 'py-3xl'}`}
      style={style}
    >
      {icon ? (
        <View
          className="w-16 h-16 rounded-3xl items-center justify-center mb-3xl"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </View>
      ) : null}
      <Text variant="subtitle" tone="primary" className="text-center font-bold">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" className="text-center mt-md" style={{ maxWidth: 320 }}>
          {description}
        </Text>
      ) : null}
      {onAction && actionLabel ? (
        <View className="mt-5xl">
          <Button label={actionLabel} onPress={onAction} variant={actionVariant} size="sm" />
        </View>
      ) : null}
    </View>
  );
}
