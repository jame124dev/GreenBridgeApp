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
// This build ships a single marketplace (101lab — the marketplace is LOCKED to
// the deployment's SITE_TYPE, mirroring the web's `lockedMarketplace`). With no
// real choice to offer, the picker is hidden. Flip to `false` (or gate on a
// supported-marketplaces config) to bring the selector back for a future
// multi-marketplace build.
const MARKETPLACE_LOCKED = true;

export function MarketplaceCard() {
  const { t } = useTranslation();
  const { control, watch, setValue } = useFormContext<DetailFormInput>();
  const marketplace = watch('marketplace');

  if (MARKETPLACE_LOCKED) return null;

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
                      if (opt.value === marketplace) return;
                      onChange(opt.value);
                      // The category tree is marketplace-specific, so a real
                      // user switch invalidates the current category/subcategory
                      // (and any "Other" brand). Clear them here — NOT in a
                      // marketplace watch-effect, which would also fire during
                      // initial hydration and wipe the AI-auto-filled category.
                      setValue('categoryId', '', { shouldValidate: false });
                      setValue('parentCategoryId', '', { shouldValidate: false });
                      setValue('parentCategoryName', '', { shouldValidate: false });
                      setValue('customSubcategory', '', { shouldValidate: false });
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
            {/* M-10 — one line of "what belongs here" under the pills, the same
                pattern LocationCard.tsx:320-327 uses for INSTALLATION_OPTIONS'
                hint. Four codenames with no explanation is the state the
                marketplace unlock (M-4) would otherwise ship. The copy has ONE
                home — MARKETPLACE_OPTIONS[].description (integration doc C7) —
                with the locale key overriding it per language. */}
            {marketplace ? (
              <Text className="font-sans text-sm text-brand-text-muted mt-xs">
                {t(
                  `mobile.detail.marketplaceOption.${marketplace}.description`,
                  MARKETPLACE_OPTIONS.find((o) => o.value === marketplace)?.description ?? '',
                )}
              </Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
