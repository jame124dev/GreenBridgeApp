// Matches-feed % match ring (spec 05 §3 `MatchRing` + §6 stroke-draw).
// SVG stroked circle (no `conic-gradient` in RN): a track circle + an animated
// foreground arc whose `strokeDashoffset` draws from empty → target on mount.
// The interior is transparent (only the 5px stroke is colored) so the white
// card shows through — the prototype's "5px-inset white disc" for free.
// Namespaced `Matches*` to avoid collision with the MATCH-screen confidence ring.
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/ui';
import { fonts, greenDarkest } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  pct: number; // 0–100
  /** POP stagger index → the stroke-draw begins after the card settles. */
  index: number;
  fillColor: string;
  trackColor?: string;
  size?: number;
  stroke?: number;
};

export function MatchesRing({
  pct,
  index,
  fillColor,
  trackColor = '#E4EBE6',
  size = 58,
  stroke = 5,
}: Props) {
  const r = size / 2 - stroke / 2; // ≈26.5 for 58/5
  const c = 2 * Math.PI * r; // circumference
  const target = c * (1 - Math.max(0, Math.min(100, pct)) / 100); // final offset
  const center = size / 2;

  const offset = useSharedValue(c); // start empty (full offset)
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      offset.value = target; // static fallback: appear filled instantly
    } else {
      offset.value = withDelay(
        index * 80 + 150, // begin after the card's POP settles
        withTiming(target, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      );
    }
    // mount-only draw
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={fillColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={animatedProps}
          // start the arc at 12 o'clock like the conic-gradient
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Text
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          textAlign: 'center',
          textAlignVertical: 'center',
          fontFamily: fonts.headingBold,
          fontSize: 15,
          lineHeight: size, // vertically center the single line in the box
          color: greenDarkest,
        }}
      >
        {`${pct}%`}
      </Text>
    </View>
  );
}
