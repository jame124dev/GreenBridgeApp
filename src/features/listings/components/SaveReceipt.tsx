import { Modal, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { brand } from '@/constants/theme';

import { dedupeFieldLabels, joinLabels } from '../listingEditLabels';
import type { ListingEditPatchResult } from '../listingEditTypes';

interface Props {
  result: ListingEditPatchResult | null;
  onDone: () => void;
}

/**
 * What actually happened, in the seller's language, straight from the API's
 * `applied` / `pending_review`.
 *
 * The API also returns a human `message`, but it is composed server-side in
 * English. So the headline is composed here from the field lists (localised in
 * all six bundles) and `message` is only used as the fallback when the server
 * reports neither list — the one case the app cannot describe on its own.
 */
export function SaveReceipt({ result, onDone }: Props) {
  const { t } = useTranslation();
  if (!result) return null;

  const and = t('mobile.listingEdit.and');
  const applied = dedupeFieldLabels(result.applied, t);
  const pending = dedupeFieldLabels(result.pending_review, t);
  const nothing = applied.length === 0 && pending.length === 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View
        className="flex-1 items-center justify-center px-2xl"
        style={{ backgroundColor: 'rgba(18,28,40,0.45)' }}
      >
        <View className="w-full bg-brand-surface rounded-lg p-2xl gap-md" style={{ maxWidth: 420 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <MaterialIcons
              name={pending.length > 0 ? 'schedule' : 'check-circle'}
              size={22}
              color={pending.length > 0 ? brand.warningText : brand.primary}
            />
            <Text variant="subtitle" tone="primary" className="flex-1">
              {nothing
                ? t('mobile.listingEdit.savedNothingTitle')
                : pending.length > 0
                  ? t('mobile.listingEdit.savedPartlyTitle')
                  : t('mobile.listingEdit.savedTitle')}
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 12 }}>
            {applied.length > 0 ? (
              <View className="bg-brand-primary-surface border border-brand-primary-border rounded-sm p-lg gap-xxs">
                <Text
                  variant="caption"
                  tone="brand"
                  className="font-bold uppercase tracking-wider"
                >
                  {t('mobile.listingEdit.savedLiveHeading')}
                </Text>
                <Text variant="body" tone="primary">
                  {t('mobile.listingEdit.savedLiveSentence', {
                    fields: joinLabels(applied, and),
                  })}
                </Text>
              </View>
            ) : null}

            {pending.length > 0 ? (
              <View className="bg-brand-warning-bg border border-brand-warning-border rounded-sm p-lg gap-xxs">
                <Text
                  variant="caption"
                  tone="secondary"
                  className="font-bold uppercase tracking-wider"
                >
                  {t('mobile.listingEdit.savedPendingHeading')}
                </Text>
                <Text variant="body" tone="primary">
                  {t('mobile.listingEdit.savedPendingSentence', {
                    fields: joinLabels(pending, and),
                  })}
                </Text>
              </View>
            ) : null}

            {nothing ? (
              <Text variant="body" tone="secondary">
                {result.message ?? t('mobile.listingEdit.savedNothingBody')}
              </Text>
            ) : null}
          </ScrollView>

          <Button
            label={t('mobile.listingEdit.done')}
            onPress={onDone}
            variant="primary"
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
}
