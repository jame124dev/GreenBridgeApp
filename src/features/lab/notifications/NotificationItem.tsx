// One notification row — mobile port of the web NotificationItem. Icon tile
// (type-accent) + translated type label + message + time/batch meta + unread dot.
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { brand, radius, spacing } from '@/constants/theme';
import { relTime } from '@/features/lab/chat/cardKit';
import { ACCENT, notificationMeta } from './notificationMeta';
import type { AppNotification } from './notificationTypes';

export function NotificationItem({
  notification: n,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const meta = notificationMeta(n.type);
  const { Icon } = meta;
  const accent = ACCENT[meta.accent];
  const label = t(`mobile.labNotif.type.${meta.labelKey}`);
  const time = relTime(n.createdAt ?? n.created_at);
  const batchLabel = n.batch_id != null ? t('mobile.labNotif.batch', { id: n.batch_id }) : null;
  const meta2 = [batchLabel, time].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${n.message ?? ''}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'flex-start',
          padding: spacing.sm + 2,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: n.isRead ? 'transparent' : brand.border,
          backgroundColor: n.isRead ? brand.background : brand.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: accent.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={accent.fg} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <Text variant="subtitle" tone="primary" className="font-semibold" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Text>
          {!n.isRead ? (
            <View
              style={{ width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: brand.primary }}
              accessibilityLabel={t('mobile.labNotif.unread')}
            />
          ) : null}
        </View>
        {n.message ? (
          <Text variant="bodySm" tone="tertiary" numberOfLines={2} style={{ marginTop: 1 }}>
            {n.message}
          </Text>
        ) : null}
        {meta2 ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
            {meta2}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
