import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { RequiredProgressStrip } from '@/features/scanner/components/detail/RequiredProgressStrip';
import type { RequiredStatus } from '@/features/scanner/requiredStatus';

const allDone: RequiredStatus['rows'] = {
  photos: true,
  title: true,
  description: true,
  category: true,
  condition: true,
  price: true,
  location: true,
};

describe('RequiredProgressStrip', () => {
  it('names every missing row and fires onPressRow for the tapped one', () => {
    const onPressRow = jest.fn();
    const { getByText } = render(
      <RequiredProgressStrip
        rows={{ ...allDone, title: false, price: false }}
        doneCount={5}
        total={7}
        onPressRow={onPressRow}
      />,
    );
    // Labels come from `useRequiredRowLabel`; react-i18next is uninitialised under
    // Jest, so `t` returns the English defaultValue.
    expect(getByText('Title')).toBeTruthy();
    fireEvent.press(getByText('Price'));
    expect(onPressRow).toHaveBeenCalledWith('price');
  });

  it('renders nothing once every row passes', () => {
    const { toJSON } = render(
      <RequiredProgressStrip rows={allDone} doneCount={7} total={7} onPressRow={() => {}} />,
    );
    expect(toJSON()).toBeNull();
  });
});
