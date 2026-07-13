// MessageBubble — one chat bubble. Mine = right-aligned deep-forest; theirs =
// left-aligned surface card. Matches the deal-thread bubble language. Under each
// bubble a small timestamp; on MINE a subtle single-check "sent" tick (there are
// no read receipts in the backend, so it's ONE check — never implies "read").
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, lab, radius } from '@/constants/theme';
import type { ThreadMessage } from '../useChatThread';

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

export function MessageBubble({ msg }: { msg: ThreadMessage }) {
  const time = clockTime(msg.createdAt);
  const showMeta = time != null || msg.mine;

  return (
    <View style={[styles.row, msg.mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.col, msg.mine ? styles.colMine : styles.colTheirs]}>
        <View style={[styles.bubble, msg.mine ? styles.mine : styles.theirs]}>
          <Text style={[styles.text, msg.mine ? styles.textMine : styles.textTheirs]}>{msg.text}</Text>
        </View>
        {showMeta ? (
          <View style={styles.meta}>
            {time ? <Text style={styles.metaText}>{time}</Text> : null}
            {msg.mine ? <Check size={12} color={lab.inkMeta} strokeWidth={2.4} /> : null}
          </View>
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
  mine: { backgroundColor: greenDarkest, borderBottomRightRadius: radius.sm },
  theirs: {
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.divider,
    borderBottomLeftRadius: radius.sm,
  },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  textMine: { color: '#EAF3EC' },
  textTheirs: { color: '#10201A' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: 4 },
  metaText: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 13, color: lab.inkMeta },
});
