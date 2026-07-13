// LabScreenBg — the shared lab-screen backdrop: the base neutral bg + a FIXED
// soft brand wash behind the top (mint → neutral, doesn't scroll). Wrap a
// transparent-background Screen/content in it for the unified "app depth" look
// across the lab pages (Home, Listings, Matches, Notifications, …).
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { gradients, lab } from '@/constants/theme';

/** Fraction of screen height the wash covers before fully fading to bg. */
const WASH_RATIO = 0.5;

export function LabScreenBg({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: lab.bg }}>
      <LinearGradient
        colors={gradients.labWash}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.round(height * WASH_RATIO),
        }}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
