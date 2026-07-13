// NotificationBell — header bell: icon + unread badge. Taps navigate to the
// dedicated notifications page (app/(lab)/notifications). Keeps its own light
// hook instance purely for the badge count, refetched whenever the header
// screen regains focus (so the badge updates after reading on the page).
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lab, radius } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { useLabNotifications } from './useLabNotifications';

export function NotificationBell() {
  const router = useRouter();
  const { t } = useTranslation();
  const { unreadCount, badgeLabel, fetchNotifications } = useLabNotifications();

  // Refresh the badge each time the header's screen regains focus (e.g. on
  // return from the notifications page after marking items read).
  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();
    }, [fetchNotifications]),
  );

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        router.push(routes.labNotifications);
      }}
      style={styles.bell}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? t('mobile.labNotif.bellA11yUnread', { count: unreadCount })
          : t('mobile.labNotif.bellA11y')
      }
    >
      <Bell size={20} color={lab.ink} strokeWidth={1.9} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: lab.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: lab.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 13 },
});
