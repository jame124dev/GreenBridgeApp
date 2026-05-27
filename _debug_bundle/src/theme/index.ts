import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { fontSize, lineHeight, letterSpacing, sizes } from './sizes';
import { fonts } from './typography';
import { gradients } from './gradients';

export { colors } from './colors';
export type { ColorToken } from './colors';

export { spacing } from './spacing';
export type { SpacingToken } from './spacing';

export { radius } from './radius';
export type { RadiusToken } from './radius';

export { shadows } from './shadows';
export type { ShadowToken } from './shadows';

export { fontSize, lineHeight, letterSpacing, sizes } from './sizes';
export type { FontSizeToken, SizeToken } from './sizes';

export { fonts, typography } from './typography';
export type { FontKey } from './typography';

export { gradients } from './gradients';

// Bundled namespace for `import { theme }` style consumption.
export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  fontSize,
  lineHeight,
  letterSpacing,
  sizes,
  fonts,
  gradients,
} as const;

export type Theme = typeof theme;
