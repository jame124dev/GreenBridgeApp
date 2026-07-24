import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fonts, greenDarkest, lab, radius } from '@/constants/theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
};

// Six styled cells backed by ONE hidden numeric TextInput. Tapping anywhere
// focuses the input; the OS one-time-code autofill lands in the same field.
export function OtpInput({ value, onChange, onComplete, length = 6 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const completedRef = useRef(false);
  const cells = Array.from({ length });

  // Re-arm the one-shot onComplete guard whenever the value is externally
  // shortened/cleared (e.g. parent resets the field on a wrong code), so a
  // subsequent single-shot autofill of a corrected code still fires onComplete.
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
        const active = i === value.length;
        const filled = i < value.length;
        return (
          <View key={i} style={[styles.cell, (active || filled) && styles.cellActive]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        testID="otp-input"
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
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
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  cell: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: lab.hairline,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: greenDarkest },
  digit: { fontFamily: fonts.bold, fontSize: 22, color: lab.ink },
  // Full-bleed transparent input over the cells: captures typing + paste + autofill.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
});
