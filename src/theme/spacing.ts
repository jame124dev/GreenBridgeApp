// 4 px-based spacing scale. Use these instead of literal padding/margin/gap
// values inside StyleSheet — `spacing.md` instead of `12`, `spacing.lg` etc.
//
// The scale mirrors what was already in use across screens (4 / 6 / 8 / 10 /
// 12 / 14 / 16 / 18 / 20 / 24 / 28 / 32 / 40 / 48) so swapping inline numbers
// for tokens is purely a consolidation.

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  '4xl': 18,
  '5xl': 20,
  '6xl': 24,
  '7xl': 28,
  '8xl': 32,
  '9xl': 40,
  '10xl': 48,
} as const;

export type SpacingToken = keyof typeof spacing;
