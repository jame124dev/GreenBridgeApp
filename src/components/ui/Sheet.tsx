import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { fonts } from '@/theme/typography';

// Bottom-sheet primitive. Visual language matches `LanguageSheet.tsx` (the
// home-screen language switcher) and `PickerSelect.tsx`, so every dropdown
// across the app reads as one system: slate backdrop, bordered cards per
// option, deep-forest active state, cancel button. Built on RN `Modal`.
//
// ⚠️ The card is bottom-anchored (`styles.sheet` = flex:1 + flex-end), so on
// Android — which is forced edge-to-edge — it draws to the PHYSICAL screen
// bottom. The old flat `paddingBottom: 28` was smaller than the 48dp 3-button
// navigation bar, which put the lower half of the trailing Cancel row on top of
// Back/Home/Recents: the tap went to the system button, not to Cancel. The
// bottom inset is therefore read here, in the primitive, so all ~10 consumers
// (AddWantSheet, ManageWantSheet, ReportBlockSheet, InterestsSheet,
// IdentifyUnknownSheet, MoveToGroupSheet, LocationPrimerSheet, CountryPicker,
// LabCategorySheet, LabCurrencySheet) are fixed once instead of ten times.
// Same pattern as `src/features/lab/components/UploadSourceSheet.tsx`.

// Design floor for the card's bottom padding, used as the lower bound against
// the live safe-area inset (see the Math.max at the render site).
const SHEET_PADDING_BOTTOM = 28;

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Kept for backwards-compat; ignored in the new layout (height is content-driven, capped by maxHeight). */
  snapTo?: string | number;
  /** Max scrollable area height in px. Default 380. */
  maxHeight?: number;
  /**
   * Rendered BETWEEN the title block and the scrollable body, so it stays put
   * while the list scrolls. Added for the category sheet's search field: with 62
   * leaves under 4 parents, a search box placed as the first CHILD (the
   * CountryPicker pattern, `CountryPicker.tsx:50-66`) scrolls out of reach after
   * one flick.
   */
  stickyHeader?: React.ReactNode;
  children: React.ReactNode;
};

export function Sheet({ visible, onClose, title, subtitle, maxHeight = 380, stickyHeader, children }: SheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Swipe-down-to-dismiss. Translate the inner card with the drag; past a
  // threshold, animate it out then close. Bound only to the grabber/header
  // region so it never fights the inner ScrollView. `onClose` is read through a
  // ref so the (stable) PanResponder never captures a stale handler.
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90 || g.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onCloseRef.current();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

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
        <Animated.View
          style={[
            styles.sheetInner,
            // Math.max, not "+": 28 is the design's own breathing room, and on a
            // gesture-nav / iOS device the inset is already ≈ that. Adding both
            // would open a dead gap under Cancel on some devices and not others.
            { paddingBottom: Math.max(insets.bottom, SHEET_PADDING_BOTTOM), transform: [{ translateY }] },
          ]}
        >
          {/* Grabber + title share the drag region; the ScrollView below scrolls freely. */}
          <View {...pan.panHandlers}>
            <View style={styles.grabber} accessibilityElementsHidden importantForAccessibility="no" />
            {title ? <RNText style={styles.title}>{title}</RNText> : null}
            {subtitle ? <RNText style={styles.subtitle}>{subtitle}</RNText> : null}
          </View>

          {stickyHeader}

          <ScrollView
            style={{ maxHeight }}
            showsVerticalScrollIndicator={false}
            // A focused TextInput above the list (stickyHeader, or a first child
            // as in CountryPicker) otherwise eats the first tap on every row:
            // ScrollView defaults to keyboardShouldPersistTaps='never', so the
            // tap is consumed dismissing the keyboard and never reaches
            // Sheet.Option's onPress — "type `centrif`, tap the row, nothing
            // happens". "handled", not "always": a tap on empty space still
            // dismisses the keyboard, a tap on a child still fires.
            keyboardShouldPersistTaps="handled"
          >
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
        </Animated.View>
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
  /** Optional extra style merged onto the (non-header) card container. */
  style?: StyleProp<ViewStyle>;
  /** Omit for a non-interactive row (e.g. a `header` section label). */
  onPress?: () => void;
};

Sheet.Option = function SheetOption({
  label,
  description,
  active = false,
  rightAdornment,
  indent = false,
  header = false,
  style,
  onPress,
}: SheetOptionProps) {
  if (header) {
    return (
      <Pressable
        onPress={onPress}
        // A handler-less header is a SECTION LABEL, not a button: reporting
        // accessibilityRole="button" on it promises a tap that does nothing.
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'header'}
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
        style,
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
    paddingTop: 10,
    // paddingBottom is set at the render site (safe-area aware, floor
    // SHEET_PADDING_BOTTOM) — keeping a literal here too would be a second,
    // always-overridden source of truth.
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 12,
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
