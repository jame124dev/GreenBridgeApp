// Polished in-app notification toast — the mobile counterpart of the web's
// InAppToastCard. Rendered via `toast.custom(...)`. Design language (2025
// notification-card best practice): a type-accent rail down the left edge, a
// squircle icon medallion, a tight title + timestamp row, a 2-line body, and a
// single circular chevron affordance (toasts get ≤1 action and get out of the
// way fast). Colours come from notificationMeta so it stays one voice with the
// notification centre.
import { Pressable, View, StyleSheet } from 'react-native';
import { toast } from 'sonner-native';
import { ChevronRight, X } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { fonts, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { ACCENT, notificationMeta } from './notificationMeta';

export interface NotificationToastProps {
  toastId: string | number;
  title: string;
  message?: string;
  type: string;
  /** Short relative time, e.g. "now" / "2m". */
  time?: string;
  /** Tap the card → navigate to the relevant screen (also dismisses). Omitted
   *  when the type has no route (card is then informational only). */
  onView?: () => void;
}

export function NotificationToast({
  toastId,
  title,
  message,
  type,
  time = 'now',
  onView,
}: NotificationToastProps) {
  const meta = notificationMeta(type);
  const { Icon } = meta;
  const accent = ACCENT[meta.accent];

  const dismiss = () => toast.dismiss(toastId);
  const view = () => {
    haptics.tap();
    onView?.();
    dismiss();
  };

  return (
    // Outer View owns the card surface (bg/border/shadow) + clips the accent
    // rail; the inner Pressable handles the tap.
    <View style={styles.card}>
      <View style={[styles.rail, { backgroundColor: accent.fg }]} />
      <Pressable
        style={styles.row}
        onPress={onView ? view : undefined}
        accessibilityRole={onView ? 'button' : 'text'}
        accessibilityLabel={`${title}. ${message ?? ''}`}
      >
        <View style={[styles.medallion, { backgroundColor: accent.bg }]}>
          <Icon size={20} color={accent.fg} strokeWidth={2.2} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Text style={styles.time}>{time}</Text>
          </View>
          {message ? (
            <Text numberOfLines={2} style={styles.message}>
              {message}
            </Text>
          ) : null}
        </View>

        {onView ? (
          <View style={styles.chevron}>
            <ChevronRight size={16} color={accent.fg} strokeWidth={2.6} />
          </View>
        ) : (
          <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
            <X size={16} color={lab.inkMeta} strokeWidth={2.2} />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    borderCurve: 'continuous',
    overflow: 'hidden',
    // Soft, diffuse branded lift (building-native-ui: boxShadow, not elevation).
    boxShadow: '0 12px 32px rgba(14, 59, 46, 0.18)',
  },
  // Full-height type-accent rail down the left edge.
  rail: { width: 4, alignSelf: 'stretch' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  medallion: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.headingBold, fontSize: 15, lineHeight: 20, color: lab.ink },
  time: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: lab.inkFaint },
  message: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: lab.inkSub, marginTop: 2 },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: lab.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
