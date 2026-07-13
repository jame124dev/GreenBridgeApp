// Confidence ring — SVG track + animated foreground arc that sweeps to the
// match percentage (spec 06-match-detail §2.2 / §6). The web prototype's
// `conic-gradient` is not native, so this is the foundation SVG-ring recipe:
// a track Circle (#E4EBE6) + a foreground Circle (greenMedium/warnAmber) with an
// animated `strokeDashoffset` driven by `useConfidenceRing` (worklet, 60fps).
//
// Reused later on the Matches feed at a smaller `size`.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { fonts, greenDarkest, greenMedium, warnAmber } from '@/constants/theme';

const RING_TRACK = '#E4EBE6'; // screen-local; no foundation token

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ConfidenceRingProps = {
  /** 0–100. >=95 renders green, 91–94 amber. */
  percentage: number;
  /** Small-caps label under the number. */
  label?: string;
  /** Box size in px (default 128, per prototype). */
  size?: number;
};

/**
 * The stroke geometry is derived from `size` so the ring can be reused smaller.
 * At the default 128 box: r=61, strokeWidth=6 (foundation ring recipe, half-stroke
 * inset), which reads as the prototype's ~9px conic mask.
 */
export function ConfidenceRing({ percentage, label = 'AI MATCH', size = 128 }: ConfidenceRingProps) {
  const reduceMotion = useReducedMotion();

  const strokeWidth = Math.round(size * (6 / 128));
  // Half-stroke inset centers the stroke on the box edge — matches MatchesRing's
  // geometry so both rings scale as the same visual object (r=61 at size=128).
  const radius = size / 2 - strokeWidth / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const accent = percentage >= 95 ? greenMedium : warnAmber;
  // Scale the center number/label with the box so the ring works at any size.
  const numberSize = Math.round(size * (34 / 128));
  const labelSize = Math.round(size * (9.5 / 128) * 10) / 10;

  // Driven arc-reveal (NOT a static ternary): progress 0→1 → animated dashoffset.
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1; // static fallback: arc at final % instantly
      return;
    }
    progress.value = withDelay(150, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
  }, [reduceMotion, progress]);

  const arcProps = useAnimatedProps(() => ({
    // full circumference (hidden) → C·(1 − pct/100) (revealed arc)
    strokeDashoffset: circumference - circumference * (percentage / 100) * progress.value,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={RING_TRACK}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground arc — starts at 12 o'clock (rotate -90 about the center) */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={arcProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      {/* Centered %/label overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          entering={FadeIn.duration(reduceMotion ? 200 : 300).delay(reduceMotion ? 0 : 100)}
          style={styles.centerBox}
        >
          <Animated.Text
            style={[styles.pct, { fontSize: numberSize, lineHeight: numberSize, color: greenDarkest }]}
          >
            {percentage}%
          </Animated.Text>
          <Animated.Text
            style={[styles.label, { fontSize: labelSize, color: accent }]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontFamily: fonts.headingBold, // Hanken Grotesk 800
    textAlign: 'center',
  },
  label: {
    fontFamily: fonts.bold, // Inter 700 small-caps
    fontWeight: '700',
    letterSpacing: 1.14, // .12em × 9.5 ≈ 1.14
    marginTop: 2,
    textAlign: 'center',
  },
});
