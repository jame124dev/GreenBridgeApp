// (lab) Processing — one checklist step row (spec 02-processing §2d, §3).
// Two visual states:
//   'done'   → solid accent-filled 22px circle with a white check.
//   'active' → 22px ring (track + accent top border) spinning 360°/900ms.
// Presentational only. Reduced motion: the active ring freezes at 45° (still
// visible) per the WCAG spinner exception.
import { Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { fonts } from '@/constants/theme';
import { useSpin } from '@/animations/recipes';

/** In-progress ring track shade — single-screen prototype hex (spec §2). */
const STEP_TRACK = '#C7D3CB';
/** Done-step / title text color (exact prototype hex, spec §2). */
const INK = '#10201A';
/** In-progress (active) step text color — muted green (spec §2). */
const INK_ACTIVE = '#34503F';

type Props = {
  state: 'done' | 'active';
  label: string;
  accent: string;
  reducedMotion: boolean;
  /** Optional POP-in for the done check instead of a static render (spec §6). */
  pop?: boolean;
  /** Row index — drives POP stagger (200ms · index) when `pop` is on. */
  index?: number;
};

export function ProcessingStepRow({ state, label, accent, reducedMotion, pop = false, index = 0 }: Props) {
  // Step-3 ring spins slightly faster (900ms) than the main spinner (1000ms) so
  // it reads as a distinct, quicker sub-process. Hook is called unconditionally
  // (rules of hooks); only consumed on the 'active' branch.
  const spin = useSpin(900);

  // Optional check POP-in choreography (off by default → static, 1:1 prototype).
  // Reduced motion → FadeIn (never a scale pop). Only the done checks pop in.
  const checkEntering =
    pop && state === 'done'
      ? reducedMotion
        ? FadeIn.duration(200).delay(200 * (index + 1))
        : ZoomIn.duration(300).delay(200 * (index + 1))
      : undefined;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {state === 'done' ? (
        // Solid accent circle + white check
        <Animated.View
          entering={checkEntering}
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            flexShrink: 0,
            backgroundColor: accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6 9 17l-5-5"
              stroke="#fff"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      ) : (
        // Spinning ring: track + accent top border
        <Animated.View
          style={[
            {
              width: 22,
              height: 22,
              borderRadius: 11,
              flexShrink: 0,
              borderWidth: 2.5,
              borderColor: STEP_TRACK,
              borderTopColor: accent,
            },
            reducedMotion ? { transform: [{ rotate: '45deg' }] } : spin,
          ]}
        />
      )}

      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 13.5,
          lineHeight: 20, // explicit leading (≈ typography.bodySm 14/20) — consistent with the screen's body/subtitle
          color: state === 'done' ? INK : INK_ACTIVE,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
