import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles, Trash2 } from 'lucide-react-native';

// Import the leaf components directly (not the '@/components/ui' barrel) so this
// presentational row stays unit-testable without pulling Button → reanimated.
import { AppImage } from '@/components/ui/AppImage';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import type { DraftSummary } from '@/services/drafts/draftApi';

type Props = {
  draft: DraftSummary;
  onResume: () => void;
  onDelete: () => void;
  /** Shows a spinner in place of the delete action for the row being opened. */
  resuming?: boolean;
  /** Locks the row (and its delete) while ANY row is resuming. */
  disabled?: boolean;
};

/** Compact "23m ago" / "5h ago" / "3d ago" / "just now" — the terse secondary
 *  line (mirrors the item-code line on a listing row). */
function agoLabel(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const m = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * One row in the drafts list (`app/scan/drafts.tsx`). Purposely mirrors the
 * seller listing row (`RecentSubmissionsList`'s `BatchRow`) so the drafts
 * "See all" and the listings "See all" read as one family: same white
 * rounded-2xl card, left edge-stripe, thumbnail tile, title + a terse
 * secondary line + a badge row, and a right-side action. The DRAFT-specific
 * differences: the stripe + primary badge are AMBER (unfinished, vs. a
 * listing's status color), the right slot is Delete (vs. a listing's price),
 * and the whole card taps to Resume (vs. a listing's tap → detail).
 *
 * Presentational: the screen owns data + passes plain callbacks (trivially
 * unit-testable, no QueryClient — see __tests__/DraftCard.test.tsx).
 */
export default function DraftCard({ draft, onResume, onDelete, resuming = false, disabled = false }: Props) {
  const { t } = useTranslation();

  const thumb =
    typeof draft.thumbnail_object === 'string' && /^https?:\/\//.test(draft.thumbnail_object)
      ? draft.thumbnail_object
      : null;
  const count = draft.product_count ?? 0;
  const ago = agoLabel(draft.updated_at);

  return (
    <Pressable
      className="flex-row items-center bg-white rounded-2xl border border-neutral-200 shadow-sm py-lg pr-xl pl-0 mb-lg gap-lg overflow-hidden active:opacity-90"
      onPress={onResume}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ busy: resuming, disabled }}
      accessibilityLabel={`${draft.title}. ${t('mobile.drafts.continue', { defaultValue: 'Continue' })}`}
    >
      {/* Amber edge stripe — draft "in progress" accent (vs. a listing's status color). */}
      <View className="w-[3px] self-stretch bg-warning" />

      {/* Thumbnail — background drafts carry a GCS photo; others fall back to a glyph. */}
      <View className="w-12 h-12 ml-[9px] relative">
        {thumb ? (
          <AppImage source={{ uri: thumb }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
        ) : (
          <View className="w-full h-full rounded-xl bg-amber-50 border border-amber-200 justify-center items-center">
            <Sparkles color="#d99413" size={18} />
          </View>
        )}
        {count > 1 ? (
          <View className="absolute -right-1 -bottom-1 min-w-[18px] h-[18px] px-[4px] rounded-full bg-neutral-900 justify-center items-center border-2 border-white">
            <Text className="font-bold text-[9px] text-white">{count}</Text>
          </View>
        ) : null}
      </View>

      {/* Title + terse secondary + badge row */}
      <View className="flex-1 gap-[3px]">
        <Text variant="subtitle" tone="primary" className="font-semibold" numberOfLines={1}>
          {draft.title}
        </Text>
        {ago ? (
          <Text variant="bodySm" tone="tertiary" numberOfLines={1}>
            {ago}
          </Text>
        ) : null}
        <View className="flex-row items-center flex-wrap gap-xs mt-[2px]">
          <Badge variant="warning" label={t('mobile.drafts.draftBadge', { defaultValue: 'DRAFT' })} size="sm" />
          {draft.flow === 'ai' ? (
            <Badge variant="ai" label="AI" size="sm" leftIcon={<Sparkles color="#F59E0B" size={10} />} />
          ) : null}
        </View>
      </View>

      {/* Right slot: Delete (or a spinner for the row being opened). */}
      {resuming ? (
        <ActivityIndicator color="#d99413" />
      ) : (
        <Pressable
          onPress={onDelete}
          disabled={disabled}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.drafts.delete', { defaultValue: 'Delete' })}
          className="p-xs active:opacity-60"
        >
          <Trash2 color="#dc2626" size={20} strokeWidth={1.9} />
        </Pressable>
      )}
    </Pressable>
  );
}
