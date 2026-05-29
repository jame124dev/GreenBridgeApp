import { Pressable, Text, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import { haptics } from '@/lib/haptics';

import { FieldLabel } from './FieldLabel';

/**
 * Marketplace picker — sits between Description and Category because the
 * marketplace choice drives the category tree (LabGreenbidz → lab categories;
 * 101 Machines / Recycle / IT → machine categories). Keeping it visually
 * adjacent to the category card makes the dependency obvious.
 */
export function MarketplaceCard() {
  const { t } = useTranslation();
  const { control, watch } = useFormContext<DetailFormInput>();
  const marketplace = watch('marketplace');

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <Controller
        control={control}
        name="marketplace"
        render={({ field: { onChange } }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionMarketplace', { defaultValue: 'MARKETPLACE' })} />
            <View className="flex-row flex-wrap gap-1.5">
              {MARKETPLACE_OPTIONS.map((opt) => {
                const active = marketplace === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    className={`flex-row items-center gap-xs px-md py-sm rounded-pill border ${
                      active
                        ? 'bg-brand-primary border-brand-primary'
                        : 'bg-brand-surface border-brand-border-strong'
                    }`}
                    onPress={() => {
                      haptics.tap();
                      onChange(opt.value);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={opt.label}
                  >
                    <Text
                      className={`font-label-medium text-lg ${active ? 'text-brand-primary-foreground' : 'text-brand-foreground'}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      />
    </View>
  );
}
