import { Text, TextInput, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { DetailFormInput } from '@/features/scanner/schema';

import { FieldLabel } from './FieldLabel';

const inputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground';

export function DescriptionCard() {
  const { t } = useTranslation();
  const { control } = useFormContext<DetailFormInput>();

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <Controller
        control={control}
        name="description"
        render={({ field: { value, onChange, onBlur }, fieldState }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionDescription')} ai />
            <TextInput
              className={inputCls}
              style={{ minHeight: 110 }}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              numberOfLines={5}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text className="font-label text-sm text-brand-placeholder text-right">
              {value?.length ?? 0}/500
            </Text>
            {fieldState.error ? (
              <Text className="text-brand-destructive text-md" style={{ marginTop: 2 }}>
                {fieldState.error.message}
              </Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
