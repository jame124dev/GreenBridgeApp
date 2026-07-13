/**
 * Centralised font-family constants. Use these in `StyleSheet.create({...})`
 * `fontFamily` declarations — never hardcode `'Inter_400Regular'` etc.
 *
 * Three families per the Stitch "Industrial Marketplace System" design:
 *   • Hanken Grotesk → headlines  (`heading`, `headingSemibold`)
 *   • Inter          → body       (`regular`, `semibold`, `bold`)
 *   • IBM Plex Sans  → labels/meta (`label`, `labelMedium`) e.g. label-caps
 *
 * Loaded once at startup in `app/_layout.tsx` via the matching
 * `@expo-google-fonts/*` packages. `Inter_500Medium` is intentionally NOT
 * loaded — reach for `fonts.regular`/`fonts.semibold` instead.
 */
export const fonts = {
  // Body (Inter)
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Headlines (Hanken Grotesk)
  headingBold: 'HankenGrotesk_800ExtraBold',
  heading: 'HankenGrotesk_700Bold',
  headingSemibold: 'HankenGrotesk_600SemiBold',
  // Labels / metadata (IBM Plex Sans)
  label: 'IBMPlexSans_600SemiBold',
  labelMedium: 'IBMPlexSans_500Medium',
  // Code / numeric
  mono: 'JetBrainsMono_400Regular',
} as const;

export type FontKey = keyof typeof fonts;

/**
 * @deprecated Use `fonts.regular` / `fonts.mono` instead. Left in place so
 * legacy callers keep compiling; remove once no usages remain.
 */
export const typography = {
  fontSans: fonts.regular,
  fontMono: fonts.mono,
} as const;
