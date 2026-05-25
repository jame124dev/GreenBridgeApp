import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-xl font-semibold text-foreground">Page not found</Text>
        <Link href="/(tabs)" className="mt-4 text-primary">
          Go home
        </Link>
      </View>
    </>
  );
}
