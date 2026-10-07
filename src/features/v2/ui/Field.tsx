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
import React, { forwardRef, type ReactNode } from 'react';
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

import { Eye, EyeOff } from 'lucide-react-native';

import {
  MIN_TOUCH,
  control,
  icon,
  radius,
  space,
  type as typeScale,
  usePressFeedback,
  useV2Colors,
  type TypeToken,
} from '@/theme/v2';

import { useV2Copy } from '@/i18n/v2Auto';

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

/**
 * ⚠️ `forwardRef` — a form cannot chain its fields without it.
 *
 * `returnKeyType="next"` on a field is a promise that the key moves to the next
 * input, and keeping that promise means calling `.focus()` on it, which needs a
 * ref. Without one, every field on a four-field form dead-ends and the person
 * closes the keyboard and re-taps four times. It also silently disables
 * react-hook-form's `shouldFocusError`, so a failed submit leaves the caret
 * nowhere and the first bad field can be off screen.
 *
 * The ref is the `TextInput`'s, not the wrapper's — `.focus()` is what callers
 * want, and handing back a `View` that cannot focus would be worse than no ref.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field({
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
}: FieldProps, ref) {
  const c = useV2Colors();
  const tr = useV2Copy();

  return (
    <View style={style}>
      {label ? (
        // `inkMuted`, not `inkSubtle`. `palette.ts` documents `inkSubtle`
        // (2.94:1 on light base) as acceptable for METADATA — a timestamp, a
        // row's third line. This label is the input's ACCESSIBLE NAME and the
        // only thing saying what to type, which is not metadata.
        <Text variant="eyebrow" color="inkMuted" style={styles.label}>
          {label}
        </Text>
      ) : null}

      {/*
        ⚠️ THE RESTING BORDER IS NOT DECORATION — WITHOUT IT THE INPUT IS INVISIBLE.

        A field is `surface` on a `base` ground. Those are `#F5F9F7` on `#FFFFFF`
        in light and `#16261F` on `#08150F` in dark: **1.06:1** and **1.18:1**.
        WCAG 1.4.11 asks 3:1 of a control's visible boundary, so until 2026-09-22
        the only thing that made a field look like a field was the red border it
        got when it was WRONG. Two independent reviewers opened the auth screens
        cold and both led with it — one described seeing "two labels floating
        over nothing".

        This is the same finding `PrimaryAction` already documents for its
        `quiet` variant (1.27:1 on base) and resolves the same way: the shape
        has to be drawn, not implied by a fill that is a rounding error away
        from the page.

        `hairlineStrong`, not `hairline` — `hairline` is `#F2F5F3`, which is
        LIGHTER than the surface it would outline.
      */}
      <View
        style={[
          styles.field,
          { backgroundColor: c.surface, borderWidth: 1, borderColor: c.fieldBorder },
          invalid && { borderColor: c.danger },
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
          ref={ref}
          {...input}
          multiline={multiline}
          accessibilityLabel={accessibilityLabel ?? label}
          /* A placeholder is a native string prop, not a `Text` child, so the
             kit's translation interception never sees it — see `useV2Copy`. */
          placeholder={input.placeholder ? tr(input.placeholder) : input.placeholder}
          /*
            `inkSubtle`, not `inkDisabled`. Measured 2026-10-05: `inkDisabled`
            (#B4C0B9) is 1.77:1 on the field fill against the 4.5:1 §7 asks of
            text — and on an empty form the placeholder is the ONLY content in
            the box, so five fields read as five blank pills. `inkSubtle` is
            4.69:1 light / 4.77:1 dark and is already in the palette.
          */
          placeholderTextColor={c.inkSubtle}
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
          // `alert` alone does not announce on Android — TalkBack reads a live
          // region, and a validation message that appears silently is a
          // validation message a screen-reader user never learns about.
          accessibilityLiveRegion={invalid ? 'assertive' : 'none'}
        >
          {help}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * A bare tappable glyph — no ground, no shape, just the icon.
 *
 * Named `FieldIcon` when it was first needed inside a `Field`, but it is the
 * general small icon button: the review flow's back arrow uses it too, where
 * `IconAction` (a 46pt filled accent circle) would put a second green shape on
 * a screen that already has its one primary pill.
 *
 * ⚠️ IT CARRIES A REAL BOX, NOT `hitSlop`. The target used to be made up
 * entirely of slop: `space.xl` (12) on each side of an `icon.lg` (18) glyph is
 * **42pt**, two short of the `MIN_TOUCH` this very file asserts — and the
 * password eye is the one control here a person jabs at repeatedly. `BrandBar`
 * reached the same conclusion about its own header controls and swapped slop
 * for real boxes; slop also cannot be seen by a layout dump, so an undersized
 * target measured as correct.
 *
 * `minWidth`/`minHeight`, so a glyph LARGER than the minimum is not squeezed.
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
      style={[styles.glyphBox, disabled && styles.disabled, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * `RevealToggle` — the eye inside a password field.
 *
 * Lives in the kit because five fields across three auth screens need it and
 * the first two grew their own copy. It is `trailing` content for a `Field`.
 *
 * The label flips with the state, so a screen reader announces what the control
 * will DO rather than what the field currently is — "Show password" while
 * hidden, "Hide password" while shown.
 *
 * Callers that own TWO password fields should drive both from ONE piece of
 * state: revealing only one of a password/confirm pair leaves the single
 * question that pair exists to answer — do they match? — unanswerable by
 * looking.
 */
export function RevealToggle({
  on,
  onToggle,
  labels,
}: {
  /** True when the password is visible. */
  on: boolean;
  onToggle: () => void;
  /** Localised `{ show, hide }`. Defaults are English, for a screen with no i18n. */
  labels?: { show: string; hide: string };
}) {
  const c = useV2Colors();
  return (
    <GlyphButton
      accessibilityLabel={on ? (labels?.hide ?? 'Hide password') : (labels?.show ?? 'Show password')}
      onPress={onToggle}
    >
      {on ? (
        <EyeOff size={icon.lg} color={c.inkSubtle} strokeWidth={1.75} />
      ) : (
        <Eye size={icon.lg} color={c.inkSubtle} strokeWidth={1.75} />
      )}
    </GlyphButton>
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
  /** See `GlyphButton` — a real 44pt box, because hitSlop was 42 and invisible. */
  glyphBox: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
});
