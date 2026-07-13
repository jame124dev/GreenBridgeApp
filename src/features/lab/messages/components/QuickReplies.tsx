// QuickReplies — a horizontal row of tappable canned openers above the composer
// (redesign mockup: `.quick` / `.qr`). Tapping one sends it immediately through
// the thread's existing `send()`; the row hides when the thread can't send yet.
//
// NOTE: inline styles (not StyleSheet.create) — see ListingContextCard for why.
import { Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { fonts, greenDarkest, greenLight, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

// Quick-reply i18n keys — the displayed AND sent text is the localized string.
const QUICK_REPLY_KEYS = ['stillAvailable', 'shipToBangkok', 'bestPrice'] as const;

export function QuickReplies({
  replies,
  onSelect,
  disabled = false,
}: {
  replies?: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  if (disabled) return null;

  const list = replies ?? QUICK_REPLY_KEYS.map((k) => t(`mobile.labDeal.quickReplies.${k}`));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        gap: spacing.sm,
        paddingHorizontal: 14,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        alignItems: 'center',
      }}
    >
      {list.map((r) => (
        <Pressable
          key={r}
          onPress={() => {
            haptics.impact();
            onSelect(r);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labDeal.sendQuick', { text: r })}
          style={({ pressed }) => ({
            justifyContent: 'center',
            minHeight: 40,
            borderWidth: 1,
            borderColor: greenLight,
            borderRadius: radius.full,
            backgroundColor: lab.pillBg,
            paddingHorizontal: 14,
            paddingVertical: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 15, color: greenDarkest }}>{r}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
