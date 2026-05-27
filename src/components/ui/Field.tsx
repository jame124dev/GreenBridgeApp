import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';

type Props = {
  label: string;
  hint?: string;
  error?: string;
  flex?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Field({ label, hint, error, flex, children, style }: Props) {
  return (
    <View className={`gap-xs${flex ? ' flex-1' : ''}`} style={style}>
      <View className="flex-row justify-between items-baseline">
        <Text
          variant="bodySm"
          tone={error ? 'danger' : 'secondary'}
          className="font-medium flex-shrink"
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="tertiary" className="ml-md">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
