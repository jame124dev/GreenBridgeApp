import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/lib/flags', () => ({ draftsEnabled: () => false, SMART_DETECT_ENABLED: true }));
// Same seam as DetailFooter.saveDraft.test.tsx: the real hook reaches the axios
// client, which imports MMKV (a Nitro module with no jest binary). Approved
// seller here, so `canPublish` is never the reason a button is enabled.
jest.mock('@/features/seller/useSellerUpgrade', () => ({ useCanSell: () => true }));
jest.mock('@/features/seller/components/SellerApprovalNotice', () => ({
  useSubmitCtaLabel: (fallback: string) => fallback,
  SellerApprovalNotice: () => null,
}));

import { DetailFooter } from '@/features/scanner/components/detail/DetailFooter';
import type { RequiredStatus } from '@/features/scanner/requiredStatus';

/**
 * M-8 (the footer says what is missing) and M-9 (Submit answers instead of
 * greying out) were both wired in `DetailFooter`, and both were revertible with a
 * fully green suite before this file existed. The two assertions that matter:
 *
 *   - the single-mode Submit is PRESSABLE while required fields are missing.
 *     Reverting to `disabled={!allRequired}` reinstates the dead grey button
 *     (FooterButton.tsx:41 `#d4d8df`) with no explanation — the exact dead end
 *     Phase 5 exists to remove. `handleSubmit` + the zero-photos guard in
 *     `useDetailController` are what keep an invalid listing off the wire
 *     (covered by useDetailController.submit.test.tsx).
 *   - the strip is actually RENDERED when the screen passes `required` +
 *     `onPressRow`. `RequiredProgressStrip.test.tsx` proves the component works;
 *     this proves the footer mounts it.
 */
const rows = (missing: (keyof RequiredStatus['rows'])[] = []): RequiredStatus['rows'] => {
  const all: RequiredStatus['rows'] = {
    photos: true,
    title: true,
    description: true,
    category: true,
    condition: true,
    price: true,
    location: true,
  };
  for (const k of missing) all[k] = false;
  return all;
};

const incomplete: RequiredStatus = {
  rows: rows(['title', 'price']),
  doneCount: 5,
  total: 7,
  allComplete: false,
};

function renderFooter(overrides: Partial<React.ComponentProps<typeof DetailFooter>> = {}) {
  const props: React.ComponentProps<typeof DetailFooter> = {
    isGrouped: false,
    editingGroupedItem: false,
    queuedCount: 0,
    allRequired: false,
    submitting: false,
    onSubmitSingle: jest.fn(),
    onAddAnother: jest.fn(),
    onReviewGroup: jest.fn(),
    onSaveAndReturnToReview: jest.fn(),
    ...overrides,
  };
  return { ...render(<DetailFooter {...props} />), props };
}

/** The CTA's label is `t('mobile.detail.submitListing')`; react-i18next is
 *  uninitialised under Jest, so a key with no defaultValue comes back as itself. */
const SUBMIT = /submitListing/;

describe('DetailFooter — M-9: Submit answers instead of greying out', () => {
  it('single-mode Submit is enabled and fires while required fields are missing', () => {
    const { getByLabelText, props } = renderFooter({ allRequired: false });
    const submit = getByLabelText(SUBMIT);
    expect(submit.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(submit);
    expect(props.onSubmitSingle).toHaveBeenCalled();
  });

  it('single-mode Submit is disabled ONLY while submitting', () => {
    const { getByLabelText, props } = renderFooter({ allRequired: true, submitting: true });
    const submit = getByLabelText(SUBMIT);
    expect(submit.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit);
    expect(props.onSubmitSingle).not.toHaveBeenCalled();
  });

  // §5.6: the grouped-mode buttons deliberately KEEP their disabled state — the
  // strip above them now names what is missing. Guards against over-correcting.
  it('grouped-mode buttons still require every row', () => {
    const { getByLabelText } = renderFooter({ isGrouped: true, allRequired: false });
    expect(getByLabelText(/addAnother/).props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText(/reviewGroup/).props.accessibilityState.disabled).toBe(true);
  });
});

describe('DetailFooter — M-8: the footer mounts the required-progress strip', () => {
  it('renders a chip per missing row and reports the tapped one', () => {
    const onPressRow = jest.fn();
    const { getByText } = renderFooter({ required: incomplete, onPressRow });
    // Labels come from `useRequiredRowLabel`'s English defaultValues.
    expect(getByText('Title')).toBeTruthy();
    fireEvent.press(getByText('Price'));
    expect(onPressRow).toHaveBeenCalledWith('price');
  });

  it('renders no strip when the screen passes no required status (grouped-edit footer)', () => {
    const { queryByText } = renderFooter({ required: undefined, onPressRow: undefined });
    expect(queryByText('Title')).toBeNull();
  });

  it('renders no chips once every row passes', () => {
    const { queryByText } = renderFooter({
      required: { rows: rows(), doneCount: 7, total: 7, allComplete: true },
      onPressRow: jest.fn(),
      allRequired: true,
    });
    expect(queryByText('Title')).toBeNull();
    expect(queryByText('Price')).toBeNull();
  });
});
