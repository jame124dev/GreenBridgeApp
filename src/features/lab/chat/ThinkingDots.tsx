// Pre-first-token "thinking" indicator (05-mobile-ux §3.2): three dots that
// pulse (opacity 0.35↔1) with an 0.15s stagger. Static under reduced motion.
// Decorative — hidden from the screen reader.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { brand } from '@/constants/theme';

function Dot({ delay, reduced }: { delay: number; reduced: boolean }) {
  const v = useSharedValue(reduced ? 1 : 0.35);
  useEffect(() => {
    if (reduced) {
      v.value = 1;
      return;
    }
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(v);
  }, [delay, reduced, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function ThinkingDots() {
  const reduced = useReducedMotion();
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Dot delay={0} reduced={reduced} />
      <Dot delay={150} reduced={reduced} />
      <Dot delay={300} reduced={reduced} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: brand.placeholder },
});
