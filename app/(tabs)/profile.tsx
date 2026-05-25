import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useLogout } from '@/features/auth/useLogout';
import { useAuth } from '@/stores/authStore';

export default function ProfileScreen() {
  const profile = useAuth((s) => s.profile);
  const logoutMut = useLogout();

  const handleSignOut = () =>
    logoutMut.mutate(undefined, {
      onSuccess: () => router.replace('/(auth)/login'),
    });

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <Text className="text-2xl font-bold text-foreground">Profile</Text>

      {profile ? (
        <View className="mt-6 gap-2">
          <Text className="text-lg text-foreground">{profile.name}</Text>
          <Text className="text-muted-foreground">{profile.email}</Text>
          <Text className="text-sm capitalize text-muted-foreground">Role: {profile.role}</Text>
          {profile.company ? (
            <Text className="text-sm text-muted-foreground">{profile.company}</Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={handleSignOut}
        disabled={logoutMut.isPending}
        className="mt-10 h-12 items-center justify-center rounded border border-border active:opacity-90"
      >
        <Text className="font-semibold text-foreground">
          {logoutMut.isPending ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>
    </View>
  );
}
