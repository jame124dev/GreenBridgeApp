import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { fonts } from '@/theme/typography';

// Bottom-sheet primitive. Visual language matches `LanguageSheet.tsx` (the
// home-screen language switcher) and `PickerSelect.tsx`, so every dropdown
// across the app reads as one system: slate backdrop, bordered cards per
// option, deep-forest active state, cancel button. Built on RN `Modal`.

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Kept for backwards-compat; ignored in the new layout (height is content-driven, capped by maxHeight). */
  snapTo?: string | number;
  /** Max scrollable area height in px. Default 380. */
  maxHeight?: number;
  children: React.ReactNode;
};

export function Sheet({ visible, onClose, title, subtitle, maxHeight = 380, children }: SheetProps) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet} pointerEvents="box-none">
        <View style={styles.sheetInner}>
          {title ? <RNText style={styles.title}>{title}</RNText> : null}
          {subtitle ? <RNText style={styles.subtitle}>{subtitle}</RNText> : null}

          <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>

          <Pressable
            style={styles.cancel}
            onPress={onClose}
            accessibilityRole="button"
          >
            <RNText style={styles.cancelText}>
              {t('mobile.home.cancel', { defaultValue: 'Cancel' })}
            </RNText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type SheetOptionProps = {
  label: string;
  description?: string;
  active?: boolean;
  rightAdornment?: React.ReactNode;
  indent?: boolean;
  /** Render as a section header (filled bg, uppercase) instead of a card. */
  header?: boolean;
  onPress: () => void;
};

Sheet.Option = function SheetOption({
  label,
  description,
  active = false,
  rightAdornment,
  indent = false,
  header = false,
  onPress,
}: SheetOptionProps) {
  if (header) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[styles.headerOption, active && styles.headerOptionActive]}
      >
        <RNText
          style={[styles.headerLabel, active && styles.headerLabelActive]}
          numberOfLines={1}
        >
          {label}
        </RNText>
        {rightAdornment ?? (active ? (
          <RNText style={[styles.checkActive, { fontSize: 14 }]}>✓</RNText>
        ) : null)}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.option,
        active && styles.optionActive,
        indent && styles.optionIndent,
      ]}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <RNText
          style={[styles.optionLabel, active && styles.optionLabelActive]}
          numberOfLines={1}
        >
          {label}
        </RNText>
        {description ? (
          <RNText style={styles.optionDescription} numberOfLines={2}>
            {description}
          </RNText>
        ) : null}
      </View>
      {rightAdornment ?? (active ? (
        <RNText style={styles.checkActive}>✓</RNText>
      ) : null)}
    </Pressable>
  );
};

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
    paddingBottom: 28,
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
  optionIndent: {
    marginLeft: 16,
  },
  optionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#121c28',
  },
  optionLabelActive: {
    color: '#14452f',
  },
  optionDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  checkActive: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#14452f',
  },
  // Section-header variant: filled bg, no border, uppercase bold smaller text.
  // Visually separates parent categories from their subcategory cards below.
  headerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
    marginTop: 4,
  },
  headerOptionActive: {
    backgroundColor: '#dcfce7',
  },
  headerLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#475569',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 8,
  },
  headerLabelActive: {
    color: '#14452f',
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
