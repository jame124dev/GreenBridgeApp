// `useEffect` STAYS — the hydrate/bridge effect below uses it. Only the
// `selectedParentId` sync effect was deleted with the parent pill row.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { brand } from '@/constants/theme';

import { CategoryPickerSheet, type CategoryPick } from './CategoryPickerSheet';
import { FieldGroup } from './SectionBand';
import { FieldLabel } from './FieldLabel';
import { OptionSheet } from './OptionSheet';
import { PickerRow } from './PickerRow';
import { ICON } from './metrics';

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
    const resolvedOption = categories.data.options.find((o) => o.id === resolved);
    if (resolvedOption) {
      setValue('categoryId', resolved, { shouldValidate: false });
      // The bridged id belongs to the CURRENT locale's tree, so the name the AI
      // sent (an EN one) is now wrong. Re-read it here, or the offline fallback
      // would show an English leaf name under a zh/ja/th tree.
      setValue('categoryName', resolvedOption.name ?? '', { shouldValidate: false });
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
      // No leaf any more, so no leaf name: leaving it would let the offline
      // fallback name a category the form no longer holds.
      setValue('categoryName', '', { shouldValidate: false });
      return;
    }
    // Truly stale/unknown id → drop it, name included.
    setValue('categoryId', '', { shouldValidate: false });
    setValue('categoryName', '', { shouldValidate: false });
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

  /*
    Condition is still an ARRAY and still multi-select — only where it is chosen
    moved. The five wrapping pills were four lines of the scroll for one answer,
    expressed in a sixth idiom nothing else on the form used, and selection was
    carried by fill colour with no check glyph and no radiogroup
    (FORM_UX_PANEL.md §A, B6). `OptionSheet` buffers the toggles and hands back
    the whole next array here, so this write is the same shape it always was.
  */
  const commitConditions = (next: string[]) => {
    setValue('condition', next as ConditionKey[], { shouldValidate: true });
  };

  const [sheetOpen, setSheetOpen] = useState(false);
  const [conditionSheetOpen, setConditionSheetOpen] = useState(false);

  const conditionOptions = useMemo(
    () =>
      VALID_CONDITION_KEYS.map((key) => ({
        value: key,
        label: t(`mobile.detail.condition.${key}`, { defaultValue: CONDITION_LABELS[key] }),
      })),
    [t],
  );
  /** What the collapsed row shows: every chosen condition, comma-joined. */
  const conditionLabel = useMemo(
    () =>
      conditionOptions
        .filter((o) => selectedConditions.includes(o.value))
        .map((o) => o.label)
        .join(', '),
    [conditionOptions, selectedConditions],
  );
  const options = useMemo(() => flattenCategoryOptions(parents), [parents]);
  const selectedParent = parents.find((c) => String(c.id) === derivedParentId);
  const marketplaceLabel =
    MARKETPLACE_OPTIONS.find((o) => o.value === marketplace)?.label ?? '';
  const otherLabel = t('mobile.detail.subCategoryOther', {
    defaultValue: 'Other (type brand)',
  });

  // Names the row can fall back on when the TREE cannot answer — offline, or
  // during the first fetch. Every path that sets a category also sets these
  // (processing.tsx patches categoryId + categoryName together from the AI,
  // `applyPick` below writes both, the hydrate effect above keeps them in step,
  // and CLEARED_CATEGORY_*_FIELDS clears all of them), so they describe the
  // CURRENT id rather than a previous one.
  const watchedCategoryName = watch('categoryName');
  /** No tree at all: the fetch failed (offline) or has not landed yet. */
  const treeUnavailable = parents.length === 0;

  // What the collapsed row shows. In priority order:
  //   Other picked → "Parent › Other (type brand)"
  //   leaf picked  → the flattened tree label ("Parent › Sub", or the parent's
  //                  own name on a flat tree); with no tree, the names the DRAFT
  //                  carries; with neither, an honest "can't load its name"
  //   parent only  → "Parent › pick a subcategory" — shows what the AI DID
  //                  resolve instead of discarding it, while the empty leaf keeps
  //                  Submit blocked (schema.ts:23)
  //   nothing      → '' (the row renders the "Not set" prompt)
  //
  // ⛔ Device pass 2026-08-19: offline this row read "Not set — pick a category"
  // while a category WAS selected, because only the first of those branches
  // existed and offline `options` is empty. That is not cosmetic — it invites the
  // seller to re-pick and lose an answer that would have submitted fine. The
  // "nothing" branch is deliberately still reachable: replacing the prompt with
  // "can't load its name" on an EMPTY category would be the same lie reversed.
  const selectedLabel = useMemo(() => {
    if (categoryId === OTHER_SUBCATEGORY_ID) {
      const parentName = watchedParentCategoryName || selectedParent?.name || '';
      return parentName ? `${parentName} › ${otherLabel}` : otherLabel;
    }
    if (categoryId) {
      const fromTree = options.find((o) => o.id === categoryId)?.label;
      if (fromTree) return fromTree;
      const leaf = (watchedCategoryName ?? '').trim();
      const parentName = (watchedParentCategoryName || selectedParent?.name || '').trim();
      // The guard is what stops a FLAT tree (/machines, /101recycle) rendering
      // "Metalworking Equipment › Metalworking Equipment": there the parent IS
      // the leaf, so both names are the same string.
      if (leaf) return parentName && parentName !== leaf ? `${parentName} › ${leaf}` : leaf;
      if (treeUnavailable) {
        return t('mobile.detail.categoryNamesUnavailable', {
          defaultValue: "Category selected — can't load its name right now",
        });
      }
      // Tree loaded and the id is not in it: genuinely stale. Say nothing and let
      // the hydrate effect above drop or bridge it.
      return '';
    }
    // Parent-only, tree or no tree.
    const parentOnly = selectedParent?.name || watchedParentCategoryName || '';
    if (parentOnly) {
      return `${parentOnly} › ${t('mobile.detail.categoryPickSubcategory', {
        defaultValue: 'pick a subcategory',
      })}`;
    }
    return '';
  }, [
    categoryId,
    options,
    selectedParent,
    watchedCategoryName,
    watchedParentCategoryName,
    treeUnavailable,
    otherLabel,
    t,
  ]);

  // The ONLY place this card writes the category fields, and it is reachable
  // exclusively from the sheet's own Pressables — i.e. user-initiated. Never
  // move any of this into an effect keyed on `marketplace`: see the NOTE above.
  const applyPick = (pick: CategoryPick) => {
    setValue('categoryId', pick.categoryId, { shouldValidate: true });
    setValue('parentCategoryId', pick.parentCategoryId, { shouldValidate: false });
    setValue('parentCategoryName', pick.parentCategoryName, { shouldValidate: false });
    // Keep the leaf NAME in step with the leaf id, so the offline fallback in
    // `selectedLabel` can never show a PREVIOUS pick's name beside a new id.
    // Safe to read `options` here: a pick is only reachable from the sheet's
    // rows, which only exist once the tree has loaded. The sentinel has no leaf
    // name of its own — the parent fields carry its meaning.
    setValue(
      'categoryName',
      pick.categoryId === OTHER_SUBCATEGORY_ID
        ? ''
        : options.find((o) => o.id === pick.categoryId)?.name ?? '',
      { shouldValidate: false },
    );
    // A real leaf leaves "Other" behind — drop any stale typed brand so it is
    // never submitted (same reason as the old parent-pill and subcategory rows).
    if (pick.categoryId !== OTHER_SUBCATEGORY_ID) {
      setValue('customSubcategory', '', { shouldValidate: false });
    }
  };

  return (
    <FieldGroup>
      {/* Category, its "Other" brand input and its sheet are ONE child of the
          group: the brand input only exists BECAUSE of the pick above it, and a
          sheet is a portal with no row of its own — left as a sibling it would
          leave a hairline ruling off empty space. */}
      <View className="gap-sm">
      {/* The row this card already had, now the shared one — see `PickerRow`.
          Same strings, same a11y label, same two states (Choose / Change). */}
      <Controller
        control={control}
        name="categoryId"
        render={({ fieldState }) => (
          <PickerRow
            label={t('mobile.detail.sectionCategory')}
            required
            ai
            value={selectedLabel}
            placeholder={t('mobile.detail.categoryNotSet', {
              defaultValue: 'Not set — pick a category',
            })}
            error={fieldState.error?.message}
            testID="picker-row-category"
            onPress={() => setSheetOpen(true)}
          />
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
      </View>

      <View>
        <PickerRow
          label={t('mobile.detail.sectionCondition')}
          required
          value={conditionLabel}
          placeholder={t('mobile.detail.conditionNotSet', {
            defaultValue: 'Not set — pick a condition',
          })}
          testID="picker-row-condition"
          onPress={() => setConditionSheetOpen(true)}
        />
        <OptionSheet
          multi
          visible={conditionSheetOpen}
          title={t('mobile.detail.selectConditionTitle', { defaultValue: 'Select condition' })}
          subtitle={t('mobile.detail.selectConditionSubtitle', {
            defaultValue: 'Pick every one that applies',
          })}
          options={conditionOptions}
          selected={selectedConditions}
          onCommit={commitConditions}
          onClose={() => setConditionSheetOpen(false)}
        />
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
              {/* Four values is few enough to stay a segment rather than become
                  a sheet, but then the a11y debt has to be paid in place: a
                  check so the pick is not fill-colour alone, and real radiogroup
                  semantics so a screen reader can say which of four is chosen
                  (FORM_UX_PANEL.md B6). */}
              <View className="flex-row gap-1.5" accessibilityRole="radiogroup">
                {GRADES.map((g) => {
                  const active = value === g;
                  return (
                    <Pressable
                      key={g}
                      className={`flex-1 flex-row items-center justify-center gap-xs py-2.5 rounded-xs border ${
                        active ? 'bg-brand-primary border-brand-primary' : 'border-brand-border-strong'
                      }`}
                      style={styles.segment}
                      onPress={() => onChange(g)}
                      role="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={t('mobile.detail.gradeOption', {
                        defaultValue: 'Grade {{g}}',
                        g,
                      })}
                    >
                      {active ? (
                        <MaterialIcons name="check" size={ICON.adornment} color={brand.primaryForeground} />
                      ) : null}
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
    </FieldGroup>
  );
}

const styles = StyleSheet.create({
  // 44pt, reached without changing the segment's visual padding.
  segment: { minHeight: 44 },
});
