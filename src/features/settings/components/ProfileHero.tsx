import { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'react-native-css-interop';

import { Text } from '@/components/ui/Text';
import { gradients } from '@/constants/theme';

cssInterop(LinearGradient, { className: 'style' });

interface Props {
  firstName: string;
  email:     string;
  name?:     string;
  role?:     string;
}

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ProfileHero({ firstName, email, name, role }: Props) {
  const initials    = useMemo(() => getInitials(firstName || name || ''), [firstName, name]);
  const roleLabel   = role ? role.charAt(0).toUpperCase() + role.slice(1) : '—';
  const displayName = firstName || name || '—';

  return (
    <LinearGradient
      colors={[...gradients.hero]}
      className="pt-6xl pb-5xl px-5xl items-center rounded-b-hero"
    >
      <View className="w-20 h-20 rounded-full bg-white/15 border-2 border-white/25 items-center justify-center mb-xl">
        <Text variant="title" tone="inverse" className="font-bold">
          {initials}
        </Text>
      </View>

      <Text variant="subtitle" tone="inverse" className="font-bold" numberOfLines={1}>
        {displayName}
      </Text>

      <Text
        variant="bodySm"
        tone="inverse"
        numberOfLines={1}
        className="mt-xs opacity-80"
      >
        {email}
      </Text>

      <View className="bg-white/15 rounded-full px-lg py-xs mt-lg">
        <Text
          variant="caption"
          tone="inverse"
          className="font-bold tracking-widest uppercase"
        >
          {roleLabel}
        </Text>
      </View>
    </LinearGradient>
  );
}
