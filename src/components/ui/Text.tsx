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
  brand:     'text-primary-600',
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
      className={`${toneClass[tone]} ${className}`}
      style={[{ fontSize: t.size, lineHeight: t.line, fontWeight: t.weight as any }, style]}
      {...rest}
    />
  );
}
