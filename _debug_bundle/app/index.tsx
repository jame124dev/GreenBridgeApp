import { Redirect } from 'expo-router';

import { useAuth } from '@/stores/authStore';

export default function Index() {
  const profile = useAuth((s) => s.profile);
  const isPending = useAuth((s) => s.isPending);

  if (isPending) return <Redirect href="/(auth)/pending" />;
  if (profile) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/login" />;
}
