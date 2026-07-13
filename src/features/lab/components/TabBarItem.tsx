// Single frosted tab item (NewVersion/08-bottom-nav.md §3.3 / §6).
// - Press-in scales the inner stack to 0.97 (the foundation/Button value) + opacity dip.
// - Active tint is an opacity cross-fade between two stacked copies (idle/active),
//   driven by a real Reanimated value so it fades over 200ms (not a snap).
import { useEffect } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { fonts, fontSize, greenDark, lab, radius } from '@/constants/theme';
import { TabBadge } from './TabBadge';

// Active tint — a VIVID green (#16794A) so the selected tab clearly stands out
// from the muted gray idle tabs; the near-black greenDarkest read too subtle.
const NAV_ACTIVE = greenDark;
// Visible green-wash pill behind the active icon (Material-style indicator).
const ACTIVE_PILL = 'rgba(22, 121, 74, 0.14)';

// Idle nav tint. The prototype's #9AA89F (`navIdle`) measures ~2.5:1 on the
// near-white bar — below WCAG AA. `lab.inkSub` (#5E6E66) clears AA (~5:1) while
// staying muted against the active greenDarkest, so idle labels/icons stay
// legible for the four always-idle tabs.
const NAV_IDLE = lab.inkSub;

const AView = Animated.createAnimatedComponent(View);
const AText = Animated.Text;

export function TabBarItem({
  Icon,
  label,
  focused,
  badgeCount = 0,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  focused: boolean;
  badgeCount?: number;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const press = useSharedValue(0); // 0 = rest, 1 = pressed
  const t = useSharedValue(focused ? 1 : 0); // active-tint amount (real animated value)

  // Drive the 200ms cross-fade whenever focus changes; instant snap under reduced motion.
  useEffect(() => {
    t.value = reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, reduced, t]);

  // Press feedback: scale 1 → 0.97 (foundation value, NOT 0.95) + opacity dip.
  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : withTiming(1 - press.value * 0.03, { duration: 100 }) }],
    opacity: reduced ? 1 : withTiming(1 - press.value * 0.15, { duration: 100 }),
  }));

  const idleIconStyle = useAnimatedStyle(() => ({ opacity: 1 - t.value }));
  const activeIconStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  const idleLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - t.value }));
  const activeLabelStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  // Material-style active pill behind the icon — fades + grows in with focus so
  // the selected tab is unmistakable (color alone was too subtle on the bar).
  const pillStyle = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: reduced ? 1 : 0.8 + t.value * 0.2 }],
  }));

  return (
    <Pressable
      style={styles.item}
      onPressIn={() => {
        press.value = 1;
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 15 });
      }}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <AView style={[styles.stack, stackStyle]}>
        <View style={styles.iconArea}>
          <AView style={[styles.activePill, pillStyle]} pointerEvents="none" />
          <View style={styles.iconWrap}>
            <AView style={[StyleSheet.absoluteFill, styles.iconCenter, idleIconStyle]}>
              <Icon size={22} color={NAV_IDLE} />
            </AView>
            <AView style={[StyleSheet.absoluteFill, styles.iconCenter, activeIconStyle]}>
              <Icon size={22} color={NAV_ACTIVE} />
            </AView>
            {badgeCount > 0 && <TabBadge count={badgeCount} />}
          </View>
        </View>
        <View style={styles.labelWrap}>
          <AText numberOfLines={1} style={[styles.label, styles.labelAbs, { color: NAV_IDLE }, idleLabelStyle]}>
            {label}
          </AText>
          <AText numberOfLines={1} style={[styles.label, { color: NAV_ACTIVE }, activeLabelStyle]}>
            {label}
          </AText>
        </View>
      </AView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  stack: { alignItems: 'center', gap: 3 },
  // Pill container — wider than the icon so the active pill reads as a proper
  // selection indicator (Material 3 nav-bar style).
  iconArea: { width: 52, height: 30, alignItems: 'center', justifyContent: 'center' },
  activePill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.full,
    backgroundColor: ACTIVE_PILL,
  },
  iconWrap: { position: 'relative', width: 23, height: 23 },
  iconCenter: { alignItems: 'center', justifyContent: 'center' },
  labelWrap: { position: 'relative', alignItems: 'center' },
  labelAbs: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  // lineHeight absolute px (RN); Inter_700Bold stands in for the prototype 700.
  // fontSize.xs (10) is the foundation label floor (§Fonts Label 10–12px); the
  // prototype 9.5 sat below it. lineHeight 13 keeps the ~1.3× rhythm.
  label: { fontSize: fontSize.xs, lineHeight: 13, fontFamily: fonts.bold },
});
