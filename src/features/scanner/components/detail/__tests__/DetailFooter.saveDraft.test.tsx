import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/lib/flags', () => ({ draftsEnabled: () => true, SMART_DETECT_ENABLED: true }));
// The footer reads the seller-approval state to label/enable its submit CTA.
// Mocked at this seam because the real hook reaches the axios client, which
// imports MMKV — a Nitro native module with no jest binary. Approved here, so
// this suite keeps testing the save-draft button and nothing else.
jest.mock('@/features/seller/useSellerUpgrade', () => ({ useCanSell: () => true }));
jest.mock('@/features/seller/components/SellerApprovalNotice', () => ({
  useSubmitCtaLabel: (fallback: string) => fallback,
  SellerApprovalNotice: () => null,
}));

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { V2ThemeProvider } from '@/theme/v2';
import { DetailFooter } from '@/features/scanner/components/detail/DetailFooter';

describe('DetailFooter — Save as draft', () => {
  it('fires onSaveDraft when the save button is pressed', () => {
    const onSaveDraft = jest.fn();
    // `V2ThemeProvider` is required — the footer's buttons are the kit's
    // `PrimaryAction`, and `useV2Theme` throws without a provider rather than
    // falling back. See the fuller note in `DetailFooter.required.test.tsx`.
    const { getByText } = render(
      // `SafeAreaProvider` too: the footer reads `useSafeAreaInsets()` to clear
      // the Android navigation bar, and that hook throws without a provider.
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 400, height: 800 },
          insets: { top: 24, left: 0, right: 0, bottom: 48 },
        }}
      >
      <V2ThemeProvider initialPreference="light">
        <DetailFooter
          isGrouped={false}
          editingGroupedItem={false}
          queuedCount={0}
          allRequired
          submitting={false}
          onSubmitSingle={() => {}}
          onAddAnother={() => {}}
          onReviewGroup={() => {}}
          onSaveAndReturnToReview={() => {}}
          onSaveDraft={onSaveDraft}
          savingDraft={false}
        />
      </V2ThemeProvider>
      </SafeAreaProvider>,
    );
    fireEvent.press(getByText(/save as draft/i));
    expect(onSaveDraft).toHaveBeenCalled();
  });
});
