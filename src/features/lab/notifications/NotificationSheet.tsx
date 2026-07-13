// NotificationSheet — the notification list, as a bottom sheet (built on RN
// Modal like LanguageSheet). Content mirrors the web NotificationPanel: header
// ("Notifications" + "Mark all read"), loading / error / empty states, and the
// scrollable list of NotificationItem rows.
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, greenDarkest, radius, spacing } from '@/constants/theme';
import { NotificationItem } from './NotificationItem';
import type { AppNotification } from './notificationTypes';

type Props = {
  visible: boolean;
  onClose: () => void;
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onMarkAllRead: () => void;
  onItemPress: (n: AppNotification) => void;
};

export function NotificationSheet({
  visible,
  onClose,
  items,
  unreadCount,
  loading,
  error,
  onRetry,
  onMarkAllRead,
  onItemPress,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('mobile.labCommon.close')} />
      <View style={styles.anchor} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text variant="title" tone="primary" style={styles.title}>
              {t('mobile.labNotif.title')}
            </Text>
            {unreadCount > 0 ? (
              <Pressable onPress={onMarkAllRead} hitSlop={8} accessibilityRole="button">
                <Text variant="bodySm" style={{ color: greenDarkest, fontWeight: '600' }}>
                  {t('mobile.labNotif.markAllRead')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Text variant="bodySm" style={{ color: brand.destructiveStrong, flex: 1 }}>
                {t('mobile.labNotif.errorText')}
              </Text>
              <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
                <Text variant="bodySm" style={{ color: greenDarkest, fontWeight: '600' }}>
                  {t('mobile.labNotif.retry')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {loading && items.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={greenDarkest} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Inbox size={38} color={brand.mutedForeground} />
              <Text variant="subtitle" tone="primary" className="font-semibold" style={{ marginTop: spacing.sm }}>
                {t('mobile.labNotif.emptyTitle')}
              </Text>
              <Text variant="bodySm" tone="tertiary" style={{ marginTop: 2 }}>
                {t('mobile.labNotif.emptySub')}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.sm }}>
              {items.map((n) => (
                <NotificationItem key={n.notification_id} notification={n} onPress={() => onItemPress(n)} />
              ))}
            </ScrollView>
          )}
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
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: brand.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '75%',
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: brand.borderStrong,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { fontWeight: '700' },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  center: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  empty: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  list: { flexGrow: 0 },
});
