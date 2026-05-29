import { TextInput, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { DetailFormInput } from '@/features/scanner/schema';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';

const inputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground';

/**
 * Specs card — weight + dimensions + CO2 emissions + serial number.
 *
 * S6.2.b2.i — converted to NativeWind. All four fields use the shared input
 * pattern. Placeholder colors set via JS prop (no NativeWind hook for those).
 */
export function SpecsCard() {
  const { t } = useTranslation();
  const { control } = useFormContext<DetailFormInput>();

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <Controller
        control={control}
        name="weight"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.specWeight', { defaultValue: 'WEIGHT' })} ai />
            <TextInput
              className={inputCls}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('mobile.detail.weightPlaceholder', { defaultValue: 'e.g. 50 kg' })}
              placeholderTextColor={brand.placeholder}
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="dimensions"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.specDimensions', { defaultValue: 'DIMENSIONS' })} ai />
            <TextInput
              className={inputCls}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('mobile.detail.dimensionsPlaceholder', { defaultValue: 'e.g. 100×80×120 cm' })}
              placeholderTextColor={brand.placeholder}
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="co2Emissions"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.specCO2', { defaultValue: 'CO2 EMISSIONS' })} ai />
            <TextInput
              className={inputCls}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('mobile.detail.co2Placeholder', { defaultValue: 'e.g. 2.3' })}
              placeholderTextColor={brand.placeholder}
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="serialNumber"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.specSerial', { defaultValue: 'SERIAL NUMBER' })} />
            <TextInput
              className={inputCls}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('mobile.detail.serialPlaceholder', { defaultValue: 'Optional' })}
              placeholderTextColor={brand.placeholder}
              autoCapitalize="characters"
            />
          </View>
        )}
      />
    </View>
  );
}
