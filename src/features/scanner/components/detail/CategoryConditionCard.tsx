import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  CONDITION_LABELS,
  VALID_CONDITION_KEYS,
  type ConditionKey,
} from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import {
  useEnLabCategories,
  useLabCategories,
} from '@/features/scanner/useLabCategories';
import { bridgeCategoryId } from '@/services/scanner/fetchCategories';
import type { ItemGrade } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

import { FieldLabel } from './FieldLabel';

const GRADES: ItemGrade[] = ['A', 'B', 'C', 'D'];

/**
 * Category + condition + grade picker.
 *
 * Category mirrors the web seller form's two-dropdown pattern:
 *   - Parent picker (always shown).
 *   - Subcategory picker (only shown when the selected parent actually has
 *     subcategories — flat marketplaces like /machines have none, so the
 *     parent IS the leaf).
 *
 * The form's `categoryId` always holds the leaf id (sub when nested, parent
 * when flat) so the submit-time wiring stays unchanged.
 */
export function CategoryConditionCard() {
  const { t, i18n } = useTranslation();
  const { control, watch, setValue, getValues } = useFormContext<DetailFormInput>();
  const marketplace = watch('marketplace');
  const categories = useLabCategories(marketplace);
  // EN reference tree — used by the cross-locale bridge below. Cheap (cached
  // 5 min, no fetch when the app's already in EN).
  const enCategories = useEnLabCategories(marketplace);
  const selectedConditions = watch('condition');
  const categoryId = watch('categoryId');

  const parents = categories.data?.categories ?? [];

  // Derive the currently selected parent from categoryId:
  // - nested: parent whose subcategories contains this id
  // - flat:   the parent whose own id matches categoryId
  const derivedParentId = useMemo(() => {
    if (!categoryId) return '';
    for (const cat of parents) {
      const catId = String(cat.id);
      if (catId === categoryId) return catId;
      if ((cat.subcategories ?? []).some((s) => String(s.id) === categoryId)) {
        return catId;
      }
    }
    return '';
  }, [categoryId, parents]);

  const [selectedParentId, setSelectedParentId] = useState(derivedParentId);

  // Keep local parent state in sync when the form value changes externally
  // (marketplace switch, AI fill, draft hydrate). The setState IS the
  // effect's purpose — mirror the derived parent-id into a local component
  // state used by the parent-pill highlight.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedParentId(derivedParentId);
  }, [derivedParentId]);

  // Clear stale categoryId when the marketplace switches and the prior leaf
  // is no longer present in the new tree. `categoryName` doesn't need its own
  // clear: it's not on the form — `useDetailController.buildUpdated` derives
  // it from `categoryId` at submit time, so clearing the id alone is enough.
  //
  // Cross-locale bridge: the smart-detect AI returns category ids from the EN
  // tree even when the seller is in zh/ja/th. Before clearing, try to bridge
  // the EN id over to the user's locale id via `bridgeCategoryId` (sorted
  // position match). Only clears when no bridge is possible — preserves the
  // AI's pick across locales. See `fetchCategories.ts#bridgeCategoryId`.
  //
  // RACE-CONDITION GATE: the locale tree and the EN tree are independent
  // React Query fetches; the locale tree often arrives first. Without this
  // gate, the effect would clear the AI's id before the EN tree shows up to
  // bridge it. We wait until either we don't need the bridge (already in EN)
  // OR the bridge has settled (success/error) before deciding.
  const isAlreadyEn =
    i18n.language === 'en' || i18n.language.startsWith('en');
  const enBridgeSettled =
    isAlreadyEn || enCategories.isSuccess || enCategories.isError;
  useEffect(() => {
    if (!categories.data) return;
    if (!enBridgeSettled) return;
    const id = getValues('categoryId');
    if (!id) return;
    const stillValid = categories.data.options.some((o) => o.id === id);
    if (stillValid) return;
    if (enCategories.data) {
      const bridged = bridgeCategoryId(
        id,
        enCategories.data,
        categories.data.categories,
      );
      if (bridged && categories.data.options.some((o) => o.id === bridged)) {
        setValue('categoryId', bridged, { shouldValidate: false });
        return;
      }
    }
    setValue('categoryId', '', { shouldValidate: false });
  }, [
    categories.data,
    enCategories.data,
    enBridgeSettled,
    getValues,
    setValue,
  ]);

  const toggleCondition = (key: ConditionKey) => {
    const next = selectedConditions.includes(key)
      ? selectedConditions.filter((c) => c !== key)
      : [...selectedConditions, key];
    setValue('condition', next, { shouldValidate: true });
  };

  const selectedParent = parents.find((c) => String(c.id) === selectedParentId);
  const subs = selectedParent?.subcategories ?? [];
  const isFlatLeaf = selectedParent != null && subs.length === 0;

  const onPickParent = (id: string) => {
    setSelectedParentId(id);
    const cat = parents.find((c) => String(c.id) === id);
    const catSubs = cat?.subcategories ?? [];
    // Flat marketplace → parent IS the leaf; commit immediately.
    // Nested → reset leaf so user picks a sub next.
    setValue('categoryId', catSubs.length === 0 ? id : '', { shouldValidate: false });
  };

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <Controller
        control={control}
        name="categoryId"
        render={({ fieldState }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionCategory')} required />
            {categories.isLoading ? (
              <ActivityIndicator color={brand.primary} />
            ) : categories.isError ? (
              <Text className="text-brand-destructive text-md">
                {t('mobile.detail.categoriesLoadFailed')}
              </Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 240 }}
                contentContainerStyle={{ paddingBottom: 4 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {parents.map((cat) => {
                  const id = String(cat.id);
                  const active = selectedParentId === id;
                  return (
                    <Pressable
                      key={cat.id}
                      className={`flex-row items-center justify-between gap-sm border rounded-xs px-md py-2.5 ${
                        active
                          ? 'border-brand-primary border-2 bg-brand-primary-surface'
                          : 'border-brand-border-strong'
                      }`}
                      style={{ marginTop: 6 }}
                      onPress={() => onPickParent(id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={cat.name}
                    >
                      <Text
                        className={`flex-1 ${active ? 'font-label text-brand-primary text-lg' : 'font-label-medium text-lg text-brand-foreground'}`}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                      <MaterialIcons
                        name={active ? 'check-circle' : 'chevron-right'}
                        size={20}
                        color={active ? brand.primary : brand.placeholder}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {fieldState.error ? (
              <Text className="text-brand-destructive text-md">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      {selectedParent && !isFlatLeaf ? (
        <Controller
          control={control}
          name="categoryId"
          render={({ field: { value, onChange } }) => (
            <View className="gap-1.5">
              <FieldLabel
                text={t('mobile.detail.sectionSubcategory', { defaultValue: 'SUBCATEGORY' })}
                required
              />
              <ScrollView
                style={{ maxHeight: 240 }}
                contentContainerStyle={{ paddingBottom: 4 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {subs.map((sub) => {
                  const id = String(sub.id);
                  const active = value === id;
                  return (
                    <Pressable
                      key={sub.id}
                      className={`flex-row items-center justify-between gap-sm border rounded-xs px-md py-2.5 ${
                        active
                          ? 'border-brand-primary border-2 bg-brand-primary-surface'
                          : 'border-brand-border-strong'
                      }`}
                      style={{ marginTop: 6 }}
                      onPress={() => onChange(id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${selectedParent.name} ${sub.name}`}
                    >
                      <Text
                        className={`flex-1 ${active ? 'font-label text-brand-primary text-lg' : 'font-label-medium text-lg text-brand-foreground'}`}
                        numberOfLines={1}
                      >
                        {sub.name}
                      </Text>
                      <MaterialIcons
                        name={active ? 'check-circle' : 'chevron-right'}
                        size={20}
                        color={active ? brand.primary : brand.placeholder}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        />
      ) : null}

      <View className="gap-1.5">
        <FieldLabel text={t('mobile.detail.sectionCondition')} required />
        <View className="flex-row flex-wrap gap-1.5">
          {VALID_CONDITION_KEYS.map((key) => {
            const active = selectedConditions.includes(key);
            return (
              <Pressable
                key={key}
                className={`flex-row items-center gap-xs px-md py-sm rounded-pill border ${
                  active
                    ? 'bg-brand-primary border-brand-primary'
                    : 'bg-brand-surface border-brand-border-strong'
                }`}
                onPress={() => toggleCondition(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={t(`mobile.detail.condition.${key}`, {
                  defaultValue: CONDITION_LABELS[key],
                })}
              >
                {active ? (
                  <MaterialIcons name="check" size={16} color={brand.primaryForeground} />
                ) : null}
                <Text
                  className={`font-label-medium text-lg ${active ? 'text-brand-primary-foreground' : 'text-brand-foreground'}`}
                >
                  {t(`mobile.detail.condition.${key}`, { defaultValue: CONDITION_LABELS[key] })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* W7 (scan_v3) — W3 grade-gate: Grade is a 101IT-only field per web's
          `ReviewSubmitScreen.tsx:750`. The form value still defaults to 'A'
          and gets sent on submit for all marketplaces (per the backend's
          accept-all semantic), but the picker UI is only shown when the
          seller has picked the 101IT marketplace. Matches the web seller
          experience exactly. */}
      {marketplace === '101it' ? (
        <Controller
          control={control}
          name="grade"
          render={({ field: { value, onChange } }) => (
            <View className="gap-1.5">
              <FieldLabel text={t('mobile.detail.sectionGrade', { defaultValue: 'GRADE' })} ai />
              <View className="flex-row gap-1.5">
                {GRADES.map((g) => {
                  const active = value === g;
                  return (
                    <Pressable
                      key={g}
                      className={`flex-1 py-2.5 rounded-xs border items-center ${
                        active ? 'bg-brand-primary border-brand-primary' : 'border-brand-border-strong'
                      }`}
                      onPress={() => onChange(g)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t('mobile.detail.gradeOption', {
                        defaultValue: 'Grade {{g}}',
                        g,
                      })}
                    >
                      <Text
                        className={`font-bold text-xl ${active ? 'text-brand-primary-foreground' : 'text-brand-foreground'}`}
                      >
                        {g}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}
