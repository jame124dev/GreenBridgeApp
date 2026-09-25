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
      {/*
        ⚠️ `pointerEvents` GOES ON A PLAIN VIEW, NOT ON `LinearGradient`.

        On the New Architecture the prop is not part of that native component's
        descriptor, so it is silently DROPPED — the gradient renders perfectly
        and stays hit-testable. Here it is absolutely positioned over the top
        HALF of every lab screen (`WASH_RATIO = 0.5`), which is exactly where a
        thumb starts a scroll, so the list stops responding to drags while
        looking completely normal. Reported on Matches; the same wrapper is
        used by Messages, Home, Listings, Notifications and Drafts.

        This app already had the finding written down — `features/v2/ui/
        Surface.tsx:80-88` carries the identical warning, after the same drop
        killed "Scan it" and the whole assistant row. Same bug, second place.

        Why it did not show on the web harness: react-native-web DOES honour
        `pointerEvents` on the gradient, so the fault is native-only — a
        reminder that "it scrolls in the browser" is not evidence about the
        device.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.round(height * WASH_RATIO),
        }}
      >
        <LinearGradient colors={gradients.labWash} style={{ flex: 1 }} />
      </View>
      {children}
    </View>
  );
}
