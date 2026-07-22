import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// No i18n provider in the jest env and `mobile.drafts.*` keys don't exist yet
// (Task 15 adds them) — mock react-i18next so `t` just returns the
// defaultValue, matching how the component will actually render once real
// keys land.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  }),
}));

import DraftCard from '@/features/scanner/components/drafts/DraftCard';

const draft: any = {
  id: 'd1',
  title: 'Vacuum Pump',
  flow: 'ai',
  mode: 'single',
  product_count: 1,
  status: 'active',
  updated_at: new Date(0).toISOString(),
};

describe('DraftCard', () => {
  it('renders the title and fires onResume when the card is tapped', () => {
    const onResume = jest.fn();
    // The whole card taps to Resume (mirrors a listing row tapping to detail);
    // it's labelled with the title + "Continue".
    const { getByText, getByLabelText } = render(
      <DraftCard draft={draft} onResume={onResume} onDelete={() => {}} />,
    );
    expect(getByText('Vacuum Pump')).toBeTruthy();
    fireEvent.press(getByLabelText(/vacuum pump/i));
    expect(onResume).toHaveBeenCalled();
  });

  it('fires onDelete when the delete action is pressed', () => {
    const onDelete = jest.fn();
    // Delete is the trash button in the right slot, labelled "Delete".
    const { getByLabelText } = render(
      <DraftCard draft={draft} onResume={() => {}} onDelete={onDelete} />,
    );
    fireEvent.press(getByLabelText(/delete/i));
    expect(onDelete).toHaveBeenCalled();
  });

  it('shows a spinner instead of delete while resuming, and locks when disabled', () => {
    const onResume = jest.fn();
    const onDelete = jest.fn();
    const { queryByLabelText } = render(
      <DraftCard draft={draft} onResume={onResume} onDelete={onDelete} resuming disabled />,
    );
    // While resuming, the delete action is replaced by the spinner.
    expect(queryByLabelText(/delete/i)).toBeNull();
    // The card is disabled → tapping it does nothing.
    const card = queryByLabelText(/vacuum pump/i);
    if (card) fireEvent.press(card);
    expect(onResume).not.toHaveBeenCalled();
  });
});
