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
import { useTranslation } from 'react-i18next';

import { v2Auto } from '@/i18n/v2Auto';

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

  /*
    ── THE V2 UI IS TRANSLATED HERE, FOR NOW ─────────────────────────────────

    Switching to 繁體中文 used to translate the Home selling pane and nothing
    else: only `SellingPane`, `drafts` and `listings` call `t()`, so every
    other v2 screen, the tab bar and the brand bar rendered English whatever
    the language was.

    Every v2 component puts its copy through this one component —
    `PrimaryAction` renders its `label` as a `Text`, `Row` its `title`, `Chip`
    its `label` — so translating a literal child here reaches almost all of it
    without editing eight screens. The lookup is keyed by the English sentence
    (see `src/i18n/v2Auto.ts`).

    `useTranslation()` is here for its SUBSCRIPTION, not for `t`: it is what
    re-renders this component when the language changes. Without it the
    dictionary would only apply to text mounted after the switch.

    ⚠️ Only a plain string child is translated. An array of children (text
    with a nested element) and anything interpolated are left alone — those
    need real `t()` calls, and silently half-translating them would be worse
    than leaving them in English.
  */
  const { i18n } = useTranslation();
  const children =
    typeof rest.children === 'string' ? v2Auto(rest.children, i18n.language) : rest.children;

  return (
    <RNText {...rest} style={[typeScale[variant], { color: c[color] }, style]}>
      {children}
    </RNText>
  );
}
