import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CurrencyInput from 'react-native-currency-input';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { CURRENCY_OPTIONS } from '@/features/settings/constants';
import { convertPrice } from '@/features/scanner/currencyFx';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { SupportedCurrency } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

import { FieldGroup } from './SectionBand';
import { FieldLabel } from './FieldLabel';
import { CONTROL_HEIGHT, ICON } from './metrics';

/**
 * Pricing + quantity. Buy-now / make-offer toggle drives whether the price
 * input renders. The currency row sits above the amount input so the prefix and
 * the chosen currency stay visually linked.
 *
 * Currency was a pill row — the fourth way this form asked a choose-one
 * question. It is now a `PickerRow` over an `OptionSheet`, the same idiom as
 * Category and Condition (FORM_UX_PANEL.md §E.2). The price-FORMAT segment
 * stays a segment: two mutually exclusive modes that change what the rest of the
 * card renders should be visible without a tap, so it keeps its pills and pays
 * the a11y debt in place instead (check glyph + radiogroup, B6).
 */
/** Declared once so the two pills cannot drift apart as they had begun to. */
const PRICE_FORMATS = [
  { value: 'buyNow', key: 'mobile.detail.priceBuyNow' },
  { value: 'offer', key: 'mobile.detail.priceMakeOffer' },
] as const;

export function PricingCard() {
  const { t } = useTranslation();
  const { control, watch, setValue, getValues } = useFormContext<DetailFormInput>();
  const priceFormat = watch('priceFormat');
  const priceCurrency = watch('priceCurrency');
  // ISO code, not the symbol — matches the scrap-value and profit figures below
  // it on this same screen. A page that reads "USD 12,500" in one card and
  // "$ 12,500" in the next invites the reader to wonder whether they are the
  // same currency, and on a cross-border marketplace "$" alone does not say.
  const currencyPrefix = `${priceCurrency} `;

  const handleCurrencyChange = (next: SupportedCurrency) => {
    if (next === priceCurrency) return;
    const raw = getValues('pricePerUnit');
    const numeric = raw ? Number(raw) : NaN;
    if (Number.isFinite(numeric) && numeric > 0) {
      const converted = convertPrice(numeric, priceCurrency, next);
      setValue('pricePerUnit', String(converted), { shouldValidate: true });
    }
    setValue('priceCurrency', next, { shouldValidate: true });
  };

  return (
    <FieldGroup>
      {/* Price MODE + quantity + the sentence explaining the empty Make-offer
          branch are ONE group. `FieldGroup` rules a hairline between its direct
          children, and a rule between a control and the line that explains it
          would read as two unrelated facts. */}
      <View className="gap-sm">
      <View className="flex-row gap-sm items-start">
        <View className="flex-1 gap-1.5">
          <FieldLabel text={t('mobile.detail.sectionPrice')} required />
          <View className="flex-row gap-1.5" accessibilityRole="radiogroup">
            {PRICE_FORMATS.map((fmt) => {
              const active = priceFormat === fmt.value;
              const label = t(fmt.key);
              return (
                <Pressable
                  key={fmt.value}
                  /* No vertical padding: `styles.segment` fixes the height so
                     this pill and the quantity stepper beside it cannot drift
                     apart. Content is centred, so padding adds nothing. */
                  className={`flex-1 flex-row items-center justify-center gap-xs rounded-xs border ${
                    active
                      ? 'bg-brand-primary border-brand-primary'
                      : 'border-brand-border-strong'
                  }`}
                  style={styles.segment}
                  onPress={() => setValue('priceFormat', fmt.value)}
                  role="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={label}
                >
                  {active ? (
                    <MaterialIcons name="check" size={ICON.adornment} color={brand.primaryForeground} />
                  ) : null}
                  <Text
                    className={`font-label-medium text-lg ${
                      active ? 'text-brand-primary-foreground' : 'text-brand-text-muted'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View className="gap-1.5">
          <FieldLabel text={t('mobile.detail.sectionQuantity')} />
          <Controller
            control={control}
            name="quantity"
            render={({ field: { value, onChange } }) => (
              <View
                /* Same `CONTROL_HEIGHT` as the price pills to its left — this
                   used to be `h-12` while they were padding-driven, which is
                   what made the row's bottom edge step. */
                className="flex-row items-center border border-brand-border-strong rounded-xs overflow-hidden"
                style={styles.segment}
              >
                <Pressable
                  onPress={() => onChange(Math.max(1, value - 1))}
                  className="h-full items-center justify-center"
                  style={{ width: 40 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.detail.decreaseQuantity', {
                    defaultValue: 'Decrease quantity',
                  })}
                >
                  <MaterialIcons name="remove" size={ICON.field} color={brand.foreground} />
                </Pressable>
                <Text
                  className="text-center font-bold text-xl text-brand-foreground"
                  style={{ minWidth: 32 }}
                >
                  {value}
                </Text>
                <Pressable
                  onPress={() => onChange(value + 1)}
                  className="h-full items-center justify-center"
                  style={{ width: 40 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.detail.increaseQuantity', {
                    defaultValue: 'Increase quantity',
                  })}
                >
                  <MaterialIcons name="add" size={ICON.field} color={brand.foreground} />
                </Pressable>
              </View>
            )}
          />
        </View>
      </View>

      {/*
        WHY "Make offer" NEEDS A SENTENCE AND "Buy now" DOES NOT.

        Choosing Make offer removes the amount and currency fields entirely —
        correctly, there is no number to ask for — but the screen said nothing
        about it, so the listing ends up with no figure anywhere and the seller
        is left unsure whether they forgot something or the form lost it. The
        checklist adds to the doubt by ticking Price as done with no price on
        screen.

        One line, shown only in the branch that has no fields, saying what the
        empty space means and what will happen instead.
      */}
      {priceFormat === 'offer' ? (
        <Text className="font-sans text-sm text-brand-text-muted">
          {/* One short line, not two: this screen is already dense with caps
              labels and hints, and the point fits in six words. */}
          {t('mobile.detail.offerExplainerShort', {
            defaultValue: 'No price shown — buyers send offers.',
          })}
        </Text>
      ) : null}
      </View>

      {/* Currency and the amount it prefixes are ONE group for the same reason:
          the row answers "in what" and the input answers "how much", and
          `currencyPrefix` means the input literally renders the row's answer. */}
      {priceFormat === 'buyNow' ? (
        <View className="gap-sm">
        {/*
          ⚠️ CURRENCY STAYS PILLS — the one choose-one field NOT converted to a
          PickerRow, and the exception is deliberate.

          The convergence on one idiom exists to stop the seller re-learning
          the grammar at every card, and it pays for itself where a sheet
          replaces five wrapped chips (Condition) or a long taxonomy
          (Category). Currency has TWO options. Putting them behind a row plus
          a sheet turns a one-tap answer into three taps and a modal, to save
          one line of vertical space — the idiom costing more than it saves.

          It keeps everything the conversion was actually for: the same check
          glyph, `radiogroup` + `role="radio"` + `checked`, and a 44pt target,
          exactly as the Buy-now / Make-offer segment above.
        */}
        <View className="gap-1.5">
          <FieldLabel text={t('mobile.detail.sectionCurrency', { defaultValue: 'CURRENCY' })} />
          <View className="flex-row gap-1.5" accessibilityRole="radiogroup">
            {CURRENCY_OPTIONS.map((opt) => {
              const active = priceCurrency === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  className={`flex-row items-center justify-center gap-xs px-md rounded-xs border ${
                    active
                      ? 'bg-brand-primary border-brand-primary'
                      : 'border-brand-border-strong'
                  }`}
                  style={styles.segment}
                  /* `handleCurrencyChange` CONVERTS an amount already typed —
                     the one piece of logic this control must never lose. */
                  onPress={() => handleCurrencyChange(opt.value)}
                  role="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={opt.label}
                >
                  {active ? (
                    <MaterialIcons name="check" size={ICON.adornment} color={brand.primaryForeground} />
                  ) : null}
                  <Text
                    className={`font-label-medium text-lg ${
                      active ? 'text-brand-primary-foreground' : 'text-brand-text-muted'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Controller
          control={control}
          name="pricePerUnit"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <View className="gap-1.5">
              <CurrencyInput
                style={{
                  backgroundColor: brand.surface,
                  borderWidth: 1,
                  borderColor: brand.borderStrong,
                  borderRadius: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 15,
                  color: brand.foreground,
                }}
                value={value ? Number(value) : null}
                onChangeValue={(num) => onChange(num != null ? String(num) : '')}
                onBlur={onBlur}
                prefix={currencyPrefix}
                delimiter=","
                separator="."
                precision={2}
                minValue={0}
                keyboardType="decimal-pad"
                placeholder={`${currencyPrefix}0.00`}
                placeholderTextColor={brand.placeholder}
              />
              {fieldState.error ? (
                <Text className="text-brand-destructive text-md" style={{ marginTop: 2 }}>
                  {fieldState.error.message}
                </Text>
              ) : null}
            </View>
          )}
        />
        </View>
      ) : null}
    </FieldGroup>
  );
}

const styles = StyleSheet.create({
  /*
    A FIXED height, not a minimum. Every boxed control that can share a row with
    another one uses it, so their bottom edges line up by construction rather
    than by two padding models happening to agree. Clears WCAG 2.5.8 (24pt) and
    the 44pt platform target with room over.
  */
  segment: { height: CONTROL_HEIGHT },
});
