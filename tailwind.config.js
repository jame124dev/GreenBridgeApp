const { colors, spacing, radius, brand } = require('./src/constants/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger:  colors.danger,
        info:    colors.info,
        bg:      colors.light.background,
        surface: colors.light.surface,
        border:  colors.light.border,
        // Deep-forest brand role aliases (mirrors `brand` block in constants/theme.ts).
        // Exposed as Tailwind classes so settings cards can drop inline style={{…}}
        // blocks. Keys are kebab-cased per Tailwind convention.
        brand: {
          primary:               brand.primary,
          'primary-dim':         brand.primaryDim,
          'primary-surface':     brand.primarySurface,
          'primary-border':      brand.primaryBorder,
          'primary-foreground':  brand.primaryForeground,
          'primary-accent':      brand.primaryAccent,
          'brand-glow':          brand.brandGlow,
          foreground:            brand.foreground,
          background:            brand.background,
          surface:               brand.surface,
          'surface-muted':       brand.surfaceMuted,
          border:                brand.border,
          'border-strong':       brand.borderStrong,
          divider:               brand.divider,
          'text-muted':          brand.textMuted,
          placeholder:           brand.placeholder,
          'muted-foreground':    brand.mutedForeground,
          destructive:           brand.destructive,
          'destructive-strong':  brand.destructiveStrong,
          'destructive-bg':      brand.destructiveBg,
          warning:               brand.warning,
          'warning-text':        brand.warningText,
          'warning-bg':          brand.warningBg,
          'warning-border':      brand.warningBorder,
          'success-bg':          brand.successBg,
          'success-border':      brand.successBorder,
          info:                  brand.info,
          'info-text':           brand.infoText,
          'info-bg':             brand.infoBg,
          tertiary:              brand.tertiary,
          'tertiary-dim':        brand.tertiaryDim,
          'tertiary-surface':    brand.tertiarySurface,
          'tertiary-foreground': brand.tertiaryForeground,
        },
      },
      spacing: {
        ...spacing,
        // Additional half-step values used by the legacy scan-detail card layout
        // (S6.2.b2.i fork resolution). Tailwind-convention fractional names so
        // `p-1.5` = 6, `p-2.5` = 10, etc.
        '1.5': 6,
        '2.5': 10,
        '3.5': 14,
        '4.5': 18,
        xxs:   2,
      },
      borderRadius: {
        ...radius,
        // Legacy scan-detail used 4px radius for inputs/inline tags; not in the
        // constants radius scale. Added as `rounded-xs` per Tailwind convention.
        xs: 4,
        // Mirror existing styles using full-pill radius (999).
        pill: 999,
      },
      fontFamily: {
        sans:   ['Inter_400Regular'],
        // Inter_500Medium isn't in the useFonts list, so it silently fell back
        // to the system font wherever `font-medium` was used (every form label).
        // Map to the loaded 600 face — matches `sans-medium`.
        medium: ['Inter_600SemiBold'],
        semi:   ['Inter_600SemiBold'],
        bold:   ['Inter_700Bold'],
        'sans-medium': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        mono:   ['JetBrainsMono_400Regular'],
        // Headlines (Hanken Grotesk) and labels (IBM Plex Sans) families used
        // by the scan-detail cards. S6.2.b2.i additions.
        heading:       ['HankenGrotesk_700Bold'],
        'heading-semi': ['HankenGrotesk_600SemiBold'],
        label:         ['IBMPlexSans_600SemiBold'],
        'label-medium':['IBMPlexSans_500Medium'],
      },
      fontSize: {
        // Scan-detail card typography — port the legacy `fontSize` scale from
        // `src/theme/sizes.ts` so className-based sizing replaces the inline
        // StyleSheet patterns. Values copied verbatim; no visual regression.
        xs:   10,
        sm:   11,
        md:   12,
        base: 13,
        lg:   14,
        xl:   15,
        '2xl':16,
        '3xl':18,
        '4xl':20,
        '5xl':22,
        '6xl':24,
        '7xl':26,
        '8xl':28,
      },
    },
  },
};
