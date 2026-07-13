// Orange Matches count pill (NewVersion/08-bottom-nav.md §2.4 / §3.3).
// Pure `count`-prop component — renders nothing when count <= 0, caps at 99+.
import Animated, { ZoomIn, FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Text, StyleSheet } from 'react-native';
import { fonts, badgeOrange } from '@/constants/theme';

const WHITE = '#ffffff';

export function TabBadge({ count }: { count: number }) {
  const reduced = useReducedMotion();
  if (count <= 0) return null;
  // POP on reveal; FadeIn (opacity only) under reduced motion.
  const entering = reduced ? FadeIn.duration(200) : ZoomIn.duration(300);
  return (
    <Animated.View entering={entering} style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 99,
    backgroundColor: badgeOrange,
    borderWidth: 1.5,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // lineHeight absolute px (RN requires it — never a CSS multiplier). Bumped
  // from 8.5 so the digit isn't cramped in the (now larger) pill.
  text: { color: WHITE, fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
});
