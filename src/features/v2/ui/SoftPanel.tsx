/**
 * `SoftPanel` — a filled, rounded block.
 *
 * The design removed boxes deliberately ("space instead of boxes"), so a
 * filled block is a strong signal and has to be spent carefully: **at most one
 * per screen**, and only for a RESULT rather than an input. That is why it
 * keeps a ground while every field around it lost its border — the profit
 * figures on Review · pricing are something the app worked out for you, and
 * the pre-submit verdict on Review · location is a judgement about your draft.
 *
 * If you reach for a second one on the same screen, the thing to question is
 * the hierarchy, not the component.
 *
 * Not `TintedRow`: that is a tappable row with a glyph circle and a chevron.
 * This is a container for whatever you put in it.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useV2Colors } from '@/theme/v2';

import { MaterialFill } from './Surface';

export function SoftPanel({
  children,
  ground = 'wash',
  style,
}: {
  children: ReactNode;
  /** `surface` for a panel that must read as quieter than the wash. */
  ground?: 'wash' | 'surface';
  style?: StyleProp<ViewStyle>;
}) {
  const c = useV2Colors();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: ground === 'wash' ? c.wash : c.surface },
        style,
      ]}
    >
      {/* Material. Panels sit inside scrolling review steps, so no shadow. */}
      <MaterialFill role={ground === 'wash' ? 'wash' : 'surface'} ink="ink" radius={radius.xl} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.xl, padding: space['5xl'], overflow: 'hidden' },
});
