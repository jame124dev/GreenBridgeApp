import { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { gradients } from '@/theme';

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
  const initials  = useMemo(() => getInitials(firstName || name || ''), [firstName, name]);
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '—';
  const displayName = firstName || name || '—';

  return (
    <LinearGradient
      colors={[...gradients.hero]}
      style={{
        paddingTop: 72,
        paddingBottom: 56,
        paddingHorizontal: 56,
        alignItems: 'center',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
      }}
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Text
          variant="title"
          tone="inverse"
          className="font-bold"
          style={{ fontSize: 26 }}
        >
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
        className="mt-xs"
        style={{ opacity: 0.8 }}
      >
        {email}
      </Text>

      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 9999,
          paddingHorizontal: 16,
          paddingVertical: 4,
          marginTop: 16,
        }}
      >
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
