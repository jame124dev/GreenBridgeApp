import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FooterButton } from './FooterButton';

interface Props {
  isGrouped: boolean;
  editingGroupedItem: boolean;
  queuedCount: number;
  allRequired: boolean;
  submitting: boolean;
  onSubmitSingle: () => void;
  onAddAnother: () => void;
  onReviewGroup: () => void;
  onSaveAndReturnToReview: () => void;
}

/**
 * Sticky footer action bar. Picks the right CTA pair based on listing mode:
 *  - single (default)        → Preview + Submit listing
 *  - grouped, fresh item     → Review group (+N) + Add another
 *  - grouped, editing item   → Save & return (replace to grouped-review)
 *
 * S6.2.b2.i — converted to NativeWind. Footer wrapper styles match the legacy
 * `styles.footer` block: flex row + gap + horizontal pad + thin top border on
 * surface background.
 */
export function DetailFooter({
  isGrouped,
  editingGroupedItem,
  queuedCount,
  allRequired,
  submitting,
  onSubmitSingle,
  onAddAnother,
  onReviewGroup,
  onSaveAndReturnToReview,
}: Props) {
  const { t } = useTranslation();

  const footerCls =
    'flex-row items-center gap-sm px-lg pt-2.5 pb-2.5 border-t border-brand-border-strong bg-brand-surface';

  if (isGrouped) {
    if (editingGroupedItem) {
      return (
        <View className={footerCls}>
          <FooterButton
            label={t('mobile.detail.saveAndReturn')}
            onPress={onSaveAndReturnToReview}
            disabled={!allRequired}
            primary
            flex={1}
          />
        </View>
      );
    }
    return (
      <View className={footerCls}>
        <FooterButton
          label={t('mobile.detail.reviewGroup', { count: queuedCount + 1 })}
          onPress={onReviewGroup}
          disabled={!allRequired}
          flex={1}
        />
        <FooterButton
          label={t('mobile.detail.addAnother')}
          onPress={onAddAnother}
          disabled={!allRequired}
          primary
          flex={2}
        />
      </View>
    );
  }

  return (
    <View className={footerCls}>
      <FooterButton
        label={t('mobile.detail.preview', { defaultValue: 'Preview' })}
        onPress={() =>
          Alert.alert(
            t('mobile.detail.preview', { defaultValue: 'Preview' }),
            t('mobile.detail.previewSoon', {
              defaultValue: 'Listing preview is coming soon.',
            }),
          )
        }
        flex={1}
      />
      <FooterButton
        label={t('mobile.detail.submitListing')}
        onPress={onSubmitSingle}
        disabled={!allRequired}
        loading={submitting}
        primary
        icon="arrow-forward"
        flex={2}
      />
    </View>
  );
}
