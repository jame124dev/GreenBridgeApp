import React, { useState } from 'react';
import { describe, it, expect } from '@jest/globals';
import { Text, Pressable } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { useRenderCount, createRenderTracker } from '../renderCounter';

// Self-test of the render-count utilities so PR-8 can trust them for the
// streaming render-isolation assertion.

describe('useRenderCount', () => {
  it('increments once per render', () => {
    const counts: number[] = [];
    function Probe({ v }: { v: number }) {
      counts.push(useRenderCount());
      return <Text>{v}</Text>;
    }
    const { rerender } = render(<Probe v={1} />);
    rerender(<Probe v={2} />);
    rerender(<Probe v={3} />);
    expect(counts).toEqual([1, 2, 3]);
  });
});

describe('createRenderTracker', () => {
  it('counts renders of the wrapped position and isolates a memoized child', () => {
    const tracker = createRenderTracker();
    const Child = React.memo(function Child() {
      return (
        <tracker.Tracker>
          <Text>child</Text>
        </tracker.Tracker>
      );
    });

    function Parent() {
      const [tick, setTick] = useState(0);
      return (
        <>
          <Pressable accessibilityRole="button" onPress={() => setTick((t) => t + 1)}>
            <Text>tick {tick}</Text>
          </Pressable>
          <Child />
        </>
      );
    }

    const { getByText } = render(<Parent />);
    expect(tracker.renders).toBe(1);

    // Parent re-renders on tick; the memoized Child (no prop change) must not.
    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1);
  });
});
