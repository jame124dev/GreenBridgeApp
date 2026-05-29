export const colors = {
  // Brand — GreenBidz-inspired green primary
  primary: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',   // ← default primary
    600: '#059669',   // ← pressed / strong
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Neutral surfaces & text
  neutral: {
    0:   '#FFFFFF',
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0B1220',
  },

  // Semantic
  success: '#16A34A',
  warning: '#F59E0B',
  danger:  '#DC2626',
  info:    '#0EA5E9',

  // Roles (light theme)
  light: {
    background:   '#FFFFFF',
    surface:      '#F9FAFB',
    surfaceAlt:   '#F3F4F6',
    border:       '#E5E7EB',
    borderStrong: '#D1D5DB',
    textPrimary:   '#111827',
    textSecondary: '#4B5563',
    textTertiary:  '#9CA3AF',
    textInverse:   '#FFFFFF',
  },
  // Roles (dark theme)
  dark: {
    background:   '#0F172A',
    surface:      '#111827',
    surfaceAlt:   '#1E293B',
    border:       '#1F2937',
    borderStrong: '#374151',
    textPrimary:   '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary:  '#9CA3AF',
    textInverse:   '#0F172A',
  },
} as const;

// Brand role aliases — mirror legacy `src/theme/colors.ts` hex values so the
// migration to this constants source is a pure import swap with zero visual
// regression. Deep-forest brand (#14452f) drives the actual rendered UI; the
// emerald `colors.primary.{50..900}` scale above is the design-system source
// the marketplace ruleset references but is not what the app currently ships.
// Reconciling the two is a brand-decision out of scope for the token migration
// — these aliases let consumers move off `@/theme` without changing pixels.
export const brand = {
  // Primary brand (deep forest)
  primary:           '#14452f',
  primaryDim:        '#1f7a4d',
  primarySurface:    '#e6f2eb',
  primaryBorder:     '#bfe3cd',
  primaryForeground: '#ffffff',
  primaryAccent:     '#9fd2b4',
  brandGlow:         '#81b296',
  // Surfaces & text (Stitch Industrial Marketplace palette)
  foreground:        '#121c28',
  background:        '#f8f9ff',
  surface:           '#ffffff',
  surfaceMuted:      '#eef4ff',
  border:            '#dfe5ec',
  borderStrong:      '#c0c9c1',
  divider:           '#eef2f9',
  textMuted:         '#5b6b63',
  placeholder:       '#9ca3af',
  mutedForeground:   '#6b7280',
  // Status accents — mirror legacy @/theme/colors.ts values exactly
  destructive:       '#dc3737',
  destructiveStrong: '#b91c1c',
  destructiveBg:     '#fef2f2',
  warning:           '#f59e0b',
  warningText:       '#b45309',
  warningBg:         '#fffbeb',
  warningBorder:     '#fde68a',
  successBg:         '#f0fdf4',
  successBorder:     '#bbf7d0',
  info:              '#3b82f6',
  infoText:          '#1d4ed8',
  infoBg:            '#eff6ff',
  // Tertiary (Industrial Amber)
  tertiary:          '#f4b400',
  tertiaryDim:       '#fdbc13',
  tertiarySurface:   '#ffdea3',
  tertiaryForeground:'#261900',
} as const;

export const gradients = {
  hero: ['#14452f', '#236b48'] as const,
} as const;

// Re-exports of legacy `@/theme` non-color surfaces so scan-tree files can
// drop their `from '@/theme'` imports (S3). Spacing + radius intentionally
// NOT re-exported here — they exist with different numeric values in this
// constants module and the resolution is owned by S6 (NativeWind sweep).
//
// Relative paths (not `@/theme/*`) so jiti can resolve them when
// `tailwind.config.js` `require()`s this module without the babel
// path-alias plugin in play. `shadows` is deliberately NOT re-exported
// here — pulling `../theme/shadows` in transitively loads `./colors` via
// jiti/sucrase and chokes on parsing. Consumers of `shadows` import
// directly from `@/theme/shadows`.
export { fonts } from '../theme/typography';
export { fontSize, letterSpacing, lineHeight, sizes } from '../theme/sizes';

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,   // ← default for cards & sheets
  hero: 40,    // ← profile hero bottom curve; oversized intentionally
  full: 9999,
} as const;

export const typography = {
  // size / lineHeight / weight
  caption:  { size: 12, line: 16, weight: '500' },
  bodySm:   { size: 14, line: 20, weight: '400' },
  body:     { size: 16, line: 24, weight: '400' },
  bodyMd:   { size: 16, line: 24, weight: '500' },
  subtitle: { size: 18, line: 26, weight: '600' },
  title:    { size: 24, line: 30, weight: '700' },
  hero:     { size: 32, line: 38, weight: '700' },
} as const;

export const elevation = {
  // Subtle only. Used sparingly.
  none: { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const motion = {
  // Durations (ms)
  tap:        100,
  micro:      150,
  short:      220,
  medium:     280,
  long:       360,
  // Easings
  easeOut:    'easeOut',
  easeInOut:  'easeInOut',
  spring:     { damping: 18, stiffness: 220, mass: 1 },
  springSoft: { damping: 22, stiffness: 160, mass: 1 },
} as const;

export const layout = {
  screenPaddingX: spacing.lg,    // 16
  sectionGap:     spacing['2xl'], // 24
  cardPadding:    spacing.lg,    // 16
  minTouch:       48,            // Cross-platform safe (≥ Material 48, > iOS 44)
} as const;
