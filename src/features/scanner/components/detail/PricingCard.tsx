import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CurrencyInput from 'react-native-currency-input';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { CURRENCY_OPTIONS } from '@/features/settings/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { SupportedCurrency } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';

const CURRENCY_PREFIX: Record<SupportedCurrency, string> = {
  USD: '$',
  TWD: 'NT$',
  HKD: 'HK$',
  CNY: '¥',
  JPY: '¥',
  THB: '฿',
};

/**
 * Pricing + quantity. Buy-now / make-offer toggle drives whether the price
 * input renders. Currency picker pills sit above the amount input so the
 * prefix and the chosen currency stay visually linked.
 */
export function PricingCard() {
  const { t } = useTranslation();
  const { control, watch, setValue } = useFormContext<DetailFormInput>();
  const priceFormat = watch('priceFormat');
  const priceCurrency = watch('priceCurrency');
  const currencyPrefix = `${CURRENCY_PREFIX[priceCurrency] ?? '$'} `;

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <View className="flex-row gap-sm items-start">
        <View className="flex-1 gap-1.5">
          <FieldLabel text={t('mobile.detail.sectionPrice')} required />
          <View className="flex-row gap-1.5">
            <Pressable
              className={`flex-1 py-2.5 rounded-xs border items-center ${
                priceFormat === 'buyNow'
                  ? 'bg-brand-primary border-brand-primary'
                  : 'border-brand-border-strong'
              }`}
              onPress={() => setValue('priceFormat', 'buyNow')}
              accessibilityRole="radio"
              accessibilityState={{ selected: priceFormat === 'buyNow' }}
              accessibilityLabel={t('mobile.detail.priceBuyNow')}
            >
              <Text
                className={`font-label-medium text-lg ${
                  priceFormat === 'buyNow' ? 'text-brand-primary-foreground' : 'text-brand-text-muted'
                }`}
              >
                {t('mobile.detail.priceBuyNow')}
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-2.5 rounded-xs border items-center ${
                priceFormat === 'offer'
                  ? 'bg-brand-primary border-brand-primary'
                  : 'border-brand-border-strong'
              }`}
              onPress={() => setValue('priceFormat', 'offer')}
              accessibilityRole="radio"
              accessibilityState={{ selected: priceFormat === 'offer' }}
              accessibilityLabel={t('mobile.detail.priceMakeOffer')}
            >
              <Text
                className={`font-label-medium text-lg ${
                  priceFormat === 'offer' ? 'text-brand-primary-foreground' : 'text-brand-text-muted'
                }`}
              >
                {t('mobile.detail.priceMakeOffer')}
              </Text>
            </Pressable>
          </View>
        </View>
        <View className="gap-1.5">
          <FieldLabel text={t('mobile.detail.sectionQuantity')} />
          <Controller
            control={control}
            name="quantity"
            render={({ field: { value, onChange } }) => (
              <View
                className="flex-row items-center border border-brand-border-strong rounded-xs overflow-hidden h-12"
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
                  <MaterialIcons name="remove" size={20} color={brand.foreground} />
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
                  <MaterialIcons name="add" size={20} color={brand.foreground} />
                </Pressable>
              </View>
            )}
          />
        </View>
      </View>

      {priceFormat === 'buyNow' ? (
        <View className="gap-1.5">
          <FieldLabel text={t('mobile.detail.sectionCurrency', { defaultValue: 'CURRENCY' })} />
          <View className="flex-row flex-wrap gap-1.5">
            {CURRENCY_OPTIONS.map((opt) => {
              const active = priceCurrency === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  className={`flex-row items-center gap-xs px-md py-sm rounded-pill border ${
                    active
                      ? 'bg-brand-primary border-brand-primary'
                      : 'bg-brand-surface border-brand-border-strong'
                  }`}
                  onPress={() => setValue('priceCurrency', opt.value, { shouldValidate: true })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt.label}
                >
                  <Text
                    className={`font-label-medium text-md ${active ? 'text-brand-primary-foreground' : 'text-brand-foreground'}`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {priceFormat === 'buyNow' ? (
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
      ) : null}
    </View>
  );
}
