import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/lib/flags', () => ({ draftsEnabled: () => true, SMART_DETECT_ENABLED: true }));

import { DetailFooter } from '@/features/scanner/components/detail/DetailFooter';

describe('DetailFooter — Save as draft', () => {
  it('fires onSaveDraft when the save button is pressed', () => {
    const onSaveDraft = jest.fn();
    const { getByText } = render(
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
      />,
    );
    fireEvent.press(getByText(/save as draft/i));
    expect(onSaveDraft).toHaveBeenCalled();
  });
});
