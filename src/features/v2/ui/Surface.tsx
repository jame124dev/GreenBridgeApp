/**
 * `Surface` — a palette role, drawn as a raised object instead of a flat fill.
 *
 *     <Surface role="accent" lightInk radius={radius.pill} elevation="control">
 *       …
 *     </Surface>
 *
 * The gradient, the lit top edge and the shadow all come out of
 * `theme/v2/material.ts`, which derives them from the role. No screen composes
 * a gradient of its own — that is the whole reason this exists. Twelve screens
 * each inventing depth is exactly the drift the token system was built to stop,
 * and depth is easier to get wrong than colour: a symmetric ramp put the green
 * pill's white label at 3.61:1.
 *
 * ── WHERE THIS BELONGS ──
 *
 * Things a finger touches, and cards. **Not** page grounds, **not** the header
 * sheet, and **never** on a surface that scrolls or swipes — see the jank note
 * in `material.ts`.
 *
 * ── `ink` IS NOT OPTIONAL ──
 *
 * It is the text role that sits on this surface, and it is what decides which
 * way the ramp travels — away from the label. It is a ROLE and not a boolean
 * on purpose: whether the ink is light or dark flips between schemes, so a
 * flag chosen while looking at light mode is wrong in dark. See `material.ts`.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  lift,
  material,
  useV2Colors,
  useV2Theme,
  type PaletteRoles,
} from '@/theme/v2';

export function Surface({
  role,
  ink = 'ink',
  radius,
  elevation,
  style,
  children,
  testID,
}: {
  /** Any ground role — `accent`, `accentWash`, `surface`, `fill`. */
  role: keyof PaletteRoles;
  /** The text role sitting on this surface. Decides the ramp direction. */
  ink?: keyof PaletteRoles;
  radius: number;
  /** Omit for a flush surface — a tinted row inside a card does not float. */
  elevation?: 'control' | 'card';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}) {
  const c = useV2Colors();
  const { scheme } = useV2Theme();
  const m = material(c, scheme, role, ink);

  return (
    <View
      testID={testID}
      style={[
        { borderRadius: radius },
        elevation ? lift[elevation] : null,
        // The shadow needs a background to cast from on Android, and the
        // gradient below is clipped — so the flat role sits underneath as the
        // shadow's caster and as the fallback if the gradient ever fails.
        { backgroundColor: c[role] as string },
        style,
      ]}
    >
      {/*
        The gradient is wrapped in a PLAIN View with `pointerEvents="none"`.

        ⚠️ DO NOT put `pointerEvents` on `LinearGradient` itself and assume it
        took. It does not: on the New Architecture the prop is not part of that
        native component's descriptor, so it is dropped, the absolutely-filled
        gradient stays hit-testable, and it EATS every press on the control.
        Nothing looks wrong — the ramp renders perfectly — and the button
        silently stops working. `Scan it` and the whole assistant row were dead
        for exactly this reason, found by pressing them, not by looking.
      */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={m.colours}
          locations={m.locations}
          start={START}
          end={END}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      </View>
      {children}
    </View>
  );
}

const START = { x: 0, y: 0 } as const;
const END = { x: 0, y: 1 } as const;



/**
 * The material layer on its own, for kit components that already own their
 * container (a pressable, a row, a chip) and only need the fill.
 *
 * Absolutely positioned, `pointerEvents="none"`, so it never affects layout or
 * touch. Put it FIRST among the children.
 *
 * ⚠️ NO SHADOW HERE, deliberately. A shadow is elevation on Android and costs
 * a draw pass on whatever surface carries it — and most of these rows and
 * cards live inside Home's two SWIPING panes. Rasterising those panes measured
 * 4.70% -> 9.63% jank; adding elevation to their children is the same kind of
 * cost. Depth on a moving surface comes from the ramp and the lit edge only.
 * Shadows are for static, lifted things — see `lift` in `material.ts`.
 */
export function MaterialFill({
  role,
  ink = 'ink',
  radius,
}: {
  role: keyof PaletteRoles;
  ink?: keyof PaletteRoles;
  radius: number;
}) {
  const c = useV2Colors();
  const { scheme } = useV2Theme();
  const m = material(c, scheme, role, ink);

  return (
    <>
      {/*
        The gradient is wrapped in a PLAIN View with `pointerEvents="none"`.

        ⚠️ DO NOT put `pointerEvents` on `LinearGradient` itself and assume it
        took. It does not: on the New Architecture the prop is not part of that
        native component's descriptor, so it is dropped, the absolutely-filled
        gradient stays hit-testable, and it EATS every press on the control.
        Nothing looks wrong — the ramp renders perfectly — and the button
        silently stops working. `Scan it` and the whole assistant row were dead
        for exactly this reason, found by pressing them, not by looking.
      */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={m.colours}
          locations={m.locations}
          start={START}
          end={END}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      </View>
    </>
  );
}

