import { Redirect } from 'expo-router';

import { useAuth } from '@/stores/authStore';
import { IS_CUSTOMER } from '@/lib/flags';

export default function Index() {
  const profile = useAuth((s) => s.profile);
  const isPending = useAuth((s) => s.isPending);

  if (isPending) return <Redirect href="/(auth)/pending" />;
  if (!profile) return <Redirect href="/(auth)/login" />;
  // Post-auth fork: customer bundle → (lab) app; seller bundle → existing (tabs).
  if (IS_CUSTOMER) return <Redirect href="/(lab)/(tabs)/home" />;
  return <Redirect href="/(tabs)" />;
}
