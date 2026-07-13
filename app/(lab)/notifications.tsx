// (lab) Notifications — the dedicated full-screen notification centre reached
// from the header bell. Nicer than the old sheet: a proper header (back +
// title + count + "Mark all read"), time-grouped sections (Today / This week /
// Earlier), pull-to-refresh, rich rows, and empty/error/loading states.
// Data + actions come from the same useLabNotifications hook (real backend).
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Inbox } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { LabScreenBg } from '@/features/lab/components';
import { brand, greenDarkest, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { NotificationItem } from '@/features/lab/notifications/NotificationItem';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { routeForType } from '@/features/lab/notifications/notificationNav';
import type { AppNotification } from '@/features/lab/notifications/notificationTypes';

type Bucket = 'today' | 'week' | 'earlier';

function bucketOf(n: AppNotification): Bucket {
  const raw = n.createdAt ?? n.created_at;
  if (!raw) return 'earlier';
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return 'earlier';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (ts >= start.getTime()) return 'today';
  if (Date.now() - ts < 7 * 24 * 3600 * 1000) return 'week';
  return 'earlier';
}

export default function LabNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { items, unreadCount, loading, error, fetchNotifications, markRead, markAllAsRead } =
    useLabNotifications();

  const onItemPress = useCallback(
    (n: AppNotification) => {
      void markRead([n.notification_id]);
      const path = routeForType(n.type);
      if (path) router.push(path as never);
    },
    [markRead, router],
  );

  // Group into Today / This week / Earlier, preserving order + dropping empties.
  const sections = useMemo(() => {
    const order: Bucket[] = ['today', 'week', 'earlier'];
    const map: Record<Bucket, AppNotification[]> = { today: [], week: [], earlier: [] };
    items.forEach((n) => map[bucketOf(n)].push(n));
    return order
      .filter((b) => map[b].length > 0)
      .map((b) => ({ key: b, title: t(`mobile.labNotif.group.${b}`), data: map[b] }));
  }, [items, t]);

  return (
    <LabScreenBg>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labHome.back')}
        >
          <ChevronLeft size={26} color={greenDarkest} />
        </Pressable>
        <Text variant="title" tone="primary" style={styles.title}>
          {t('mobile.labNotif.title')}
        </Text>
        <View style={{ flex: 1 }} />
        {unreadCount > 0 ? (
          <Pressable onPress={() => markAllAsRead()} hitSlop={8} accessibilityRole="button">
            <Text variant="bodySm" style={{ color: greenDarkest, fontWeight: '600' }}>
              {t('mobile.labNotif.markAllRead')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(n) => String(n.notification_id)}
        renderItem={({ item }) => (
          <NotificationItem notification={item} onPress={() => onItemPress(item)} />
        )}
        renderSectionHeader={({ section }) => (
          <Text variant="caption" tone="tertiary" style={styles.sectionHeader}>
            {section.title.toUpperCase()}
          </Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing['3xl'],
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchNotifications} tintColor={greenDarkest} />
        }
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          error ? (
            <View style={styles.center}>
              <Text variant="body" tone="tertiary">
                {t('mobile.labNotif.errorText')}
              </Text>
              <Pressable onPress={() => fetchNotifications()} hitSlop={8} style={{ marginTop: spacing.sm }}>
                <Text variant="bodySm" style={{ color: greenDarkest, fontWeight: '600' }}>
                  {t('mobile.labNotif.retry')}
                </Text>
              </Pressable>
            </View>
          ) : loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={greenDarkest} />
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Inbox size={34} color={brand.mutedForeground} />
              </View>
              <Text variant="subtitle" tone="primary" className="font-semibold" style={{ marginTop: spacing.md }}>
                {t('mobile.labNotif.emptyTitle')}
              </Text>
              <Text variant="bodySm" tone="tertiary" style={{ marginTop: 2 }}>
                {t('mobile.labNotif.emptySub')}
              </Text>
            </View>
          )
        }
      />
    </View>
    </LabScreenBg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 18,
    paddingVertical: spacing.sm,
  },
  title: { fontWeight: '700' },
  sectionHeader: {
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing['4xl'] },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
