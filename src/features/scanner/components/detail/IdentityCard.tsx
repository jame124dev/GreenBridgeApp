import { Text, TextInput, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { DetailFormInput } from '@/features/scanner/schema';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';

const inputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground';
const titleInputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-heading-semi text-4xl text-brand-foreground';

/**
 * Identity card — title + brand/model/year (S2.2 expansion).
 *
 * S6.2.b2.i — converted to NativeWind. Card container, field gaps, and input
 * styling all use className. `placeholderTextColor` retains the brand token
 * via JS (no Tailwind hook for placeholder color in NativeWind).
 *
 * `variant` (default `'draft'` — existing behaviour unchanged):
 *   'edit' is the published-listing editor. Model and year are hidden there
 *   because the v1 edit contract has no slot for them — on create they are
 *   folded into `product_content` by `appendSpecsToDescription`, and the editor
 *   exposes the description itself, so keeping the inputs would offer two ways
 *   to change one thing and silently discard one of them. Title and brand ARE
 *   contract fields and stay editable.
 */
export function IdentityCard({ variant = 'draft' }: { variant?: 'draft' | 'edit' } = {}) {
  const isEdit = variant === 'edit';
  const { t } = useTranslation();
  const { control } = useFormContext<DetailFormInput>();

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <Controller
        control={control}
        name="title"
        render={({ field: { value, onChange, onBlur }, fieldState }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionTitle')} ai />
            <TextInput
              className={titleInputCls}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={80}
            />
            <Text className="font-label text-sm text-brand-placeholder text-right">
              {value?.length ?? 0}/80
            </Text>
            {fieldState.error ? (
              <Text className="text-brand-destructive text-md" style={{ marginTop: 2 }}>
                {fieldState.error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      <View className="flex-row gap-sm">
        <Controller
          control={control}
          name="brand"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-1 gap-1.5">
              <FieldLabel text={t('mobile.detail.sectionBrand', { defaultValue: 'BRAND' })} ai />
              <TextInput
                className={inputCls}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('mobile.detail.brandPlaceholder', { defaultValue: 'e.g. Agilent' })}
                placeholderTextColor={brand.placeholder}
              />
            </View>
          )}
        />
        {isEdit ? null : (
        <Controller
          control={control}
          name="model"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-1 gap-1.5">
              <FieldLabel text={t('mobile.detail.sectionModel', { defaultValue: 'MODEL' })} ai />
              <TextInput
                className={inputCls}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('mobile.detail.modelPlaceholder', { defaultValue: 'e.g. HPLC-2000' })}
                placeholderTextColor={brand.placeholder}
              />
            </View>
          )}
        />
        )}
      </View>

      {isEdit ? null : (
      <Controller
        control={control}
        name="year"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionYear', { defaultValue: 'YEAR' })} ai />
            <TextInput
              className={inputCls}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="number-pad"
              maxLength={4}
              placeholder={t('mobile.detail.yearPlaceholder', { defaultValue: 'e.g. 2018' })}
              placeholderTextColor={brand.placeholder}
            />
          </View>
        )}
      />
      )}
    </View>
  );
}
