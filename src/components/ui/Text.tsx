import { Text as RNText, TextProps } from 'react-native';
import { typography } from '@/constants/theme';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'danger' | 'brand';

const toneClass: Record<Tone, string> = {
  primary:   'text-neutral-900',
  secondary: 'text-neutral-700',
  tertiary:  'text-neutral-500',
  inverse:   'text-white',
  danger:    'text-danger',
  // Forest brand (#14452f) — the actual shipping accent, not the emerald ramp.
  brand:     'text-brand-primary',
};

// Apply the loaded brand faces by variant: Hanken Grotesk for display/headings,
// Inter for body/labels. Set as a CLASS (not inline fontFamily) so it composes
// with the tailwind font scale AND a caller's own `font-*` class still wins
// (e.g. Badge's `font-bold`, Button's `font-semi`). Without this, <Text> fell
// back to the OS system font and the loaded fonts went unused.
const familyClass: Record<Variant, string> = {
  caption:  'font-semi',          // Inter 600 (the loaded "medium")
  bodySm:   'font-sans',          // Inter 400
  body:     'font-sans',          // Inter 400
  bodyMd:   'font-semi',          // Inter 600
  subtitle: 'font-heading-semi',  // Hanken Grotesk 600
  title:    'font-heading',       // Hanken Grotesk 700
  hero:     'font-heading',       // Hanken Grotesk 700
};

export function Text({
  variant = 'body',
  tone = 'primary',
  className = '',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = typography[variant];
  return (
    <RNText
      className={`${familyClass[variant]} ${toneClass[tone]} ${className}`}
      // No inline fontWeight: the font family carries the weight; applying
      // fontWeight on top synthesizes a fake-bold on Android.
      style={[{ fontSize: t.size, lineHeight: t.line }, style]}
      {...rest}
    />
  );
}
