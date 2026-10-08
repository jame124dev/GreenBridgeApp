import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';
import { useFieldGroupSurface } from './SectionBand';
import { ICON } from './metrics';

/**
 * ONE idiom for every choose-one(-or-more) field: label, the current answer,
 * Choose/Change, chevron — tapping opens a sheet.
 *
 * WHY. The form expressed the same question six different ways: a chevron row
 * (Category), five wrapping pills (Condition), a two-pill segment (Price mode),
 * pills (Currency), a segment (Installation) and a stepper (Quantity). The
 * interaction designer and the a11y reviewer both landed on it independently and
 * it is the panel's strongest single observation (`FORM_UX_PANEL.md` §A, §E.2).
 * Category was ALREADY this shape, so this is not a new pattern — it is the
 * screen's own pattern, extracted so the other three can stop inventing theirs.
 *
 * It also retires the a11y problem rather than patching it: five chips signalled
 * by fill colour alone, with no check glyph and no radiogroup semantics (B6),
 * become one row whose value is a string a screen reader can simply read.
 *
 * The row knows about both surfaces because its CONTAINER does — see
 * `SectionBand.tsx`. Inside a grey-banded flush group a bordered box around the
 * value would be exactly the per-field chrome the band is there to remove; in
 * the legacy card it is what makes the row look tappable.
 */
export function PickerRow({
  label,
  value,
  placeholder,
  onPress,
  required,
  ai,
  error,
  valueLines = 2,
  testID,
  children,
}: {
  label: string;
  /** The current answer, already localised. Empty/undefined shows `placeholder`. */
  value?: string;
  placeholder: string;
  onPress: () => void;
  required?: boolean;
  ai?: boolean;
  /** Field-level error message, rendered under the row. */
  error?: string;
  valueLines?: number;
  /**
   * Scopes a test to ONE row. Needed from the moment a card had two of these:
   * "Choose" is the same word on every unanswered row, so `getByText('Choose')`
   * stopped identifying a field.
   */
  testID?: string;
  /** Anything that belongs UNDER the row — e.g. installation's buyer-facing hint. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const surface = useFieldGroupSurface();
  const answered = Boolean(value);

  return (
    <View className="gap-1.5" testID={testID}>
      <FieldLabel text={label} required={required} ai={ai} />
      <Pressable
        className="flex-row items-center gap-sm"
        // StyleSheet objects in an ARRAY, never a `({ pressed }) => …` callback:
        // NativeWind's interop spreads the inline style prop and spreading a
        // function yields `{}`, so the style vanishes at runtime while jest
        // renders it perfectly. See `noFunctionStyleProp.test.ts`.
        style={[styles.row, surface === 'card' && styles.rowBoxed]}
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
      >
        <Text
          className={`flex-1 font-label-medium text-lg ${
            answered ? 'text-brand-foreground' : 'text-brand-placeholder'
          }`}
          numberOfLines={valueLines}
        >
          {value || placeholder}
        </Text>
        <Text className="font-label text-md text-brand-primary">
          {answered
            ? t('mobile.detail.change', { defaultValue: 'Change' })
            : t('mobile.detail.choose', { defaultValue: 'Choose' })}
        </Text>
        <MaterialIcons name="chevron-right" size={ICON.field} color={brand.placeholder} />
      </Pressable>
      {error ? <Text className="text-brand-destructive text-md">{error}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 44, not the 40 the old bordered row came to: this is the whole control, and
  // it is the one number FORM_INPUT_RULES does not negotiate.
  row: { minHeight: 44 },
  rowBoxed: {
    borderWidth: 1,
    borderColor: brand.borderStrong,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
