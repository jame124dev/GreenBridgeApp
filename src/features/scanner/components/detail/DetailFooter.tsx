import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSubmitCtaLabel } from '@/features/seller/components/SellerApprovalNotice';
import type { RequiredRowKey, RequiredStatus } from '@/features/scanner/requiredStatus';
import { draftsEnabled } from '@/lib/flags';

import { FooterButton } from './FooterButton';
import { RequiredProgressStrip } from './RequiredProgressStrip';

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
  /** Task 8 — AI-scan drafts. Save the in-progress single-mode listing to the
   *  server as a resumable draft. Optional: only rendered (in place of the
   *  Preview button) when `draftsEnabled()` is true AND a handler is passed —
   *  the detail screen omits it entirely when the flag is off. */
  onSaveDraft?: () => void;
  savingDraft?: boolean;
  /** M-8: when provided, the footer renders the sticky required-progress strip
   *  above the buttons. Omit it (grouped-edit's own footer, unit tests) to get
   *  just the buttons — the previous behaviour. */
  required?: RequiredStatus;
  onPressRow?: (key: RequiredRowKey) => void;
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
  onSaveDraft,
  savingDraft,
  required,
  onPressRow,
}: Props) {
  const { t } = useTranslation();
  const submitLabel = useSubmitCtaLabel(t('mobile.detail.submitListing'));

  // Split from the old single `footerCls`: the top border + surface now belong to
  // the wrapper so the required-progress strip sits inside the same pinned block.
  const wrapperCls = 'border-t border-brand-border-strong bg-brand-surface';
  const rowCls = 'flex-row items-center gap-sm px-lg pt-2.5 pb-2.5';

  const actions = (() => {
    if (isGrouped) {
      if (editingGroupedItem) {
        return (
          <FooterButton
            label={t('mobile.detail.saveAndReturn')}
            onPress={onSaveAndReturnToReview}
            disabled={!allRequired}
            primary
            flex={1}
          />
        );
      }
      return (
        <>
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
        </>
      );
    }
    return (
      <>
        {/* When drafts are off there is no second action to offer. The fallback
            here used to be a "Preview" button that only alerted "coming soon" — a
            visible control that does nothing is an App Store Guideline 2.1 (App
            Completeness) rejection risk, so render nothing and let Submit take the
            full width instead. */}
        {draftsEnabled() && onSaveDraft ? (
          <FooterButton
            label={t('mobile.detail.saveDraft', { defaultValue: 'Save as draft' })}
            onPress={onSaveDraft}
            loading={!!savingDraft}
            disabled={!!submitting}
            flex={1}
          />
        ) : null}
        {/* M-9: no longer disabled on missing fields. A flat grey button with no
            reason given (FooterButton.tsx:39-44) was the dead end this phase
            removes; the press now runs `handleSubmit`, which alerts the named
            missing fields, scrolls to the first one and focuses it
            (useDetailController.onInvalid) — the pattern grouped-edit.tsx has used
            since note R-1, where the CTA is likewise never disabled (:243-246).
            Validity is still enforced by `detailSchema` inside handleSubmit, which
            cannot be bypassed, plus an explicit zero-photos guard, so nothing
            invalid can reach the backend. `canPublish` no longer changes the
            enabled state either: an unapproved seller could already press this
            (onSubmitSingle routes them to the seller form) and
            `SellerApprovalNotice` above the footer plus `useSubmitCtaLabel` still
            tell them what will happen.

            NOTE FOR PHASE 4 (integration doc C4): because this button is no
            longer gated on state, `allRequired` now feeds ONLY the grouped-mode
            buttons above. Phase 4's routing gate must therefore NOT be added by
            ANDing `isRoutingResolved(draft)` into `allRequired` — that would be a
            no-op on this path. It goes in `useDetailController` as a
            `missingRouting()` guard beside `missingPhotos()`. See the comment
            there. */}
        <FooterButton
          label={submitLabel}
          onPress={onSubmitSingle}
          disabled={!!submitting}
          loading={submitting}
          primary
          icon="arrow-forward"
          flex={2}
        />
      </>
    );
  })();

  return (
    <View className={wrapperCls}>
      {required && onPressRow ? (
        <RequiredProgressStrip
          rows={required.rows}
          doneCount={required.doneCount}
          total={required.total}
          onPressRow={onPressRow}
        />
      ) : null}
      <View className={rowCls}>{actions}</View>
    </View>
  );
}
