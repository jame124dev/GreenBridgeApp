import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { formatBatchDateTime } from '@/lib/dates';
import { brand } from '@/constants/theme';

import { fieldLabelKey } from '../listingEditLabels';
import { readPendingChange } from '../listingEditMapping';
import type { ListingPendingEdit } from '../listingEditTypes';

/**
 * The state a seller lands in when they already have one edit in the queue.
 *
 * Requirement: "if a pending edit already exists, show that state rather than
 * letting them submit a second one." So this is not a warning banner bolted on
 * top of a live form — the screen renders THIS instead of the form. It has to
 * carry everything the form would have told them: what is waiting, what the
 * live listing still shows, and when it was sent.
 */
export function PendingEditNotice({ pending }: { pending: ListingPendingEdit }) {
  const { t } = useTranslation();
  const entries = Object.entries(pending.changed_fields ?? {});

  return (
    <View className="bg-brand-warning-bg border border-brand-warning-border rounded-sm p-2xl gap-md">
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <MaterialIcons name="hourglass-top" size={20} color={brand.warningText} />
        <Text variant="subtitle" tone="primary" className="flex-1">
          {t('mobile.listingEdit.pendingTitle')}
        </Text>
      </View>

      <Text variant="body" tone="secondary">
        {t('mobile.listingEdit.pendingBody', {
          when: formatBatchDateTime(pending.submitted_at),
        })}
      </Text>

      {entries.length > 0 ? (
        <View className="gap-xs">
          <Text variant="caption" tone="secondary" className="font-bold uppercase tracking-wider">
            {t('mobile.listingEdit.pendingChangesHeading')}
          </Text>
          {entries.map(([field, raw]) => {
            const { from, to } = readPendingChange(raw);
            const key = fieldLabelKey(field);
            const label = key ? t(key) : field.replace(/_/g, ' ');
            return (
              <View key={field} className="gap-xxs">
                <Text variant="bodySm" tone="primary" className="font-semi">
                  {label}
                </Text>
                <Text variant="bodySm" tone="tertiary" numberOfLines={3}>
                  {from
                    ? t('mobile.listingEdit.fromTo', { from, to: to ?? '—' })
                    : (to ?? '—')}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text variant="bodySm" tone="secondary">
        {t('mobile.listingEdit.pendingHint')}
      </Text>
    </View>
  );
}
