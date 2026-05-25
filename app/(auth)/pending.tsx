import { View, Text, Pressable, Linking } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLogout } from '@/features/auth/useLogout';
import { gradients } from '@/theme/gradients';

export default function PendingScreen() {
  const logoutMut = useLogout();

  const handleSignOut = () =>
    logoutMut.mutate(undefined, {
      onSuccess: () => router.replace('/(auth)/login'),
    });

  return (
    <View className="flex-1 bg-background">
      <LinearGradient colors={[...gradients.hero]} className="h-36 justify-end px-6 pb-5">
        <Text className="font-sans-bold text-2xl text-white">Awaiting approval</Text>
      </LinearGradient>

      <SafeAreaView className="flex-1 px-6 pt-8">
        <Text className="text-base leading-6 text-foreground">
          Your account is awaiting approval. Open settings on the website to upload missing
          documents or check your application status.
        </Text>

        <Pressable
          onPress={() => Linking.openURL('https://greenbidz.com/dashboard/settings')}
          className="mt-6 h-12 items-center justify-center rounded bg-primary active:opacity-90"
        >
          <Text className="font-sans-medium text-primary-foreground">Open settings</Text>
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          disabled={logoutMut.isPending}
          className="mt-4 h-12 items-center justify-center rounded border border-border active:opacity-90"
        >
          <Text className="font-sans-medium text-foreground">
            {logoutMut.isPending ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
