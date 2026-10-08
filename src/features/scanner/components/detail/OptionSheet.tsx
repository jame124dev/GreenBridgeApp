import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { brand } from '@/constants/theme';

// Deep imports, not the `@/components/ui` barrel — the barrel re-exports Button
// (-> react-native-reanimated) and LanguageSheet (-> MMKV), and this component is
// mounted from cards that three screens render. Same reasoning, verbatim, as
// `CategoryPickerSheet.tsx`.
import { Sheet } from '@/components/ui/Sheet';

export type SheetOption = { value: string; label: string; description?: string };

/**
 * The options list behind a `PickerRow`.
 *
 * BORROWED, NOT BUILT. `Sheet` + `Sheet.Option` is this repo's picker: it is what
 * `CategoryPickerSheet` (the row we are converging on), `CountryPicker` and the
 * lab chat's category/currency sheets already use, so this adds no new visual
 * language — and it is the primitive that already carries the two device bugs
 * nobody should solve twice (`Sheet.tsx`: the Android nav-bar inset under the
 * Cancel row, and the IME drawing over a short card inside a `Modal`).
 *
 * Deliberately NOT `features/v2/ui/ConfirmSheet.tsx`. That is a confirm dialog —
 * `PrimaryAction` over `QuietAction`, no list — and it renders through a portal
 * mounted above `V2ThemeProvider`, so everything inside it has to be carried
 * across a `V2ThemeBridge`. These cards are on the old brand kit, and the row
 * this sheet serves is modelled on `CategoryPickerSheet`, which is a `Sheet`.
 * Matching the sheet the Category row already opens is the point of the change.
 *
 * MULTI-SELECT BUFFERS ITS EDITS. In single mode a tap commits and closes, which
 * is what a pill row did. In multi mode taps would otherwise apply live and the
 * sheet's own trailing button — "Cancel", owned by the `Sheet` primitive — would
 * be a lie. So multi mode toggles a LOCAL draft and commits on Done; Cancel, the
 * backdrop and the swipe then all genuinely discard.
 */
type Common = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: readonly SheetOption[];
  onClose: () => void;
};

type SingleProps = Common & {
  multi?: false;
  selected: string;
  onSelect: (value: string) => void;
};

type MultiProps = Common & {
  multi: true;
  selected: readonly string[];
  onCommit: (values: string[]) => void;
};

export function OptionSheet(props: SingleProps | MultiProps) {
  const { visible, title, subtitle, options, onClose } = props;
  const { t } = useTranslation();

  /*
    Only read in multi mode. Re-seeded from `selected` every time the sheet
    OPENS, so a discarded edit is really discarded and the next open starts from
    the committed truth rather than from the abandoned draft.

    Adjusted DURING RENDER off a remembered `visible`, not in an effect — React's
    own "adjusting state when a prop changes" pattern. An effect here would be a
    cascading render (`react-hooks/set-state-in-effect`) and would also paint one
    frame of the stale draft before correcting it.
  */
  const [draft, setDraft] = useState<string[]>([]);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible && props.multi) setDraft([...props.selected]);
  }

  const isMulti = props.multi === true;
  const active = (value: string) =>
    isMulti ? draft.includes(value) : (props as SingleProps).selected === value;

  const pick = (value: string) => {
    if (isMulti) {
      setDraft((cur) =>
        cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      );
      return;
    }
    (props as SingleProps).onSelect(value);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      {options.map((opt) => (
        <Sheet.Option
          key={opt.value}
          label={opt.label}
          description={opt.description}
          // `Sheet.Option` renders a ✓ on `active` — the check glyph the a11y
          // review asked for (B6), so selection is never carried by fill alone.
          active={active(opt.value)}
          onPress={() => pick(opt.value)}
        />
      ))}
      {isMulti ? (
        <Pressable
          style={styles.done}
          onPress={() => {
            (props as MultiProps).onCommit(draft);
            onClose();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.doneLabel}>
            {t('mobile.detail.optionSheetDone', { defaultValue: 'Done' })}
          </Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  done: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
    backgroundColor: brand.primary,
  },
  doneLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 15,
    color: brand.primaryForeground,
  },
});
