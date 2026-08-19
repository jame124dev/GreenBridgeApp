import { useTranslation } from 'react-i18next';

// Deep import, not the `@/components/ui` barrel: the barrel re-exports Button
// (-> react-native-reanimated) and LanguageSheet (-> MMKV). Same reason
// CategoryPickerSheet.tsx deep-imports — pulling one primitive should not pull
// the worklets runtime into the scan detail graph.
import { Sheet } from '@/components/ui/Sheet';
import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import { haptics } from '@/lib/haptics';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

interface Props {
  visible: boolean;
  /** The marketplaces this install may route to (M-12). */
  supported: MarketplaceKey[];
  /**
   * The value to show as SELECTED. Pass `null` in the ask state — plan §2.2:
   * nothing is pre-selected when the AI is unsure, so the seller cannot
   * confirm a guess by reflex.
   */
  value: MarketplaceKey | null;
  /** The AI's guess, badged "Best guess". Highlighted, never selected. */
  suggested: MarketplaceKey | null;
  onSelect: (marketplace: MarketplaceKey) => void;
  onClose: () => void;
}

/**
 * The marketplace picker, as a bottom sheet (plan §6.1). This is where
 * `MarketplaceCard`'s four-pill row went: same options, same "clear the
 * category on a real user switch" contract, but with the one-line descriptions
 * the pills had no room for.
 *
 * Pattern copied from `CountryPicker.tsx` so every dropdown in the flow reads as
 * one system. `Sheet.Option` already supports `description` (rendered with
 * `numberOfLines={2}`) and `Sheet` already handles the Android nav-bar inset, so
 * there is no new safe-area work.
 *
 * The description string is Phase 5's (integration C7): field `description` on
 * MARKETPLACE_OPTIONS, key `mobile.detail.marketplaceOption.<value>.description`,
 * translated ×6 by Phase 5. This phase adds NO marketplace-description keys —
 * a second field name and a second key namespace would put the same sentence on
 * the screen twice.
 *
 * Ordering follows Stitch 4b: the AI's BEST GUESS is listed FIRST, the rest keep
 * MARKETPLACE_OPTIONS' order. An earlier revision listed the runner-up first,
 * which read as a bug.
 */
export function MarketplaceSheet({
  visible,
  supported,
  value,
  suggested,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const available = MARKETPLACE_OPTIONS.filter((o) => supported.includes(o.value));
  const options = suggested
    ? [
        ...available.filter((o) => o.value === suggested),
        ...available.filter((o) => o.value !== suggested),
      ]
    : available;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.detail.routing.sheetTitle', { defaultValue: 'Choose a marketplace' })}
      subtitle={t('mobile.detail.routing.sheetSubtitle', {
        defaultValue: "Category and currency are set once you choose — we won't guess them.",
      })}
      maxHeight={440}
    >
      {options.map((opt) => (
        <Sheet.Option
          key={opt.value}
          label={
            opt.value === suggested
              ? `${opt.label}  ·  ${t('mobile.detail.routing.bestGuess', {
                  defaultValue: 'Best guess',
                })}`
              : opt.label
          }
          description={t(`mobile.detail.marketplaceOption.${opt.value}.description`, {
            defaultValue: opt.description,
          })}
          active={opt.value === value}
          onPress={() => {
            haptics.tap();
            onSelect(opt.value);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
