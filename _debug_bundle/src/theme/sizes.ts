// Type-scale (font sizes + line heights) and component-size tokens. Keeps the
// "what counts as a Body / a Caption / a Heading" decision in one place so we
// don't sprinkle `fontSize: 13` literals across files.

export const fontSize = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 13,
  lg: 14,
  xl: 15,
  '2xl': 16,
  '3xl': 18,
  '4xl': 20,
  '5xl': 22,
  '6xl': 24,
  '7xl': 26,
  '8xl': 28,
} as const;

export const lineHeight = {
  tight: 16,
  snug: 18,
  normal: 20,
  relaxed: 22,
  loose: 26,
} as const;

export const letterSpacing = {
  caps: 1.4,
  capsTight: 1.0,
  capsLoose: 0.4,
  none: 0,
} as const;

// Common component dimensions (control heights, hit targets).
export const sizes = {
  controlHeight: 44, // standard input / button height
  controlHeightSm: 36,
  controlHeightLg: 50,
  iconButton: 40,
  avatarSm: 32,
  avatarMd: 48,
  avatarLg: 76,
  hitSlop: 8,
} as const;

export type FontSizeToken = keyof typeof fontSize;
export type SizeToken = keyof typeof sizes;
