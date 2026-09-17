/**
 * `Text` — the only way v2 renders type.
 *
 * Takes a role from the type scale and a colour role from the palette. It
 * cannot be given a font size, a family, a tracking value or a raw colour,
 * which is the point: those are the four things that drift when eleven screens
 * are built at different times.
 *
 *     <Text variant="eyebrow" color="inkSubtle">Drafts</Text>
 *     <Text variant="rowTitle" numberOfLines={1}>{listing.title}</Text>
 */
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import {
  type as typeScale,
  useV2Colors,
  type PaletteRoles,
  type TypeToken,
} from '@/theme/v2';

/** Colour roles that make sense on text. */
export type TextColor = Extract<
  keyof PaletteRoles,
  | 'ink'
  | 'inkMuted'
  | 'inkSubtle'
  | 'inkDisabled'
  | 'accent'
  | 'accentInk'
  | 'onAccent'
  | 'danger'
  // Over photography. These do NOT flip by scheme — see palette.ts.
  | 'onScrim'
  | 'onScrimTint'
  | 'onScrimPill'
>;

export type TextProps = Omit<RNTextProps, 'style'> & {
  variant?: TypeToken;
  color?: TextColor;
  /** Layout only — margins, flex, alignment. Never type or colour. */
  style?: RNTextProps['style'];
};

export function Text({
  variant = 'body',
  color = 'ink',
  style,
  ...rest
}: TextProps) {
  const c = useV2Colors();
  return <RNText {...rest} style={[typeScale[variant], { color: c[color] }, style]} />;
}
