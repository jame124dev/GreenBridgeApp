// Single source of truth for hex colors.
//
// Aligned to the Stitch "Industrial Marketplace System" design (project
// 15822776848387463557): Deep Forest Green primary (#14452f), Sage secondary,
// Industrial Amber tertiary, cool-neutral surfaces with an on-surface ink of
// #121c28. Token KEYS are unchanged so every consumer cascades automatically.

export const colors = {
  // ── Brand: Deep Forest Green (Stitch primary) ────────────────────────────
  primary: '#14452f', // Stitch overridePrimaryColor / primary-container
  primaryLight: '#236b48', // lighter forest for gradients / hovers
  primaryDark: '#002e1c', // Stitch primary (deepest)
  primaryForeground: '#ffffff',
  primaryDim: '#1f7a4d', // legible green for AI-badge / success text on light
  primarySurface: '#e6f2eb', // soft green tint (chips/badges)
  primaryBorder: '#bfe3cd', // Stitch primary-fixed / secondary-container edge
  primaryAccent: '#9fd2b4', // Stitch inverse-primary
  brandGlow: '#81b296', // Stitch on-primary-container
  brandDeep: '#002e1c', // Stitch primary

  // ── Secondary: Sage (Stitch overrideSecondaryColor) ──────────────────────
  secondary: '#769486',
  secondaryForeground: '#ffffff',
  secondarySurface: '#c7e7d7', // Stitch secondary-container

  // ── Tertiary: Industrial Amber (Stitch overrideTertiaryColor) ────────────
  // Reserved for highlights / progress (safety-equipment cue). Distinct from
  // the semantic `warning` tokens below.
  tertiary: '#f4b400',
  tertiaryDim: '#fdbc13', // Stitch tertiary-fixed-dim
  tertiaryForeground: '#261900', // Stitch on-tertiary-fixed
  tertiarySurface: '#ffdea3', // Stitch tertiary-fixed

  // ── Neutrals (cool, "clean floor" surfaces) ──────────────────────────────
  background: '#f8f9ff', // Stitch background / surface
  surface: '#ffffff', // Stitch surface-container-lowest
  surfaceMuted: '#eef4ff', // Stitch surface-container-low
  surfaceSubtle: '#eef2f9', // soft cool tint
  card: '#ffffff',
  foreground: '#121c28', // Stitch on-surface
  inkSlate: '#0f172a',
  text: '#475569',
  textMuted: '#5b6b63', // Stitch on-surface-variant family
  textSubtle: '#94a3b8',
  mutedForeground: '#6b7280',
  placeholder: '#9ca3af',
  border: '#dfe5ec',
  borderStrong: '#c0c9c1', // Stitch outline-variant
  borderSubtle: '#eef2f6',
  divider: '#eef2f9',
  muted: '#eef2f9',

  // ── Status accents ───────────────────────────────────────────────────────
  success: '#10b981',
  successText: '#15803d',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
  warning: '#f59e0b',
  warningText: '#b45309',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  destructive: '#dc3737',
  destructiveStrong: '#b91c1c',
  destructiveBg: '#fef2f2',
  destructiveBorder: '#fecaca',
  info: '#3b82f6',
  infoText: '#1d4ed8',
  infoBg: '#eff6ff',
  infoBorder: '#bfdbfe',
  inspect: '#a855f7',
  inspectText: '#7c3aed',
  inspectBg: '#faf5ff',
  inspectBorder: '#e9d5ff',

  // ── Overlays ─────────────────────────────────────────────────────────────
  backdrop: 'rgba(15, 23, 42, 0.45)',
  whiteSoft: 'rgba(255, 255, 255, 0.12)',
  whiteFaint: 'rgba(255, 255, 255, 0.18)',
  whiteBorder: 'rgba(255, 255, 255, 0.4)',
  whiteText: 'rgba(255, 255, 255, 0.82)',

  // ── Convenience ──────────────────────────────────────────────────────────
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
