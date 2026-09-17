/**
 * `Chip` — the small pill that carries a value beside something else.
 *
 * Three screens arrived at this independently under three names: a match
 * relevance badge (6d, "92%"), a settings-row count (6f, "2 of 4"), and a
 * draft age (6a, "2d"). Same geometry, same two tones, one component.
 *
 * `accent` is the tone that means "this is the reason you are looking at this
 * row". `neutral` is everything else. There is no third tone: the design has
 * exactly one warm colour (`danger`) and it is not for chips.
 *
 * Decorative by default — a chip repeating information already in the row is
 * hidden from screen readers. When the chip is the only place a value appears,
 * pass the value into the parent `Row`'s `accessibilityLabel` instead, because
 * a Row is a single accessible element and never announces its own children.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { control, radius, space, useV2Colors } from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

export function Chip({
  label,
  tone = 'neutral',
  size = 'sm',
  glyph,
}: {
  label: string;
  tone?: 'accent' | 'neutral';
  /**
   * `sm` (26pt, `micro` type) is the value beside a row.
   * `md` (34pt, tracked `eyebrow`) is a status badge that opens a screen —
   * "✦ AI ANALYZING". Big enough to carry a glyph and read as a statement.
   */
  size?: 'sm' | 'md';
  /** Leading icon. Size it at `icon.xs` — the label is 10pt and a larger
   *  glyph outweighs the thing it is qualifying. */
  glyph?: ReactNode;
}) {
  const c = useV2Colors();
  const accented = tone === 'accent';
  const md = size === 'md';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.chip,
        md ? styles.md : styles.sm,
        { backgroundColor: accented ? c.accentWash : c.fill },
      ]}
    >
      {/* Material. A chip is small and inline — ramp and lit edge, no shadow. */}
      <MaterialFill
        role={accented ? 'accentWash' : 'fill'}
        ink={accented ? 'accentInk' : 'inkMuted'}
        radius={radius.pill}
      />
      {glyph}
      <Text
        variant={md ? 'eyebrow' : 'micro'}
        color={accented ? 'accentInk' : 'inkMuted'}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    overflow: 'hidden',
    flexDirection: 'row',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  sm: { height: control.chipSm, paddingHorizontal: space.xl },
  md: { alignSelf: 'flex-start', height: control.chip, paddingHorizontal: space.xl },
});
