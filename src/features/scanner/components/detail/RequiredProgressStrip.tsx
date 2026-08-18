import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useRequiredRowLabel } from '@/features/scanner/requiredRowLabels';
import {
  REQUIRED_ROWS,
  type RequiredRowKey,
  type RequiredStatus,
} from '@/features/scanner/requiredStatus';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';

interface Props {
  rows: RequiredStatus['rows'];
  doneCount: number;
  total: number;
  onPressRow: (key: RequiredRowKey) => void;
}

/**
 * Sticky required-progress strip for the single-item editor's footer: a 4 px
 * completion track plus one tappable chip per still-missing field. Tapping a chip
 * scrolls to the card that owns it.
 *
 * Mirrors the review hub's pinned footer (app/scan/grouped-review.tsx — track at
 * :360-368) so the two screens read the same, and carries NO header text: the bar
 * is the progress and the chips are the names, so nothing here repeats the
 * RequiredChecklist card's copy at the end of the scroll.
 *
 * Renders null once every row passes — at that point the footer is just the CTA
 * (UX_DESIGN_RULES "Adaptive UI") and the collapsed green checklist strip already
 * says "complete".
 *
 * Props, not form context: in `grouped-edit.tsx` the footer lives OUTSIDE the
 * FormProvider, so a context-reading version could not be reused there later.
 *
 * Chip sizing: the pill is 32 px tall so a row of them does not re-introduce the
 * vertical crowding M-11 is fixing, and `hitSlop` lifts the real touch target to
 * 44 px (the platform minimum) without changing the layout — the same trick the
 * sibling cards already use (LocationCard.tsx:182, PhotosCard.tsx:79).
 */
export function RequiredProgressStrip({ rows, doneCount, total, onPressRow }: Props) {
  const labelForRow = useRequiredRowLabel();
  const missing = REQUIRED_ROWS.filter((k) => !rows[k]);
  if (missing.length === 0) return null;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <View>
      <View style={{ height: 4, backgroundColor: brand.divider }} accessible={false}>
        <View style={{ height: 4, width: `${pct}%`, backgroundColor: brand.primaryDim }} />
      </View>
      <View className="flex-row flex-wrap gap-1.5 px-lg pt-2.5">
        {missing.map((key) => {
          const label = labelForRow(key);
          return (
            <Pressable
              key={key}
              onPress={() => {
                haptics.tap();
                onPressRow(key);
              }}
              className="flex-row items-center gap-xs px-md rounded-pill border border-brand-destructive bg-brand-surface"
              style={{ minHeight: 32, paddingVertical: 4 }}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <MaterialIcons name="error-outline" size={13} color={brand.destructive} />
              <Text
                className="font-label text-brand-destructive"
                style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
