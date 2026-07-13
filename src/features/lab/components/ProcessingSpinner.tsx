// (lab) Processing — 96×96 three-layer AI spinner.
// Layers back→front: static track ring, spinning accent arc (top+right wedge),
// centered 4-point sparkle glyph. Presentational only; all timing/data lives in
// the screen. Reusable on any AI-working surface (spec 02-processing §3).
//
// Reduced motion (WCAG 2.3.3 spinner exception): the loader STAYS VISIBLE as a
// static accent arc frozen at 45° (top-right diagonal), opacity 1, scale 100% —
// it never stops dead / disappears. useSpin() already returns a static transform
// under reduced motion, so we layer a manual 45° rotate underneath it.
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { usePulse, useSpin } from '@/animations/recipes';
import { spacing } from '@/constants/theme';

/** Static track ring shade — single-screen prototype hex (spec §2 color table). */
const TRACK = '#E2EBE5';

type Props = {
  accent: string;
  reducedMotion: boolean;
  /** Optional breathing PULSE on the center sparkle (off by default, spec §6). */
  pulse?: boolean;
};

export function ProcessingSpinner({ accent, reducedMotion, pulse = false }: Props) {
  // Main spinner: 360°/1000ms linear. Under reduced motion useSpin returns a
  // resting (0°) transform; we compose a static 45° freeze via a wrapper style.
  const spin = useSpin(1000);
  // Optional sparkle pulse (opacity 0.35↔1). usePulse pins to opacity 1 under
  // reduced motion. Hook is called unconditionally (rules of hooks); the style
  // is only applied when `pulse` is on.
  const pulseStyle = usePulse(1500);

  return (
    <View style={{ width: 96, height: 96, marginBottom: spacing['3xl'], position: 'relative' }}>
      {/* (back) static track ring — never animates */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 48,
          borderWidth: 4,
          borderColor: TRACK,
        }}
      />

      {/* (middle) spinning accent arc — top + right quadrants only */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 48,
            borderWidth: 4,
            borderColor: 'transparent',
            borderTopColor: accent,
            borderRightColor: accent,
          },
          // Reduced motion: freeze the wedge at 45° so it still reads as a loader
          // but does not rotate. Otherwise the animated spin transform drives it.
          reducedMotion ? { transform: [{ rotate: '45deg' }] } : spin,
        ]}
      />

      {/* (front) center 4-point sparkle glyph, absolutely centered */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          pulse ? pulseStyle : null,
        ]}
      >
        <Svg width={34} height={34} viewBox="0 0 24 24">
          <Path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={accent} />
        </Svg>
      </Animated.View>
    </View>
  );
}
