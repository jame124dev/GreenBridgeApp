/**
 * v2 design tokens — the single import for everything under `app/v2/`.
 *
 *     import { useV2Colors, type, space, GUTTER, radius } from '@/theme/v2';
 *
 * Do NOT import `lightPalette` / `darkPalette` directly in a screen. Colours
 * come from `useV2Colors()` so they re-render on a scheme change.
 * `src/__tests__/v2Adherence.test.ts` enforces this.
 *
 * Provenance and the collapse log live in `palette.ts` and `scale.ts`.
 */
export { V2ThemeProvider, useV2Colors, useV2Theme } from './ThemeProvider';
export type { PaletteRoles, SchemeName } from './palette';
export { palettes, lightPalette, darkPalette } from './palette';

export {
  space,
  radius,
  type,
  icon,
  control,
  fonts,
  duration,
  easing,
  press,
  spring,
  shadow,
  scaleW,
  GUTTER,
  CARD_PAD,
  HEADER_SHEET_RADIUS,
  HAIRLINE_WIDTH,
  MIN_TOUCH,
  badgeDot,
  PROGRESS_TRACK_HEIGHT,
  SECTION_GAP,
  ROW_SUBLINE_GAP,
  MAX_CONTENT_WIDTH,
  REFERENCE_WIDTH,
  REFERENCE_HEIGHT,
} from './scale';
export type { SpaceToken, RadiusToken, TypeToken, IconToken } from './scale';

export { timing, usePressFeedback, useMotionEnabled } from './motion';

/**
 * Material — depth derived from the palette. For controls and cards only;
 * grounds, the header sheet and anything that swipes stay flat. See the file
 * header for the ramp rule and the numbers behind it.
 */
export { material, ramp, litRamp, shift, lift } from './material';
