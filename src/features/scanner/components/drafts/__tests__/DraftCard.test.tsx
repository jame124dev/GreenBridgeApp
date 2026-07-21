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
  it('renders the title and fires onResume', () => {
    const onResume = jest.fn();
    const { getByText } = render(
      <DraftCard draft={draft} onResume={onResume} onDelete={() => {}} />,
    );
    expect(getByText('Vacuum Pump')).toBeTruthy();
    fireEvent.press(getByText(/continue/i));
    expect(onResume).toHaveBeenCalled();
  });

  it('fires onDelete when the delete action is pressed', () => {
    const onDelete = jest.fn();
    const { getByText } = render(
      <DraftCard draft={draft} onResume={() => {}} onDelete={onDelete} />,
    );
    fireEvent.press(getByText(/delete/i));
    expect(onDelete).toHaveBeenCalled();
  });
});
