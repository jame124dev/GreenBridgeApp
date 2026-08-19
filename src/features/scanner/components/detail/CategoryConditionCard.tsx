// `useEffect` STAYS — the hydrate/bridge effect below uses it. Only the
// `selectedParentId` sync effect was deleted with the parent pill row.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  CONDITION_LABELS,
  MARKETPLACE_OPTIONS,
  OTHER_SUBCATEGORY_ID,
  VALID_CONDITION_KEYS,
  type ConditionKey,
} from '@/features/scanner/constants';
import type { DetailFormInput } from '@/features/scanner/schema';
import {
  useEnLabCategories,
  useLabCategories,
} from '@/features/scanner/useLabCategories';
import { bridgeCategoryId, flattenCategoryOptions } from '@/services/scanner/fetchCategories';
import type { ItemGrade } from '@/stores/scanDraftStore';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';

import { CategoryPickerSheet, type CategoryPick } from './CategoryPickerSheet';
import { FieldLabel } from './FieldLabel';

const GRADES: ItemGrade[] = ['A', 'B', 'C', 'D'];

// Matches the shared TextInput pattern used across the detail cards (SpecsCard,
// IdentityCard) so the "Other" brand field is visually consistent.
const otherInputCls =
  'bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground';

/**
 * Category + condition + grade picker.
 *
 * M-2: category is ONE row (label + the current pick + Change) that opens
 * `CategoryPickerSheet`. It used to be two stacked 240 px nested `ScrollView`s
 * inside the page scroll — ~5 rows visible at a time over 62 leaves, 38 of them
 * under one parent, with no search.
 *
 * The form's `categoryId` always holds the leaf id (sub when nested, parent
 * when flat) so the submit-time wiring stays unchanged. The "Other (type brand)"
 * text input stays HERE rather than moving into the sheet: the seller has to see
 * and edit it after the sheet closes.
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
  const watchedParentCategoryId = watch('parentCategoryId');
  // Reactive on purpose: the collapsed row's label reads it, and `getValues`
  // inside a useMemo would not re-render when the hydrate effect writes it.
  const watchedParentCategoryName = watch('parentCategoryName');

  const parents = categories.data?.categories ?? [];

  // Derive the currently selected parent from categoryId:
  // - nested: parent whose subcategories contains this id
  // - flat:   the parent whose own id matches categoryId
  const derivedParentId = useMemo(() => {
    // "Other (type brand)" — the sentinel leaf isn't in the tree, so the parent
    // can't be derived by walking subcategories. Read it from the form's
    // parentCategoryId instead. Without this, the parent pill would de-select
    // and the subcategory section (which renders the Other card + input) would
    // unmount the instant Other is picked — the RN blink.
    if (categoryId === OTHER_SUBCATEGORY_ID) return watchedParentCategoryId || '';
    // Parent-only AI fill (or after the clear-effect drops a non-leaf parent id):
    // the leaf is empty but the parent was captured separately — select it so
    // the category never appears blank when the AI gave a parent (web parity).
    if (!categoryId) return watchedParentCategoryId || '';
    for (const cat of parents) {
      const catId = String(cat.id);
      if (catId === categoryId) return catId;
      if ((cat.subcategories ?? []).some((s) => String(s.id) === categoryId)) {
        return catId;
      }
    }
    return '';
  }, [categoryId, parents, watchedParentCategoryId]);

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
    // Wait for a NON-EMPTY tree. React Query briefly yields a defined-but-empty
    // {categories:[],options:[]} while loading; running against it would judge a
    // valid AI categoryId (e.g. a parent id like "5421") as invalid and wipe it
    // before the real tree arrives — the category would then never auto-fill.
    if (!categories.data?.categories?.length) return;
    if (!enBridgeSettled) return;
    // Never wipe the "Other" sentinel — it's intentionally not in `options`,
    // so the validity check below would otherwise clear it on every render.
    if (getValues('categoryId') === OTHER_SUBCATEGORY_ID) return;
    const id = getValues('categoryId');
    if (!id) return;
    const stillValid = categories.data.options.some((o) => o.id === id);
    if (stillValid) return;
    // Bridge an EN id over to the current locale's tree when possible.
    let resolved = id;
    if (enCategories.data) {
      const bridged = bridgeCategoryId(
        id,
        enCategories.data,
        categories.data.categories,
      );
      if (bridged) resolved = bridged;
    }
    // Resolved id is a real leaf option → adopt it.
    if (categories.data.options.some((o) => o.id === resolved)) {
      setValue('categoryId', resolved, { shouldValidate: false });
      return;
    }
    // Parent-only result: the AI returned a top-level category with no kept
    // subcategory (e.g. a laptop whose brand is unknown — the backend clears the
    // brand subcategory). A nested parent id isn't a leaf option, so the checks
    // above can't match it. Keep it as the selected PARENT so the subcategory
    // picker opens and the parent shows selected (web parity), and clear the
    // leaf so the seller still must pick a brand / Other.
    const parent = categories.data.categories.find(
      (c) => String(c.id) === resolved,
    );
    if (parent) {
      setValue('parentCategoryId', String(parent.id), { shouldValidate: false });
      setValue('parentCategoryName', parent.name ?? '', { shouldValidate: false });
      setValue('categoryId', '', { shouldValidate: false });
      return;
    }
    // Truly stale/unknown id → drop it.
    setValue('categoryId', '', { shouldValidate: false });
  }, [
    categories.data,
    enCategories.data,
    enBridgeSettled,
    getValues,
    setValue,
  ]);

  // NOTE: clearing the category/subcategory + Other fields on a marketplace
  // change is handled in MarketplaceCard's onPress (user-driven only). Doing it
  // here via a watch-effect wrongly fired during initial hydration (the form's
  // default marketplace flips to the AI's), wiping the auto-filled category.

  const toggleCondition = (key: ConditionKey) => {
    const next = selectedConditions.includes(key)
      ? selectedConditions.filter((c) => c !== key)
      : [...selectedConditions, key];
    setValue('condition', next, { shouldValidate: true });
  };

  const [sheetOpen, setSheetOpen] = useState(false);
  const options = useMemo(() => flattenCategoryOptions(parents), [parents]);
  const selectedParent = parents.find((c) => String(c.id) === derivedParentId);
  const marketplaceLabel =
    MARKETPLACE_OPTIONS.find((o) => o.value === marketplace)?.label ?? '';
  const otherLabel = t('mobile.detail.subCategoryOther', {
    defaultValue: 'Other (type brand)',
  });

  // What the collapsed row shows. Four states, in priority order:
  //   Other picked → "Parent › Other (type brand)"
  //   leaf picked  → the flattened label ("Parent › Sub", or the parent's own
  //                  name on a flat tree)
  //   parent only  → "Parent › pick a subcategory" — shows what the AI DID
  //                  resolve instead of discarding it, while the empty leaf keeps
  //                  Submit blocked (schema.ts:23)
  //   nothing      → '' (the row renders the "Not set" prompt)
  const selectedLabel = useMemo(() => {
    if (categoryId === OTHER_SUBCATEGORY_ID) {
      const parentName = watchedParentCategoryName || selectedParent?.name || '';
      return parentName ? `${parentName} › ${otherLabel}` : otherLabel;
    }
    if (categoryId) return options.find((o) => o.id === categoryId)?.label ?? '';
    if (selectedParent) {
      return `${selectedParent.name} › ${t('mobile.detail.categoryPickSubcategory', {
        defaultValue: 'pick a subcategory',
      })}`;
    }
    return '';
  }, [categoryId, options, selectedParent, watchedParentCategoryName, otherLabel, t]);

  // The ONLY place this card writes the category fields, and it is reachable
  // exclusively from the sheet's own Pressables — i.e. user-initiated. Never
  // move any of this into an effect keyed on `marketplace`: see the NOTE above.
  const applyPick = (pick: CategoryPick) => {
    setValue('categoryId', pick.categoryId, { shouldValidate: true });
    setValue('parentCategoryId', pick.parentCategoryId, { shouldValidate: false });
    setValue('parentCategoryName', pick.parentCategoryName, { shouldValidate: false });
    // A real leaf leaves "Other" behind — drop any stale typed brand so it is
    // never submitted (same reason as the old parent-pill and subcategory rows).
    if (pick.categoryId !== OTHER_SUBCATEGORY_ID) {
      setValue('customSubcategory', '', { shouldValidate: false });
    }
  };

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <Controller
        control={control}
        name="categoryId"
        render={({ fieldState }) => (
          <View className="gap-1.5">
            <FieldLabel text={t('mobile.detail.sectionCategory')} required ai />
            <Pressable
              className="flex-row items-center gap-sm border border-brand-border-strong rounded-xs px-md py-2.5"
              onPress={() => {
                haptics.tap();
                setSheetOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('mobile.detail.sectionCategory')}: ${
                selectedLabel ||
                t('mobile.detail.categoryNotSet', { defaultValue: 'Not set — pick a category' })
              }`}
            >
              <Text
                className={`flex-1 font-label-medium text-lg ${
                  selectedLabel ? 'text-brand-foreground' : 'text-brand-placeholder'
                }`}
                numberOfLines={2}
              >
                {selectedLabel ||
                  t('mobile.detail.categoryNotSet', {
                    defaultValue: 'Not set — pick a category',
                  })}
              </Text>
              <Text className="font-label text-md text-brand-primary">
                {selectedLabel
                  ? t('mobile.detail.change', { defaultValue: 'Change' })
                  : t('mobile.detail.choose', { defaultValue: 'Choose' })}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={brand.placeholder} />
            </Pressable>
            {fieldState.error ? (
              <Text className="text-brand-destructive text-md">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      {/* The typed brand for "Other" stays on the CARD, not in the sheet: the
          seller must see and edit it after the sheet closes. Same field, same
          validation (schema.ts superRefine), one less place to look. */}
      {categoryId === OTHER_SUBCATEGORY_ID ? (
        <Controller
          control={control}
          name="customSubcategory"
          render={({ field: { value: brandValue, onChange: onBrandChange, onBlur }, fieldState }) => (
            <View className="gap-1.5">
              <FieldLabel
                text={t('mobile.detail.sectionSubcategory', { defaultValue: 'SUBCATEGORY' })}
                required
              />
              <TextInput
                className={otherInputCls}
                value={brandValue ?? ''}
                onChangeText={onBrandChange}
                onBlur={onBlur}
                maxLength={60}
                placeholder={t('mobile.detail.subCategoryOtherPlaceholder', {
                  defaultValue: 'Enter brand name',
                })}
                placeholderTextColor={brand.placeholder}
              />
              {fieldState.error ? (
                <Text className="text-brand-destructive text-md">{fieldState.error.message}</Text>
              ) : null}
            </View>
          )}
        />
      ) : null}

      <CategoryPickerSheet
        visible={sheetOpen}
        categories={parents}
        loading={categories.isLoading}
        error={categories.isError}
        onRetry={() => {
          void categories.refetch();
        }}
        marketplaceLabel={marketplaceLabel}
        value={categoryId ?? ''}
        parentId={watchedParentCategoryId ?? ''}
        onSelect={applyPick}
        onClose={() => setSheetOpen(false)}
      />

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
