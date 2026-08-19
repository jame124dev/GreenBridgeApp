import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';

// `Sheet` reads the bottom safe-area inset in the primitive (so all ~10 consumers
// clear an Android 3-button nav bar at once). Same stub as
// `app/(lab)/account/__tests__/delete.test.tsx:10-14`.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

import { Sheet } from '../Sheet';

/**
 * M-2 — the two additive `Sheet` props the category picker needs.
 *
 * Nothing rendered `Sheet` before this file (the four snapshots under `src/` are
 * lab-chat cards, ChatMessage, ThinkingDots and threadStore), so these are the
 * first tests to pin the primitive ~10 sheets are built on. They are here because
 * both changes are otherwise deletable: `stickyHeader` could be dropped from the
 * destructure and only a device would notice, and the header branch could go back
 * to demanding an `onPress` it renders as a tappable no-op.
 *
 * The THIRD change in this step — `keyboardShouldPersistTaps="handled"` on the
 * body scroller — is deliberately NOT here: `fireEvent.press` bypasses the touch
 * responder chain entirely, so a render test passes with or without it. It is
 * pinned as a source assertion in
 * `src/features/scanner/__tests__/categoryPickerWiring.test.ts`, and only a device
 * can confirm the behaviour (Step M2.6 check #1: keyboard up, ONE tap).
 */
describe('Sheet — stickyHeader', () => {
  it('renders the sticky header, and OUTSIDE the scroller so it cannot scroll away', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <Sheet
        visible
        onClose={() => {}}
        title="Select category"
        stickyHeader={<View testID="sticky" />}
      >
        <Text>body row</Text>
      </Sheet>,
    );

    // Present at all — a prop missing from the destructure renders nothing.
    expect(getByTestId('sticky')).toBeTruthy();

    // And not a child of the ScrollView. Placing the search field as the first
    // scrollable CHILD (the CountryPicker pattern) puts it out of reach after one
    // flick over 62 leaves, which is the whole reason this prop exists.
    const scroller = UNSAFE_getByType(ScrollView);
    expect(within(scroller).queryByTestId('sticky')).toBeNull();
  });

  it('is optional — every existing consumer passes nothing and still renders its body', () => {
    const { getByText } = render(
      <Sheet visible onClose={() => {}} title="Select country">
        <Text>body row</Text>
      </Sheet>,
    );
    expect(getByText('body row')).toBeTruthy();
  });
});

describe('Sheet.Option — a header without a handler is inert', () => {
  it('announces itself as a header, is disabled, and swallows the tap', () => {
    const { getByRole, queryByRole } = render(<Sheet.Option header label="LAB INFRASTRUCTURE" />);
    // A section label that reports accessibilityRole="button" promises a tap that
    // does nothing — the "tappable no-op" this change removes.
    const row = getByRole('header');
    expect(queryByRole('button')).toBeNull();
    expect(row).toBeDisabled();
    expect(() => fireEvent.press(row)).not.toThrow();
  });

  it('is still a real button when a handler IS given', () => {
    const onPress = jest.fn();
    const { getByRole, queryByRole } = render(
      <Sheet.Option header label="LAB INFRASTRUCTURE" onPress={onPress} />,
    );
    const row = getByRole('button');
    expect(queryByRole('header')).toBeNull();
    expect(row).toBeEnabled();
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });
});
