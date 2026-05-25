import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  title: string;
  subtitle?: string;
};

export function ScreenPlaceholder({ title, subtitle }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-semibold text-foreground">{title}</Text>
        {subtitle ? (
          <Text className="mt-2 text-center text-muted-foreground">{subtitle}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
