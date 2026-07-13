// ListingContextCard — the pinned card under the conversation header that keeps
// the listing the chat is about one tap away (redesign mockup: `.ctx`). Shows a
// product thumb + the listing title + a "Listing #{batchId} · {price}" subline +
// a "View" affordance. Falls back to "Listing #{batchId}" when no listing title
// was passed through the navigation params.
//
// NOTE: styles are INLINE (not StyleSheet.create) on purpose — a StyleSheet
// variant of this file failed to bind its registered styles at runtime on the
// dev client (card rendered unstyled), so inline objects guarantee the layout.
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { ProductThumb } from '@/features/lab/components';

export function ListingContextCard({
  batchId,
  title,
  image,
  priceText,
  onView,
}: {
  batchId: number | string;
  title?: string | null;
  image?: string | null;
  priceText?: string | null;
  onView?: () => void;
}) {
  const hasTitle = typeof title === 'string' && title.trim().length > 0;
  const heading = hasTitle ? title!.trim() : `Listing #${batchId}`;
  const metaParts = [hasTitle ? `Listing #${batchId}` : null, priceText || null].filter(Boolean);
  const meta = metaParts.join(' · ');

  return (
    <Pressable
      onPress={
        onView
          ? () => {
              haptics.tap();
              onView();
            }
          : undefined
      }
      accessibilityRole={onView ? 'button' : undefined}
      accessibilityLabel={onView ? `View ${heading}` : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginHorizontal: 14,
        marginTop: spacing.md,
        paddingHorizontal: 11,
        paddingVertical: spacing.sm,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: lab.hairline,
        borderRadius: radius.lg,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <ProductThumb uri={image ?? undefined} size={40} radius={radius.md} kind="machine" />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: lab.ink }}>
          {heading}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: lab.inkSub, marginTop: 2 }}>
            {meta}
          </Text>
        ) : null}
      </View>

      {onView ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: greenDarkest }}>View</Text>
          <ChevronRight size={13} color={greenDarkest} strokeWidth={2.4} />
        </View>
      ) : null}
    </Pressable>
  );
}
