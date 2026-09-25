/**
 * `OtpField` — six cells for a verification code.
 *
 * ── Borrowed, not rewritten ──
 *
 * The behaviour here is `src/components/ui/OtpInput.tsx`, unchanged. That
 * component is small but every line of it is a bug someone already hit, and
 * none of them is visible by looking at it:
 *
 *  • ONE hidden `TextInput` behind six drawn cells, not six inputs. Six inputs
 *    means six focus targets, and the OS autofill fills only the first.
 *  • `maxLength={length * 2}` — a one-time-code autofill can arrive as a longer
 *    string than the code; a tight max truncates it before the filter runs.
 *  • `completedRef` fires `onComplete` once per code, and RE-ARMS when the
 *    value is shortened from outside. Without the re-arm, a parent that clears
 *    the field after a wrong code gets no `onComplete` on the corrected one —
 *    the user types six digits and nothing happens.
 *
 * What changed is only the drawing: v2 tokens, both schemes, and a filled cell
 * on `surface` with a `MaterialFill` like every other input in this kit. The
 * shipped one is hardcoded `#ffffff` with a `greenDarkest` border, which is a
 * white box on a dark screen.
 *
 * Kept as a SEPARATE component rather than a prop on the old one: the shipped
 * OTP field is still mounted in the old UI's flows, and restyling it in place
 * would change an app people are using today. Same reasoning as `SignInSheet`
 * beside `features/auth/SignInPrompt`.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, for the same reason as the rest of the kit
// — see the note in `Field.tsx`.
import { Pressable } from 'react-native-gesture-handler';

import { control, radius, space, useV2Colors } from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

export function OtpField({
  value,
  onChange,
  onComplete,
  length = 6,
  invalid = false,
  testID = 'otp-input',
}: {
  value: string;
  onChange: (v: string) => void;
  /** Fires once when the last digit lands — including from an autofill. */
  onComplete?: (v: string) => void;
  length?: number;
  /** Draws every cell in `danger`, for a rejected code. */
  invalid?: boolean;
  testID?: string;
}) {
  const c = useV2Colors();
  const inputRef = useRef<TextInput>(null);
  const completedRef = useRef(false);
  const cells = Array.from({ length });

  // Re-arm the one-shot guard whenever the value is externally shortened or
  // cleared, so a corrected code still fires `onComplete`. See the header.
  useEffect(() => {
    if (value.length < length) completedRef.current = false;
  }, [value, length]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.(digits);
      }
    } else {
      completedRef.current = false;
    }
  };

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      {cells.map((_, i) => {
        // The cell the next digit will land in reads as active, so the row
        // shows where you are without a caret the hidden input cannot draw.
        const active = i === value.length;
        const filled = i < value.length;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              { backgroundColor: c.surface },
              (active || filled) && { borderWidth: 1, borderColor: c.accent },
              invalid && { borderWidth: 1, borderColor: c.danger },
            ]}
          >
            <MaterialFill role="surface" ink="ink" radius={radius.md} />
            <Text variant="h3">{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        testID={testID}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        // Deliberately longer than the code — see the header.
        maxLength={length * 2}
        autoFocus
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        style={styles.hiddenInput}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.lg, justifyContent: 'center' },
  cell: {
    flex: 1,
    // A fixed 46pt cell is drawn for a 360dp phone. Six of them plus five gaps
    // overflow the gutter on a small screen, so the row divides what it has and
    // the cells cap instead.
    maxWidth: control.thumb,
    height: control.input,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Full-bleed transparent input over the cells: typing, paste and autofill. */
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
});
