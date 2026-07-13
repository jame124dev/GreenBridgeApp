// LabLocationChip — top-right location control for the (lab) Home header.
// Ports the seller home's "current location" affordance (app/(tabs)/index.tsx)
// into the customer app, reusing the SAME shared service via useSellerLocation()
// (see src/features/location/useSellerLocation.ts). Shows the cached city label
// instantly, detects/updates on tap, and mirrors MatchesPill's tokens so the two
// right-edge controls read as siblings.
//
// This component is STATE-only presentational: the hook + denied-toast live at
// the Home screen (home.tsx) and are passed in, exactly like the seller
// index.tsx keeps useSellerLocation() at the screen so the silent on-mount
// refresh runs once per Home visit.
//
// States (all graceful, never a red error):
//   • idle (no cache)      → "Set location" + MapPin, subtle pillBg fill.
//   • detecting            → MapPin swapped for a small greenDark spinner;
//                            label stays; pill disabled.
//   • resolved             → MapPin + city label; POP-bounce on a NEW label.
//   • denied (on tap)      → caller toasts; chip stays "Set location".
//   • unavailable + no cache → renders null (no dead control on a stale
//                            dev-client that lacks the native module).
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';

import { fonts, greenDark, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { usePop, usePopBounce, usePressScale } from '@/animations/recipes';
import type { ResolvedLocation } from '@/services/location/getDeviceLocation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type LabLocationChipProps = {
  /** Cached/resolved location from useSellerLocation(); null until detected. */
  location: ResolvedLocation | null;
  /** True while a detect() is in flight — shows the spinner + disables the pill. */
  detecting: boolean;
  /** Tap handler — the screen runs detect() and toasts on denied. */
  onPress: () => void;
};

/**
 * The compact location pill. Hidden entirely (returns null) when there is no
 * cached label AND nothing is being detected — so a stale dev-client without the
 * native module (getDeviceLocation → 'unavailable', hook never caches) shows no
 * dead control rather than a permanently-empty affordance.
 */
export function LabLocationChip({ location, detecting, onPress }: LabLocationChipProps) {
  const { t } = useTranslation();
  const label = location?.label?.trim() || '';
  const hasLabel = label.length > 0;

  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  const { style: bounceStyle, bounce } = usePopBounce();
  const entering = usePop();

  // POP-bounce once whenever the resolved label CHANGES (a fresh detect landed).
  // Skip the very first render so opening Home with a cached label doesn't bounce.
  const prevLabel = useRef<string | null>(null);
  useEffect(() => {
    if (prevLabel.current !== null && hasLabel && label !== prevLabel.current) {
      bounce();
    }
    prevLabel.current = label;
  }, [label, hasLabel, bounce]);

  // Hidden state: no label to show and not currently detecting → render nothing.
  if (!hasLabel && !detecting) return null;

  const text = hasLabel ? label : t('mobile.labCommon.locating');

  return (
    <Animated.View entering={entering} style={bounceStyle}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={detecting}
        accessibilityRole="button"
        accessibilityLabel={hasLabel ? t('mobile.labCommon.locationAt', { label }) : t('mobile.labCommon.detectingLocation')}
        // ~31pt visual height → hitSlop lifts the effective target past 44pt
        // (matches MatchesPill).
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.pill, pressStyle]}
      >
        {detecting ? (
          <ActivityIndicator size="small" color={greenDark} style={styles.spinner} />
        ) : (
          <MapPin size={13} color={greenDark} strokeWidth={2.2} />
        )}
        <Text numberOfLines={1} style={styles.pillText}>
          {text}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * The idle "Set location" variant, used when there is no cache yet BUT we still
 * want to surface the control (native module present). The Home screen decides
 * when to show this via `showSetLocation` — see home.tsx. Kept separate from the
 * hidden-state branch above so the "cold, tappable" prompt is explicit.
 */
export function LabSetLocationChip({ detecting, onPress }: Omit<LabLocationChipProps, 'location'>) {
  const { t } = useTranslation();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  const entering = usePop();
  return (
    <Animated.View entering={entering}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={detecting}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labCommon.setYourLocation')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.pill, pressStyle]}
      >
        {detecting ? (
          <ActivityIndicator size="small" color={greenDark} style={styles.spinner} />
        ) : (
          <MapPin size={13} color={greenDark} strokeWidth={2.2} />
        )}
        <Text numberOfLines={1} style={styles.pillText}>
          {detecting ? t('mobile.labCommon.locating') : t('mobile.labCommon.setLocation')}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Mirrors MatchesPill: pillBg fill, radius.full, bold 12. A maxWidth caps the
  // city label so a long area name never crowds the brand lockup on ≤375pt.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 128,
    backgroundColor: lab.pillBg,
    paddingVertical: spacing.sm, // 8
    paddingHorizontal: spacing.md, // 12
    borderRadius: radius.full,
  },
  // Reserve the icon's 13px box so swapping MapPin ↔ spinner causes no width jump.
  spinner: { width: 13, height: 13 },
  pillText: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 12,
    color: greenDarkest,
  },
});
