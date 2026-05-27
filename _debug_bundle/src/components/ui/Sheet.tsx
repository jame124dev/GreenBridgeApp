import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';

import { cx } from '@/lib/cx';
import { colors, fonts, fontSize, radius, spacing } from '@/theme';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Render a close (×) button in the header. Default true when title is set. */
  closable?: boolean;
  /** Max height the inner scroll area can grow to. Default 460. */
  maxHeight?: number;
  /** Wrap children in a ScrollView. Default true. */
  scrollable?: boolean;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

// Bottom-sheet modal built on RN <Modal>. Cross-platform (works on Expo Web,
// unlike @gorhom/bottom-sheet). Backdrop tap dismisses; Esc / Android back
// dismisses via onRequestClose.
//
//   <Sheet visible={open} onClose={close} title="Language">
//     <SheetOption label="English" active onPress={…} />
//     <SheetOption label="中文" onPress={…} />
//   </Sheet>

export function Sheet({
  visible,
  onClose,
  title,
  closable,
  maxHeight = 460,
  scrollable = true,
  children,
  contentStyle,
}: SheetProps) {
  const showClose = closable ?? !!title;
  const body = scrollable ? (
    <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View>{children}</View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={styles.sheet} pointerEvents="box-none">
        <View style={cx<ViewStyle>(styles.sheetInner, contentStyle)}>
          {title ? (
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              {showClose ? (
                <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
                  <X color={colors.textMuted} size={20} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {body}
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
  onPress: () => void;
};

// Single row inside a Sheet — typed checkmark + label + optional description.

Sheet.Option = function SheetOption({
  label,
  description,
  active = false,
  rightAdornment,
  indent = false,
  onPress,
}: SheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) =>
        cx<ViewStyle>(
          styles.option,
          indent && styles.optionIndent,
          active && styles.optionActive,
          pressed && styles.optionPressed,
        )
      }
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.optionBody}>
        <Text
          style={[styles.optionLabel, active && styles.optionLabelActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {description ? (
          <Text style={styles.optionDescription} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {rightAdornment ?? (active ? <Text style={styles.check}>✓</Text> : null)}
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
    backgroundColor: colors.backdrop,
  },
  sheet: { flex: 1, justifyContent: 'flex-end' },
  sheetInner: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['4xl'],
    borderTopRightRadius: radius['4xl'],
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['7xl'],
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  title: { fontFamily: fonts.heading, fontSize: fontSize['2xl'], color: colors.inkSlate },

  // Option row
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.xxs,
    gap: spacing.lg,
  },
  optionIndent: { paddingLeft: spacing['7xl'] },
  optionActive: { backgroundColor: colors.primarySurface },
  optionPressed: { opacity: 0.8 },
  optionBody: { flex: 1 },
  optionLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.inkSlate,
  },
  optionLabelActive: { fontFamily: fonts.semibold, color: colors.primary },
  optionDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: 2,
  },
  check: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.primary },
});
