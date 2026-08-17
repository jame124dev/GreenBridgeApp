import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react-native';

import { Text } from './Text';
import { colors } from '@/constants/theme';
import { fonts } from '@/theme/typography';

// Themed picker — visual language deliberately mirrors `LanguageSheet.tsx`
// (the home-screen language switcher). Each option renders as a bordered
// card; active option uses the deep-forest brand color + green-50 fill.
// Built directly on RN `Modal` so it's immune to library incompat issues.
//
// ⚠️ Bottom-anchored card, forced edge-to-edge Android: with a flat 28px pad the
// Cancel Pressable's lower half sat on the 48dp 3-button navigation bar (tap →
// system Back) and it clipped the option list's last row. Every form dropdown
// built on this primitive inherited that, so the inset is read here. Mirrors
// Sheet.tsx / LanguageSheet.tsx.

// Design floor for the card's bottom padding; raised by the live inset.
const SHEET_PADDING_BOTTOM = 28;

export type PickerOption = {
  label: string;
  value: string;
};

type Props = {
  value: string;
  options: readonly PickerOption[];
  onChange: (value: string) => void;
  /** Shown in the trigger when no option matches `value`. */
  placeholder?: string;
  /** Sheet title. Defaults to the placeholder, or 'Select'. */
  title?: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
};

export function PickerSelect({
  value,
  options,
  onChange,
  placeholder,
  title,
  subtitle,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const layoutMap = useRef<Record<string, number>>({});

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const displayLabel = selected?.label ?? placeholder ?? '';
  const isPlaceholder = !selected;
  const sheetTitle = title ?? placeholder ?? 'Select';

  // Scroll the selected option into view after the sheet mounts.
  useEffect(() => {
    if (!open || !selected) return;
    const handle = setTimeout(() => {
      const y = layoutMap.current[selected.value];
      if (typeof y === 'number') {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: false });
      }
    }, 80);
    return () => clearTimeout(handle);
  }, [open, selected]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="rounded-xl border border-border bg-neutral-50 h-14 flex-row items-center px-xl"
      >
        <Text
          variant="body"
          tone={isPlaceholder ? 'tertiary' : 'primary'}
          className="flex-1"
          numberOfLines={1}
        >
          {displayLabel}
        </Text>
        <ChevronDown color={colors.neutral[400]} size={16} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <View style={styles.sheet} pointerEvents="box-none">
          <View
            style={[styles.sheetInner, { paddingBottom: Math.max(insets.bottom, SHEET_PADDING_BOTTOM) }]}
          >
            <RNText style={styles.title}>{sheetTitle}</RNText>
            {subtitle ? <RNText style={styles.subtitle}>{subtitle}</RNText> : null}

            <ScrollView
              ref={scrollRef}
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
            >
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onLayout={(e) => {
                      layoutMap.current[opt.value] = e.nativeEvent.layout.y;
                    }}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={[styles.option, active && styles.optionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <RNText
                      style={[styles.optionLabel, active && styles.optionLabelActive]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </RNText>
                    {active ? (
                      <RNText style={[styles.optionCode, styles.optionCodeActive]}>
                        ✓
                      </RNText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={styles.cancel}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
            >
              <RNText style={styles.cancelText}>
                {t('mobile.home.cancel', { defaultValue: 'Cancel' })}
              </RNText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetInner: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    // paddingBottom lives at the render site (safe-area aware, floor
    // SHEET_PADDING_BOTTOM) — a literal here would be always-overridden noise.
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#0f172a',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 14,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e5ec',
    marginBottom: 8,
  },
  optionActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#14452f',
  },
  optionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#121c28',
    flex: 1,
    marginRight: 12,
  },
  optionLabelActive: {
    color: '#14452f',
  },
  optionCode: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  optionCodeActive: {
    fontFamily: fonts.bold,
    color: '#14452f',
    fontSize: 16,
  },
  cancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#64748b',
  },
});
