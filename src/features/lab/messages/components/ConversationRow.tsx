// ConversationRow — one row in the Messages inbox (redesign mockup `.crow`): a
// flat list row (bottom hairline, no card) with the counterparty's coloured
// avatar (+ an online dot when the backend reports presence), name, the listing
// the chat is about ("<title> · #<batch>"), a last-message preview (bold when
// unread), relative time, and an unread-count badge. Tapping opens the thread.
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { fonts, greenDarkest, greenLight, lab, radius, spacing } from '@/constants/theme';
import { relativeTime } from '@/features/lab/data/matchesFromApi';
import { POP_STAGGER_MS, usePop, usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import type { ConversationRow as ConversationRowData } from '../chatApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Avatar initials tint (mockup `.av` colour #EAF3EC) — no matching neutral token.
const AVATAR_INK = '#EAF3EC';

// Per-seed avatar gradient pairs, mirroring the mockup's `.av` backgrounds.
const AVATAR_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#2A7D59', '#12604A'],
  ['#36916A', '#1f6b4a'],
  ['#14452F', '#0A2D20'],
  ['#8FA398', '#6E8074'],
  ['#16794A', '#0E3B2E'],
] as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function avatarGradient(seed: number): readonly [string, string] {
  return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length];
}

export function ConversationRow({
  data,
  index = 0,
  onPress,
}: {
  data: ConversationRowData;
  index?: number;
  onPress: (data: ConversationRowData) => void;
}) {
  const { t } = useTranslation();
  const name = (data.display_name || data.user_email || t('mobile.labMessages.sellerFallback')).toString();
  const title = (data.batch_title || data.product_name || t('mobile.labMessages.listingFallback')).toString();
  const listing = `${title} · #${data.batch_id}`;
  const preview = (data.lastMessage || '').toString();
  const unread = Number(data.unreadCount) || 0;
  // Presence is optional — only draw the dot when the backend reports it.
  const online = data.online === true || data.is_online === true;

  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.tap();
        onPress(data);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      entering={usePop(index * POP_STAGGER_MS)}
      style={[styles.row, pressStyle]}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.labMessages.rowA11y', { name, title })}
    >
      <View style={styles.avatarWrap}>
        <LinearGradient
          colors={[...avatarGradient(data.ID + data.batch_id)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initialsOf(name)}</Text>
        </LinearGradient>
        {online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {data.lastMessageAt ? (
            <Text style={styles.time}>{relativeTime(data.lastMessageAt)}</Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.listing}>
          {listing}
        </Text>
        {preview ? (
          <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewUnread]}>
            {preview}
          </Text>
        ) : null}
      </View>

      {unread > 0 ? (
        <View style={styles.right}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lab.hairline,
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 12, color: AVATAR_INK },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: radius.full,
    backgroundColor: greenLight,
    borderWidth: 2,
    borderColor: '#fff',
  },
  body: { flex: 1, minWidth: 0 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: lab.ink },
  time: { fontFamily: fonts.regular, fontSize: 11, color: lab.inkMeta, flexShrink: 0 },
  listing: { fontFamily: fonts.semibold, fontSize: 11, color: greenDarkest, marginTop: 1 },
  preview: { fontFamily: fonts.regular, fontSize: 12.5, color: lab.inkSub, marginTop: 2 },
  previewUnread: { fontFamily: fonts.semibold, color: lab.ink },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: greenDarkest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff' },
});
