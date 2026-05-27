import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { haptics } from '@/lib/haptics';
import { fonts } from '@/theme/typography';

// Languages: same set the web supports (101lab-2/src/i18n/config.ts).
const LANG_OPTIONS = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'zh', label: 'ZH', name: '中文' },
  { code: 'ja', label: 'JA', name: '日本語' },
  { code: 'th', label: 'TH', name: 'ภาษาไทย' },
] as const;

export type LanguageCode = (typeof LANG_OPTIONS)[number]['code'];

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Bottom-sheet style language picker. Built on RN's <Modal> so it renders
 * identically on iOS / Android / Web (unlike Alert.alert which only shows
 * the title on web with no buttons).
 */
export function LanguageSheet({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const current = i18n.language;

  const pick = (code: LanguageCode) => {
    if (code !== current) {
      haptics.tap();
      void i18n.changeLanguage(code);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Tap outside to dismiss */}
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet} pointerEvents="box-none">
        <View style={styles.sheetInner}>
          <Text style={styles.title}>{t('mobile.home.languageTitle')}</Text>
          <Text style={styles.subtitle}>{t('mobile.home.languageSubtitle')}</Text>

          {LANG_OPTIONS.map((opt) => {
            const active = opt.code === current;
            return (
              <Pressable
                key={opt.code}
                onPress={() => pick(opt.code)}
                style={[styles.option, active && styles.optionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                  {opt.name}
                </Text>
                <Text style={[styles.optionCode, active && styles.optionCodeActive]}>
                  {opt.label}
                  {active ? '  ✓' : ''}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            style={styles.cancel}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t('mobile.home.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  optionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#121c28',
  },
  optionLabelActive: {
    color: '#14452f',
  },
  optionCode: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  optionCodeActive: {
    fontFamily: fonts.bold,
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
