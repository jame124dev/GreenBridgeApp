// RelevanceRing — the small circular "% MATCH" ring shown on want cards and
// match cards (redesign mockup: `.ring`). An SVG track + a colour-graded
// foreground arc that draws once on mount (12 o'clock start, rounded cap), with
// the integer percent + a tiny "MATCH" caption centred inside.
//
// Colour comes from `tierStyle(tier)` — bar for the stroke, text for the number
// — so relevance reads green (strong) → amber (fair) → slate (weak) at a glance.
// The draw is a one-shot (never looping) and honours reduced motion.
//
// `pct == null` → renders nothing (matches the "no badge" contract in wantsView
// `relevancePercent`, which returns null for missing/NaN scores).
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/ui';
import { fonts, lab } from '@/constants/theme';
import { tierStyle, type MatchTier } from '@/features/lab/wants/data/wantsView';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Ring track — mirrors the mockup's `stroke="#E4EBE6"`; no matching token. */
const TRACK = '#E4EBE6';

export type RelevanceRingProps = {
  /** RAW relevance percent (0–100). `null` → renders nothing. */
  pct: number | null;
  /** Box size in px (default 52 — the mockup ring). */
  size?: number;
  /** Colour tier; defaults to 'low' (slate) when omitted. */
  tier?: MatchTier;
};

export function RelevanceRing({ pct, size = 52, tier = 'low' }: RelevanceRingProps) {
  const reduced = useReducedMotion();

  // Geometry: stroke 5, r≈22 inside a 52 box (small inset off the edge), scaled.
  const stroke = 5;
  const r = size / 2 - stroke / 2 - 2;
  const c = 2 * Math.PI * r; // circumference
  const center = size / 2;

  const clamped = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const target = c * (1 - clamped / 100); // final dash offset

  const offset = useSharedValue(c); // start empty (full offset)

  useEffect(() => {
    if (reduced) {
      offset.value = target; // static fallback: appear filled instantly
    } else {
      offset.value = withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) });
    }
    // mount / value-change draw
  }, [reduced, target, offset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  if (pct == null) return null;

  const { text, bar } = tierStyle(tier);
  const numberSize = Math.round(size * 0.27); // ≈14 at size 52
  const labelSize = Math.max(7, Math.round(size * 0.135)); // ≈7 at size 52

  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} stroke={TRACK} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={bar}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={animatedProps}
          // begin the arc at 12 o'clock like the mockup ring
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: numberSize, lineHeight: numberSize, color: text, fontVariant: ['tabular-nums'] }}>
          {clamped}
        </Text>
        <Text style={{ fontFamily: fonts.label, fontSize: labelSize, lineHeight: labelSize + 2, letterSpacing: 0.5, color: lab.inkMeta, marginTop: 1 }}>
          MATCH
        </Text>
      </View>
    </View>
  );
}
