import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Dimensions, Keyboard, ScrollView, StyleSheet, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

// A real top inset, unlike `Sheet.test.tsx`'s all-zero stub: the top inset is
// half of what bug 1 was about, and a stub of 0 would hide it.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

import { Sheet } from '../Sheet';
import { SHEET_PADDING_BOTTOM, SHEET_TOP_GAP } from '../sheetLayout';

/**
 * The WIRING half of the two sheet layout fixes (2026-08-19 device pass). The
 * arithmetic is proven in `sheetLayout.test.ts`; this file proves the primitive
 * actually applies it — the calculation is worth nothing if the styles still say
 * `{ maxHeight: 520 }`.
 *
 * ⚠️ HONEST LIMITS. No unit test can see a status bar, an IME, or a clipped
 * header. What is proven here is: the numbers reaching the styles are derived
 * from the window and the insets rather than from the prop; a keyboard event
 * moves the card and shrinks the list; and the effect is torn down. What still
 * needs a device is that the header is VISIBLE and the search field is ABOVE the
 * IME — repro steps are in the commit message.
 */
const WINDOW = Dimensions.get('window').height;
const INSET_TOP = 24;
const INSET_BOTTOM = 48;

type Listener = [string, (e: unknown) => void];
let registered: Listener[] = [];
let removed = 0;

beforeEach(() => {
  registered = [];
  removed = 0;
  jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((event: unknown, cb: unknown) => {
      registered.push([String(event), cb as (e: unknown) => void]);
      return { remove: () => { removed += 1; } } as never;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const fire = (re: RegExp, height: number) =>
  act(() => {
    registered
      .filter(([name]) => re.test(name))
      .forEach(([, cb]) => cb({ endCoordinates: { height, screenX: 0, screenY: 0, width: 0 } }));
  });

const showKeyboard = (height: number) => fire(/Show|ChangeFrame/, height);
const hideKeyboard = () => fire(/Hide/, 0);

function renderSheet(maxHeight?: number) {
  const utils = render(
    <Sheet
      visible
      onClose={() => {}}
      title="Select category"
      subtitle="Search, or browse by group"
      maxHeight={maxHeight}
      stickyHeader={<Text>search</Text>}
    >
      <Text>body row</Text>
    </Sheet>,
  );
  const scrollStyle = () =>
    StyleSheet.flatten(utils.UNSAFE_getByType(ScrollView).props.style) as {
      maxHeight?: number;
      flexShrink?: number;
    };
  const cardStyle = () =>
    StyleSheet.flatten(utils.getByTestId('sheet-card').props.style) as {
      maxHeight?: number;
      marginBottom?: number;
      paddingBottom?: number;
    };
  return { ...utils, scrollStyle, cardStyle };
}

describe('FIX 1 — the sheet clamps against the window, not against the prop', () => {
  it('refuses a maxHeight the screen cannot hold', () => {
    const { scrollStyle } = renderSheet(5000);
    const { maxHeight } = scrollStyle();
    expect(maxHeight).toBeLessThan(5000);
    expect(maxHeight).toBeLessThanOrEqual(WINDOW - INSET_TOP - SHEET_TOP_GAP);
  });

  it('caps the CARD too, so the header cannot be pushed off the top', () => {
    const { cardStyle } = renderSheet(5000);
    expect(cardStyle().maxHeight).toBe(WINDOW - INSET_TOP - SHEET_TOP_GAP);
  });

  it('lets the scrollable body shrink, so the chrome wins the space fight', () => {
    // Belt to the arithmetic's braces: with the card capped, `flexShrink` is what
    // makes the list give up space to the title/search/Cancel rather than the
    // card overflowing upwards.
    expect(renderSheet(5000).scrollStyle().flexShrink).toBe(1);
  });

  it('still honours a request that fits', () => {
    expect(renderSheet(120).scrollStyle().maxHeight).toBe(120);
  });

  it('pays the bottom safe-area inset when there is no keyboard', () => {
    expect(renderSheet().cardStyle().paddingBottom).toBe(INSET_BOTTOM);
    expect(renderSheet().cardStyle().marginBottom).toBe(0);
  });
});

describe('FIX 2 — a keyboard lifts the card and shrinks the list', () => {
  it('subscribes to the keyboard while it is open', () => {
    renderSheet();
    expect(registered.length).toBeGreaterThanOrEqual(2);
    expect(registered.some(([n]) => /Show|ChangeFrame/.test(n))).toBe(true);
    expect(registered.some(([n]) => /Hide/.test(n))).toBe(true);
  });

  it('lifts the card by exactly the IME height', () => {
    const { cardStyle } = renderSheet();
    showKeyboard(320);
    expect(cardStyle().marginBottom).toBe(320);
  });

  it('drops the bottom inset while lifted, so there is no dead gap', () => {
    const { cardStyle } = renderSheet();
    showKeyboard(320);
    expect(cardStyle().paddingBottom).toBe(SHEET_PADDING_BOTTOM);
  });

  // ⛔ Both at once. Lifting alone would push the header off the top — bug 1,
  // re-created by the fix for bug 2.
  it('shrinks the body as well as lifting it', () => {
    const { scrollStyle, cardStyle } = renderSheet(5000);
    const before = scrollStyle().maxHeight ?? 0;
    showKeyboard(320);
    expect(scrollStyle().maxHeight).toBeLessThan(before);
    expect(cardStyle().maxHeight).toBe(WINDOW - INSET_TOP - SHEET_TOP_GAP - 320);
  });

  it('puts everything back when the keyboard goes away', () => {
    const { scrollStyle, cardStyle } = renderSheet(5000);
    const before = scrollStyle().maxHeight;
    showKeyboard(320);
    hideKeyboard();
    expect(cardStyle().marginBottom).toBe(0);
    expect(scrollStyle().maxHeight).toBe(before);
    expect(cardStyle().paddingBottom).toBe(INSET_BOTTOM);
  });

  it('removes its listeners on unmount — this is a ~10-consumer primitive', () => {
    const utils = renderSheet();
    const subscribed = registered.length;
    utils.unmount();
    expect(removed).toBe(subscribed);
  });
});
