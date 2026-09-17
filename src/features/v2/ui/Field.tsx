/**
 * `Field` — a text input, and `GlyphButton` — a bare tappable icon.
 *
 * The kit had no input at all until the chat composer needed one, and the four
 * Review screens (7b–7e) are entirely forms, so this is the shape they share.
 *
 * ── Three RN details baked in, each of which renders fine and is wrong ──
 *
 * 1. **`<Text variant>` cannot style a `TextInput`.** The type token is spread
 *    onto the input's own `style` instead. That is the one sanctioned place a
 *    raw type object appears in a screen — the adherence test permits a spread
 *    of `typeScale.x`, but not a literal `fontSize:`.
 *
 * 2. **Android gives a multiline `TextInput` its own larger vertical padding**,
 *    which silently makes a multiline field taller than a single-line one on
 *    Android and not on iOS. `paddingVertical` is pinned so both agree.
 *
 * 3. **`textAlignVertical: 'top'`** — without it, Android centres the first
 *    line of a multiline field and the text appears to drift downward as the
 *    field grows.
 *
 * `label` renders as the tracked eyebrow above the field, which is how every
 * other section in this design is titled. Passing `label` also wires
 * `accessibilityLabel`, so the input is never announced as just "text field".
 */
import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import {
  control,
  radius,
  space,
  type as typeScale,
  usePressFeedback,
  useV2Colors,
  type TypeToken,
} from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type FieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Tracked eyebrow above the field. Also becomes the accessibility label. */
  label?: string;
  /**
   * Type role for the input's own text. Defaults to `body` (13pt).
   *
   * A title field carries more weight than a description in the same form —
   * the canvas draws them at different sizes, and hardcoding one token made
   * 7c's title read no louder than its own supporting fields.
   */
  variant?: TypeToken;
  /**
   * Visible lines for a multiline field. Sets `maxHeight` from the variant's
   * own leading rather than a fixed 2× guess, so a description block can be
   * as tall as it is drawn.
   */
  lines?: number;
  /** One line under the field — a hint, or an error when `invalid`. */
  help?: string;
  /** Draws the field in `danger` and gives `help` the alert role. */
  invalid?: boolean;
  /** Controls inside the field, after the text — a camera, a clear button. */
  trailing?: ReactNode;
  /** Controls inside the field, before the text. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Field({
  label,
  variant = 'body',
  lines,
  help,
  invalid = false,
  trailing,
  leading,
  multiline,
  style,
  accessibilityLabel,
  ...input
}: FieldProps) {
  const c = useV2Colors();

  return (
    <View style={style}>
      {label ? (
        <Text variant="eyebrow" color="inkSubtle" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          { backgroundColor: c.surface },
          invalid && { borderWidth: 1, borderColor: c.danger },
        ]}
      >
        {/* Material. A field is a 52pt filled box on `surface` — structurally
            the same shape as `Stepper`, which sits in the SAME ROW on 7c
            pricing. Ramping the stepper and not the field left two identical
            boxes side by side, one with depth and one without, which is a
            difference the eye reads as a bug rather than as meaning. */}
        <MaterialFill role="surface" ink="ink" radius={radius.xl} />
        {leading}
        <TextInput
          {...input}
          multiline={multiline}
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={c.inkDisabled}
          style={[
            styles.input,
            typeScale[variant],
            { color: c.ink },
            multiline && styles.multiline,
            multiline && lines ? { maxHeight: maxHeightFor(variant, lines) } : null,
          ]}
        />
        {trailing}
      </View>

      {help ? (
        <Text
          variant="caption"
          color={invalid ? 'danger' : 'inkSubtle'}
          style={styles.help}
          accessibilityRole={invalid ? 'alert' : undefined}
        >
          {help}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A bare tappable glyph — no ground, no shape, just the icon.
 *
 * Named `FieldIcon` when it was first needed inside a `Field`, but it is the
 * general small icon button: the review flow's back arrow uses it too, where
 * `IconAction` (a 46pt filled accent circle) would put a second green shape on
 * a screen that already has its one primary pill.
 *
 * The 44pt target is made up entirely by `hitSlop`, so the drawn glyph can be
 * as small as the layout needs.
 *
 * `accessibilityLabel` is required — there is no visible text to fall back on.
 */
export function GlyphButton({
  accessibilityLabel,
  onPress,
  children,
  disabled = false,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={{ top: space.xl, bottom: space.xl, left: space.xl, right: space.xl }}
      style={[disabled && styles.disabled, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * The tallest a multiline field may grow, from the variant's own line height.
 *
 * Reading the leading off the token rather than assuming one keeps a 3-line
 * field 3 lines tall whichever type role it is set in.
 */
function maxHeightFor(variant: TypeToken, lines: number): number {
  const leading = (typeScale[variant] as { lineHeight?: number }).lineHeight ?? 20;
  return leading * lines + space['3xl'] * 2;
}

const styles = StyleSheet.create({
  label: { marginBottom: space.md },
  field: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    minHeight: control.input,
    paddingHorizontal: space['3xl'],
    borderRadius: radius.xl,
  },
  input: {
    flex: 1,
    // Without minWidth:0 a long value refuses to shrink and pushes `trailing`
    // out of the field — the same flex trap as `Row`'s text column.
    minWidth: 0,
    paddingVertical: space.md,
  },
  multiline: {
    maxHeight: control.input * 2,
    textAlignVertical: 'top',
    paddingTop: space['3xl'],
  },
  help: { marginTop: space.md },
  disabled: { opacity: 0.45 },
});
