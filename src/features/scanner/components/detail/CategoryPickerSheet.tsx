import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// Deep imports, not the `@/components/ui` barrel: the barrel re-exports Button
// (-> react-native-reanimated) and LanguageSheet (-> MMKV), and this component is
// mounted by CategoryConditionCard, which three screens render. Pulling two
// primitives should not pull the worklets runtime into that graph.
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { OTHER_SUBCATEGORY_ID } from '@/features/scanner/constants';
import { flattenCategoryOptions, type LabCategory } from '@/services/scanner/fetchCategories';
import { brand } from '@/constants/theme';

/** Everything a pick has to write back onto the form, in one object. */
export type CategoryPick = {
  /** The leaf id, or `OTHER_SUBCATEGORY_ID`. Goes to `categoryId`. */
  categoryId: string;
  /** Goes to `parentCategoryId`. Equals `categoryId` on a flat tree. */
  parentCategoryId: string;
  /** Goes to `parentCategoryName`. */
  parentCategoryName: string;
};

interface Props {
  visible: boolean;
  /** The marketplace's tree, straight from `useLabCategories().data.categories`. */
  categories: LabCategory[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Marketplace label (e.g. `101RECYCLE`) — named in the loading copy. */
  marketplaceLabel: string;
  /** Currently-committed `categoryId` (may be `''` or the Other sentinel). */
  value: string;
  /** Currently-committed `parentCategoryId` — disambiguates Other per parent. */
  parentId: string;
  onSelect: (pick: CategoryPick) => void;
  onClose: () => void;
}

/**
 * M-2 — searchable category picker.
 *
 * Replaces the two stacked 240 px nested `ScrollView`s that used to live inside
 * the page scroll on `CategoryConditionCard` (~7 blind swipes to reach the 38th
 * child of one parent, no search). Built on the same `Sheet` + `Sheet.Option`
 * primitives as `CountryPicker` (search-on-top over 95 rows) and the lab-chat
 * category sheet (`LabListingEditSheet.tsx` `LabCategorySheet`), so the flow keeps
 * one visual language.
 *
 * Two modes, ONE scroller:
 *   - empty query → grouped browse, as an ACCORDION: one parent open at a time,
 *     its children indented beneath it. That is the in-repo precedent
 *     (`LabCategorySheet`) and it is the point of the sheet — rendering all four
 *     101lab parents expanded is 70 rows in the DEFAULT state, which is the
 *     "can scrolling be reduced?" problem again with a nicer border. Flat trees
 *     (/machines, /101recycle — 13 and 37 parents, zero children) get one plain
 *     row per parent, because for them the parent IS the leaf (see
 *     `flattenCategoryOptions`), so there is nothing to expand.
 *   - non-empty query → one flat list of matching leaves. The leaf's own name is
 *     the label and its parent is the row's `description`: `Sheet.Option`'s label
 *     is `numberOfLines={1}` in at most ~380 px, so a `Parent › Sub` label
 *     truncates inside the shared prefix and every hit under one parent renders
 *     identically. Same pattern as `LabCategorySheet`'s child rows.
 *
 * Deliberately prop-driven: no react-hook-form, no React Query. The card owns
 * the form writes — they must stay user-initiated (see the card's NOTE about the
 * hydration race) — and this file stays renderable in a plain unit test.
 *
 * Known limitation, accepted: the sheet does not auto-SCROLL to the current pick.
 * `Sheet` owns the `ScrollView` and exposes no ref. It does auto-EXPAND the
 * parent that holds the pick, which is what makes it reachable without a search,
 * and the pick itself renders `active`.
 */
export function CategoryPickerSheet({
  visible,
  categories,
  loading,
  error,
  onRetry,
  marketplaceLabel,
  value,
  parentId,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  /**
   * Accordion state. `undefined` means "the seller has not touched the accordion
   * yet", in which case the open parent is DERIVED from the current pick — so
   * re-opening the sheet lands on the seller's own choice instead of a collapsed
   * list they have to re-find. Once they tap, their choice wins (including
   * collapsing an auto-opened parent, which a plain `string | null` state
   * initialised from props could not express). Derived, never an effect: an
   * effect here would be the first step back towards the hydration race §1 warns
   * about.
   */
  const [expandOverride, setExpandOverride] = useState<string | null | undefined>(undefined);
  const q = query.trim().toLowerCase();

  const leaves = useMemo(() => flattenCategoryOptions(categories), [categories]);
  const matches = useMemo(
    () => (q ? leaves.filter((o) => o.label.toLowerCase().includes(q)) : []),
    [leaves, q],
  );

  const autoExpandedId = useMemo(() => {
    const owner = leaves.find((o) => o.id === value)?.parentId ?? parentId;
    if (!owner) return null;
    return categories.some((c) => String(c.id) === owner) ? owner : null;
  }, [categories, leaves, parentId, value]);
  const expandedId = expandOverride === undefined ? autoExpandedId : expandOverride;

  const otherLabel = t('mobile.detail.subCategoryOther', {
    defaultValue: 'Other (type brand)',
  });

  const reset = () => {
    setQuery('');
    setExpandOverride(undefined);
  };

  const commit = (pick: CategoryPick) => {
    reset();
    onSelect(pick);
    onClose();
  };

  const close = () => {
    reset();
    onClose();
  };

  const search = (
    <View className="pb-sm">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('mobile.detail.categorySearchPlaceholder', {
          defaultValue: 'Search categories…',
        })}
        placeholderTextColor={brand.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="bg-brand-surface border border-brand-border-strong rounded-xs px-md py-2.5 font-sans text-xl text-brand-foreground"
        accessibilityLabel={t('mobile.detail.categorySearchPlaceholder', {
          defaultValue: 'Search categories…',
        })}
      />
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t('mobile.detail.selectCategoryTitle', { defaultValue: 'Select category' })}
      subtitle={t('mobile.detail.selectCategorySubtitle', {
        defaultValue: 'Search, or browse by group',
      })}
      maxHeight={520}
      stickyHeader={search}
    >
      {error ? (
        // Recovery, not a dead end (UX_DESIGN_RULES: "Does every error have recovery?").
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="flex-row items-center gap-sm rounded-xs border border-brand-destructive px-md py-2.5"
        >
          <MaterialIcons name="error-outline" size={18} color={brand.destructive} />
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.detail.categoriesRetry', {
              defaultValue: "Couldn't load categories — tap to retry",
            })}
          </Text>
        </Pressable>
      ) : loading && categories.length === 0 ? (
        // Explanatory, not generic: name the marketplace whose tree is loading.
        // Laid out as a row so the copy stays left-aligned beside the spinner.
        <View className="flex-row items-center gap-sm py-lg">
          <ActivityIndicator color={brand.primary} />
          <Text variant="bodySm" tone="tertiary">
            {t('mobile.detail.categoriesLoading', {
              defaultValue: 'Loading {{marketplace}} categories…',
              marketplace: marketplaceLabel,
            })}
          </Text>
        </View>
      ) : q ? (
        matches.length === 0 ? (
          <View className="gap-sm py-md">
            <Text variant="bodySm" tone="tertiary">
              {t('mobile.detail.categorySearchEmpty', {
                defaultValue: 'No category matches "{{q}}"',
                q: query,
              })}
            </Text>
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              className="self-start rounded-xs border border-brand-border-strong px-md py-2"
            >
              {/* tone="brand" (= `text-brand-primary`, `Text.tsx:14`), NOT tone="primary":
                  `Text.tsx:8` maps "primary" to `text-neutral-900`, which would render this
                  tappable recovery row as plain body text inside its border. */}
              <Text variant="bodySm" tone="brand">
                {t('mobile.detail.categorySearchClear', {
                  defaultValue: 'Clear search to browse all categories',
                })}
              </Text>
            </Pressable>
          </View>
        ) : (
          matches.map((o) => (
            <Sheet.Option
              key={o.id}
              label={o.name}
              // Parent on its own line rather than a `Parent › Sub` label: the
              // label is numberOfLines={1} in ~380 px and the shared prefix is
              // what survives truncation (`Sheet.tsx` optionLabel). `description`
              // is numberOfLines={2} — same pattern as `LabCategorySheet`'s
              // child rows. The guard suppresses a duplicate second line on a
              // FLAT tree, where `flattenCategoryOptions` sets parentName === name.
              description={o.parentName !== o.name ? o.parentName : undefined}
              active={value === o.id}
              onPress={() =>
                commit({
                  categoryId: o.id,
                  parentCategoryId: o.parentId,
                  parentCategoryName: o.parentName,
                })
              }
            />
          ))
        )
      ) : (
        categories.map((cat) => {
          const pid = String(cat.id);
          const subs = cat.subcategories ?? [];

          // Flat marketplace (/machines, /101recycle): the parent IS the leaf.
          if (subs.length === 0) {
            return (
              <Sheet.Option
                key={pid}
                label={cat.name}
                active={value === pid}
                onPress={() =>
                  commit({
                    categoryId: pid,
                    parentCategoryId: pid,
                    parentCategoryName: cat.name,
                  })
                }
              />
            );
          }

          const open = expandedId === pid;
          return (
            <View key={pid}>
              <Sheet.Option
                label={cat.name}
                rightAdornment={
                  <MaterialIcons
                    name={open ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={brand.placeholder}
                  />
                }
                onPress={() => setExpandOverride(open ? null : pid)}
              />
              {open
                ? [
                    ...subs.map((sub) => {
                      const sid = String(sub.id);
                      return (
                        <Sheet.Option
                          key={sid}
                          indent
                          label={sub.name}
                          active={value === sid}
                          onPress={() =>
                            commit({
                              categoryId: sid,
                              parentCategoryId: pid,
                              parentCategoryName: cat.name,
                            })
                          }
                        />
                      );
                    }),
                    // Files the product under THIS parent and sends the typed
                    // brand as suggested_subcategory — same semantic as the old
                    // in-card "Other" row. The brand TextInput stays on the card,
                    // where the seller sees it after the sheet closes.
                    <Sheet.Option
                      key={`${pid}-other`}
                      indent
                      label={otherLabel}
                      active={value === OTHER_SUBCATEGORY_ID && parentId === pid}
                      onPress={() =>
                        commit({
                          categoryId: OTHER_SUBCATEGORY_ID,
                          parentCategoryId: pid,
                          parentCategoryName: cat.name,
                        })
                      }
                    />,
                  ]
                : null}
            </View>
          );
        })
      )}
    </Sheet>
  );
}
