/**
 * The tab row must actually move the pager.
 *
 * Found on device 2026-09-15 by pressing a SECOND control on 6a: tapping
 * `Buying` moved the tab indicator and left the pane on Selling. `TabView`
 * reads `navigationState.index` once, to seed its own state, and ignores it
 * afterwards — so the half of the screen rendered from `page` moved and the
 * half owned by the library did not. The failure is invisible to a screenshot
 * of the tab row, which is exactly why it survived.
 *
 * These tests assert the imperative contract instead of the rendered output:
 * a `page` change from OUTSIDE must reach `jumpTo`, and a swipe must NOT —
 * the swipe has already moved the carousel, and jumping it again re-animates
 * the pane under the finger.
 *
 * `reanimated-tab-view` is mocked because the real one needs layout, a
 * gesture handler and worklets; none of that is what broke.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

const mockJumpTo = jest.fn();
/** Captures the props TabView was last rendered with. */
const mockSeen: { onIndexChange?: (n: number) => void; index?: number } = {};

jest.mock('reanimated-tab-view', () => {
  const RealReact = jest.requireActual<typeof import('react')>('react');
  return {
    TabView: RealReact.forwardRef(
      (
        props: { navigationState: { index: number }; onIndexChange: (n: number) => void },
        ref: React.Ref<{ jumpTo: (k: string) => void }>,
      ) => {
        mockSeen.onIndexChange = props.onIndexChange;
        mockSeen.index = props.navigationState.index;
        RealReact.useImperativeHandle(ref, () => ({ jumpTo: mockJumpTo }), []);
        return null;
      },
    ),
  };
});

import { HomePager } from '../HomePager';

const PANES = [<Text key="a">selling</Text>, <Text key="b">buying</Text>];

beforeEach(() => {
  mockJumpTo.mockClear();
});

describe('HomePager', () => {
  it('jumps the pager when the tab row changes the page', () => {
    const { rerender } = render(
      <HomePager page={0} onPageChange={jest.fn()}>
        {PANES}
      </HomePager>,
    );
    // Mounting must not jump — TabView already seeds itself from index 0.
    expect(mockJumpTo).not.toHaveBeenCalled();

    rerender(
      <HomePager page={1} onPageChange={jest.fn()}>
        {PANES}
      </HomePager>,
    );
    // By ROUTE KEY, not index: `jumpTo` takes the key, and passing the number
    // silently does nothing rather than throwing.
    expect(mockJumpTo).toHaveBeenCalledWith('buying');
  });

  it('jumps on MOUNT when it opens on a page other than the first', () => {
    // `/v2/buying` redirects to `/v2?mode=buying`, so Home mounts with page 1
    // already set. TabView starts its carousel on the first route regardless,
    // so without this the tab row says Buying and the pane shows Selling.
    render(
      <HomePager page={1} onPageChange={jest.fn()}>
        {PANES}
      </HomePager>,
    );
    expect(mockJumpTo).toHaveBeenCalledWith('buying');
  });

  it('does NOT jump when the swipe reports the change', () => {
    const onPageChange = jest.fn();
    const { rerender } = render(
      <HomePager page={0} onPageChange={onPageChange}>
        {PANES}
      </HomePager>,
    );

    // The carousel announces the swipe it has already performed...
    mockSeen.onIndexChange?.(1);
    expect(onPageChange).toHaveBeenCalledWith(1);

    // ...and the parent re-renders with the new page. The pager is already
    // there, so re-jumping it would replay the animation under the finger.
    rerender(
      <HomePager page={1} onPageChange={onPageChange}>
        {PANES}
      </HomePager>,
    );
    expect(mockJumpTo).not.toHaveBeenCalled();
  });

  it('still jumps on a tab press that follows a swipe', () => {
    const onPageChange = jest.fn();
    const { rerender } = render(
      <HomePager page={0} onPageChange={onPageChange}>
        {PANES}
      </HomePager>,
    );
    mockSeen.onIndexChange?.(1);
    rerender(
      <HomePager page={1} onPageChange={onPageChange}>
        {PANES}
      </HomePager>,
    );

    // The guard records where the pager is, so it must not latch: pressing
    // `Selling` after swiping to `Buying` has to be honoured.
    rerender(
      <HomePager page={0} onPageChange={onPageChange}>
        {PANES}
      </HomePager>,
    );
    expect(mockJumpTo).toHaveBeenCalledWith('selling');
  });
});
