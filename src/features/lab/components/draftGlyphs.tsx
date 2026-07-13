// (lab) Draft Review — bespoke SVG glyphs (NewVersion/03-draft-review.md §2d).
// Namespaced `draft*` so parallel screen builders don't collide. These are exact
// ports of the prototype's custom SVGs — do NOT substitute lucide equivalents
// (the shapes differ). react-native-svg is already in the stack.
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

/**
 * Equipment placeholder glyph for the gradient hero (spec §2d): a rect + shelf
 * line + knob circle, white stroke @55% group opacity. Reusable wherever the
 * image placeholder appears. viewBox 0 0 24 24, strokeWidth 1.2, round caps.
 */
export function DraftEquipmentGlyph({ size = 62 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      opacity={0.55}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Rect
        x={5}
        y={3}
        width={14}
        height={18}
        rx={2}
        stroke="#fff"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={5} y1={8} x2={19} y2={8} stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={9} cy={13} r={1} stroke="#fff" strokeWidth={1.2} />
    </Svg>
  );
}

/**
 * Single 4-point sparkle for the "AI drafted" pill (spec §2b). A filled Path —
 * the prototype's clean 4-point star, NOT lucide `Sparkles` (which renders a
 * 3-star cluster). Fill defaults to greenMedium (#16A35A).
 */
export function DraftSparkle({ size = 14, color = '#16A35A' }: { size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Path d="M7 0 L8.6 5.4 L14 7 L8.6 8.6 L7 14 L5.4 8.6 L0 7 L5.4 5.4 Z" fill={color} />
    </Svg>
  );
}
