import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Text } from '@/components/ui';

import { dedupeFieldLabels, joinLabels } from '../listingEditLabels';
import { splitByPolicy, type ListingEditMode } from '../listingEditPolicy';

interface Props {
  /** Section name shown above the reused card, e.g. "Price". */
  label: string;
  /** Contract field names this section owns. */
  fields: readonly string[];
  mode: ListingEditMode;
  /** Contract field names currently different from the loaded listing. */
  changedFields: readonly string[];
  children: React.ReactNode;
}

/**
 * Wraps a reused scan-detail card with the ONE thing the edit flow adds:
 * an honest, up-front answer to "will this change be live when I hit save?".
 *
 * The badge is always on screen while editing — the requirement is that a
 * seller is never surprised by an approval AFTER saving.
 *
 * Several reused cards are MIXED (IdentityCard holds title→review and
 * brand→instant; PricingCard holds price→review and quantity→instant). A single
 * badge would over-warn or under-warn half the card, so a mixed section names
 * the fields that need approval instead of implying it applies to everything.
 */
export function PolicySection({ label, fields, mode, changedFields, children }: Props) {
  const { t } = useTranslation();
  const { instant, review } = splitByPolicy(fields, mode);
  const mixed = review.length > 0 && instant.length > 0;
  const and = t('mobile.listingEdit.and');

  const dirty = fields.filter((f) => changedFields.includes(f));
  const dirtySplit = splitByPolicy(dirty, mode);

  return (
    <View className="gap-xs" style={{ marginBottom: 4 }}>
      <View className="flex-row items-center justify-between px-xs" style={{ gap: 8 }}>
        <Text
          variant="caption"
          tone="secondary"
          className="font-bold uppercase tracking-wider"
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {label}
        </Text>
        <Badge
          variant={review.length > 0 ? 'review' : 'success'}
          size="sm"
          dot
          label={
            review.length === 0
              ? t('mobile.listingEdit.instantBadge')
              : mixed
                ? t('mobile.listingEdit.mixedBadge')
                : t('mobile.listingEdit.reviewBadge')
          }
        />
      </View>

      {mixed ? (
        <Text variant="bodySm" tone="tertiary" className="px-xs">
          {t('mobile.listingEdit.mixedHint', {
            fields: joinLabels(dedupeFieldLabels(review, t), and),
          })}
        </Text>
      ) : null}

      {children}

      {dirty.length > 0 ? (
        <Text
          variant="bodySm"
          tone={dirtySplit.review.length > 0 ? 'secondary' : 'brand'}
          className="px-xs"
          style={{ marginTop: 2 }}
        >
          {dirtySplit.review.length > 0
            ? t('mobile.listingEdit.changedNeedsApproval', {
                fields: joinLabels(dedupeFieldLabels(dirtySplit.review, t), and),
              })
            : t('mobile.listingEdit.changedGoesLive', {
                fields: joinLabels(dedupeFieldLabels(dirtySplit.instant, t), and),
              })}
        </Text>
      ) : null}
    </View>
  );
}
