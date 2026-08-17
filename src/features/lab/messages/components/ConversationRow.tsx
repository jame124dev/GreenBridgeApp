// ConversationRow — one row in the Messages inbox.
//
// WHY THIS SHAPE (inbox redesign): the previous row inverted its own hierarchy.
// The listing line ("<title> · #<batch>") was green + semibold sitting directly
// under the name, so the LOUDEST text in the row was metadata, while the last
// message — the only thing that tells a buyer whether to open the thread — was
// the smallest, faintest line. Inverted here: the preview is the row's content
// (largest body text, ink), the listing is quiet meta (small, inkMeta, no accent
// colour), and the name owns the top line with the time.
//
// ── THE CONTENT LINE ADAPTS TO WHAT THE SERVER ACTUALLY SENT ───────────────
// `GET /chat/buyer/:id/sellers` returns seller fields + `batch_id` +
// `lastMessageAt` and NOTHING else — no `lastMessage`, no `batch_title`. So a
// row that always printed the preview slot printed the placeholder "No messages
// yet" on 100% of rows, including threads full of messages: the row led with a
// false statement. Three cases now, in order of what we can prove:
//   • preview text present  → preview is the content, listing is quiet meta.
//   • no preview, no lastMessageAt → the thread genuinely IS empty, so the
//     "No messages yet" placeholder is true and earns its place.
//   • no preview but a lastMessageAt → messages exist and we don't have their
//     text. Promote the LISTING (the only fact we hold) into the content slot
//     rather than asserting anything about the messages.
//
// It also moved onto the app's card language (white card + hairline + 16px
// radius + 12px gutter, exactly like HomeRecentWants' rows and the Matches
// cards) instead of a flat hairline row floating on the LabScreenBg wash — the
// inbox now reads as the same app as Home/Matches.
//
// UNREAD must be unmistakable WITHOUT colour vision, so it carries four cues at
// once: a tinted card + soft green border, a solid left accent bar, heavier type
// on the name/preview, and the numeric count pill. Colour alone would fail a
// red/green-blind buyer.
//
// TOUCH TARGET: 44px avatar + 12px vertical padding ⇒ ≥68px tall row (the rule
// is ≥56). The whole card is the pressable — no nested controls to mis-hit.
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, greenLight, greenMedium, lab, radius, spacing } from '@/constants/theme';
import { relativeTime } from '@/features/lab/data/matchesFromApi';
import { POP_STAGGER_MS, usePop, usePressScale } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import type { ConversationRow as ConversationRowData } from '../chatApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Avatar initials tint (mockup `.av` colour #EAF3EC) — no matching neutral token.
const AVATAR_INK = '#EAF3EC';

/** Entrance stagger cap. At 80ms/row an uncapped `index * POP_STAGGER_MS` would
 *  still be animating row 40 in more than three seconds after the screen opened
 *  (and FlatList remounts recycled rows while scrolling, so late rows would pop
 *  in visibly late). Six rows ≈ 480ms covers the first screenful; everything
 *  after it appears immediately. */
const MAX_STAGGER_ROWS = 6;

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

/** Pick a gradient from a numeric seed.
 *
 *  DEFENSIVE ON PURPOSE: the backend row is built by spreading
 *  `sellerMap[c.seller_id]`, which is `undefined` for a deleted counterparty, so
 *  the seed arrived as NaN — `AVATAR_GRADIENTS[NaN]` is `undefined` and spreading
 *  it threw "undefined is not iterable" DURING RENDER, taking down the whole
 *  Messages tab rather than one row. A colour is never worth a crash. */
function avatarGradient(seed: number): readonly [string, string] {
  const safe = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return AVATAR_GRADIENTS[safe % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0];
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
  const preview = (data.lastMessage || '').toString().trim();
  // Only the absence of BOTH a preview and a last-message timestamp proves the
  // thread is empty. See the header note — this row must never claim otherwise.
  const provenEmpty = preview.length === 0 && data.lastMessageAt == null;
  const unread = Math.max(0, Number(data.unreadCount) || 0);
  // Presence is optional — only draw the dot when the backend reports it.
  const online = data.online === true || data.is_online === true;

  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  const entering = usePop(Math.min(index, MAX_STAGGER_ROWS) * POP_STAGGER_MS);

  // Spoken form: the visual unread cues (pill, accent bar, weight) carry no
  // meaning for a screen reader, so the count is appended to the row label.
  const unreadSpoken =
    unread > 0
      ? t(unread === 1 ? 'mobile.labMessages.unreadOne' : 'mobile.labMessages.unreadOther', {
          count: unread,
          defaultValue: unread === 1 ? '{{count}} unread message' : '{{count}} unread messages',
        })
      : null;
  const rowLabel = t('mobile.labMessages.rowA11y', { name, title });

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.tap();
        onPress(data);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      entering={entering}
      style={[styles.row, unread > 0 && styles.rowUnread, pressStyle]}
      accessibilityRole="button"
      accessibilityLabel={unreadSpoken ? `${rowLabel}, ${unreadSpoken}` : rowLabel}
      testID="conversation-row"
    >
      {/* Cue 1 of 4 — solid left accent bar. A SHAPE change, so it survives
          greyscale / colour-blind viewing where a tint alone would not. */}
      {unread > 0 ? <View style={styles.unreadBar} /> : null}

      <View style={styles.avatarWrap}>
        <LinearGradient
          colors={[...avatarGradient(Number(data.ID) + Number(data.batch_id))]}
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
          <Text numberOfLines={1} style={[styles.name, unread > 0 && styles.nameUnread]}>
            {name}
          </Text>
          {data.lastMessageAt ? (
            <Text style={[styles.time, unread > 0 && styles.timeUnread]}>
              {relativeTime(data.lastMessageAt)}
            </Text>
          ) : null}
        </View>

        {/* The row's CONTENT — what the buyer actually decides on. */}
        {preview ? (
          <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewUnread]}>
            {preview}
          </Text>
        ) : provenEmpty ? (
          <Text numberOfLines={1} style={styles.previewEmpty}>
            {t('mobile.labMessages.noMessagesYet', { defaultValue: 'No messages yet' })}
          </Text>
        ) : (
          // Messages exist but their text isn't on the wire: the listing IS the
          // content line here, so the row still leads with something true.
          <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewUnread]}>
            {listing}
          </Text>
        )}

        {/* Quiet metadata — context, never the focal point. Suppressed when the
            listing has already been promoted above, so the row never repeats
            itself (UX rules: "Can anything be removed?"). */}
        {preview || provenEmpty ? (
          <Text numberOfLines={1} style={styles.listing}>
            {listing}
          </Text>
        ) : null}
      </View>

      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // Card row — same surface/border/radius as HomeRecentWants + the Matches cards.
  // `overflow: hidden` clips the unread accent bar to the rounded corners.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lab.hairline,
    backgroundColor: brand.surface,
    overflow: 'hidden',
  },
  // Cues 2 + 3 — tinted surface and a soft green border on the whole card.
  rowUnread: { backgroundColor: lab.pillBg, borderColor: lab.sellBorder },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: greenMedium },

  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 18, color: AVATAR_INK },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: greenLight,
    borderWidth: 2,
    borderColor: '#fff',
  },

  body: { flex: 1, minWidth: 0 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 19, color: lab.ink },
  // Cue 4 — weight, so unread reads at a glance in greyscale too.
  nameUnread: { fontFamily: fonts.bold },
  // Every line in this row is information the buyer acts on, so all of it sits on
  // `lab.inkSub` (≈5:1 on white) rather than `inkMeta`/`inkFaint` (2.7–3.0:1 —
  // below AA at these sizes). Hierarchy is carried by SIZE and WEIGHT instead of
  // by fading text out until it fails contrast.
  time: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: lab.inkSub, flexShrink: 0 },
  timeUnread: { fontFamily: fonts.semibold, color: greenDarkest },

  preview: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: lab.inkSub, marginTop: 2 },
  previewUnread: { fontFamily: fonts.semibold, color: lab.ink },
  // No `fontStyle: 'italic'` — Inter ships no italic face here, and Android
  // silently swaps the whole run to the system font when the style is missing.
  previewEmpty: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: lab.inkSub, marginTop: 2 },
  listing: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: lab.inkSub, marginTop: 3 },

  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: greenDarkest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: '#fff' },
});
