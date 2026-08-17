// MessageBubble — one chat bubble. Mine = right-aligned deep-forest; theirs =
// left-aligned surface card. Radii/gutters match the AI chat (app/(lab)/chat.tsx)
// so the two conversation surfaces read as one app.
//
// GROUPING: a burst of messages from the same sender used to repeat its
// timestamp and its own tail radius on every bubble, so three lines looked like
// three separate conversations. The screen now decides grouping and passes it
// down: `firstInGroup` opens a group (wider top gap), `lastInGroup` closes it
// (tail radius + the group's ONE timestamp). Interior bubbles are tightly
// stacked, square-cornered on the tail side, and carry no meta at all.
//
// DELIVERY STATE is honest and distinct per status:
//   sent    → time + a SINGLE check. The backend has no read receipts, so this
//             is never a double check and never says "Read".
//   queued  → clock glyph + "Waiting for connection…". The message is accepted
//             and held in the outbox because the socket is down; it goes out on
//             reconnect. Distinct from 'pending' on purpose: saying "Sending…"
//             over a socket we know is down would be the same small lie the old
//             "you're offline" toast told, just quieter.
//   pending → clock glyph + "Sending…", bubble dimmed. The packet has left.
//   failed  → alert glyph + "Not sent — tap to retry" on a destructive ring;
//             the meta row IS the retry control. Reached only after the server
//             has been asked and does NOT have the message (see useChatThread),
//             so retry cannot duplicate it. A queued/pending/failed bubble always
//             shows its meta even mid-group — a failure must never hide.
//
// META LEGIBILITY: the delivery label and the timestamp are informational text,
// so they sit on `lab.inkSub` (5.45:1 on white) at 11px, not on `lab.inkMeta`
// (2.78:1 on the thread wash) at 10px. A status the user cannot read is not a
// status — `inkMeta` is for decoration only.
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, Clock } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import type { ThreadMessage } from '../useChatThread';

/** Vertical gap that OPENS a group (a new sender or a new burst). */
const GROUP_GAP = 10;
/** Vertical gap between bubbles INSIDE one group — deliberately tight. */
const STACK_GAP = 2;

/** ISO → local "10:24 AM". Null-safe: missing/invalid → no timestamp. Manual
 *  format (no Intl reliance) so it renders identically across engines. */
function clockTime(iso?: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m < 10 ? `0${m}` : m} ${suffix}`;
}

export function MessageBubble({
  msg,
  firstInGroup = true,
  lastInGroup = true,
  onRetry,
}: {
  msg: ThreadMessage;
  /** Opens a group: wider top gap. */
  firstInGroup?: boolean;
  /** Closes a group: tail radius + the group's single timestamp row. */
  lastInGroup?: boolean;
  /** Re-emit a failed message. Required for the retry affordance to appear. */
  onRetry?: (pendingId: string) => void;
}) {
  const { t } = useTranslation();
  const time = clockTime(msg.createdAt);
  const queued = msg.status === 'queued';
  const pending = msg.status === 'pending';
  const failed = msg.status === 'failed';
  const inFlight = queued || pending;
  const pendingId = msg.pendingId;
  const canRetry = failed && pendingId != null && onRetry != null;
  // In-flight and failed states always surface; 'sent' meta collapses into the
  // group's last bubble.
  const showMeta = (lastInGroup && (time != null || msg.mine)) || inFlight || failed;

  const metaBody = failed ? (
    <>
      <CircleAlert size={12} color={brand.destructive} strokeWidth={2.4} />
      <Text style={styles.metaFailed}>{t('mobile.labDeal.sendFailed', { defaultValue: 'Not sent — tap to retry' })}</Text>
    </>
  ) : inFlight ? (
    <>
      <Clock size={11} color={lab.inkSub} strokeWidth={2.2} />
      <Text style={styles.metaText}>
        {queued
          ? t('mobile.labDeal.queued', { defaultValue: 'Waiting for connection…' })
          : t('mobile.labDeal.sending', { defaultValue: 'Sending…' })}
      </Text>
    </>
  ) : (
    <>
      {time ? <Text style={styles.metaText}>{time}</Text> : null}
      {msg.mine ? (
        <View accessible accessibilityLabel={t('mobile.labDeal.sent', { defaultValue: 'Sent' })}>
          <Check size={12} color={lab.inkSub} strokeWidth={2.4} />
        </View>
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.row,
        msg.mine ? styles.rowMine : styles.rowTheirs,
        { marginTop: firstInGroup ? GROUP_GAP : STACK_GAP },
      ]}
      testID={`deal-msg-${msg.key}`}
    >
      <View style={[styles.col, msg.mine ? styles.colMine : styles.colTheirs]}>
        <View
          style={[
            styles.bubble,
            msg.mine ? styles.mine : styles.theirs,
            lastInGroup && (msg.mine ? styles.tailMine : styles.tailTheirs),
            inFlight && styles.inFlight,
            failed && styles.failed,
          ]}
        >
          <Text style={[styles.text, msg.mine ? styles.textMine : styles.textTheirs]}>{msg.text}</Text>
        </View>

        {showMeta ? (
          canRetry ? (
            <Pressable
              onPress={() => onRetry(pendingId)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.labDeal.sendFailedA11y', {
                defaultValue: 'Message not sent. Tap to try again.',
              })}
              style={[styles.meta, styles.metaTappable]}
              testID={`deal-retry-${pendingId}`}
            >
              {metaBody}
            </Pressable>
          ) : (
            <View style={styles.meta}>{metaBody}</View>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  col: { maxWidth: '82%' },
  colMine: { alignItems: 'flex-end' },
  colTheirs: { alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.lg,
  },
  mine: { backgroundColor: greenDarkest },
  theirs: {
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.divider,
  },
  // Tail = the "speech" corner. Only the bubble that CLOSES a group gets one.
  tailMine: { borderBottomRightRadius: radius.sm },
  tailTheirs: { borderBottomLeftRadius: radius.sm },
  // Still in flight: dimmed, so "not yet delivered" reads before the label does.
  inFlight: { opacity: 0.72 },
  failed: { borderWidth: 1, borderColor: brand.destructive },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  textMine: { color: '#EAF3EC' },
  textTheirs: { color: '#10201A' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: 4 },
  // Retry is a real control — pad it out to a comfortable target (with hitSlop
  // it clears the 48dp minimum) instead of a 13px line of text.
  metaTappable: { minHeight: 24, paddingVertical: spacing.xs },
  metaText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: lab.inkSub },
  metaFailed: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: brand.destructive },
});
