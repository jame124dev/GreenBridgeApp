import React, { useState } from 'react';
import { describe, it, expect } from '@jest/globals';
import { Text, Pressable } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { createRenderTracker } from '@/test-utils/renderCounter';

import { ChatThemeProvider, useColor } from '../index';

// PR-2 acceptance (refinement #3): mounting ChatThemeProvider must introduce NO
// additional renders. Uses the PR-0 render-counter utility.

describe('ChatThemeProvider — render neutrality', () => {
  it('renders children exactly once on mount (no extra render from the provider)', () => {
    const tracker = createRenderTracker();
    render(
      <ChatThemeProvider>
        <tracker.Tracker>
          <Text>child</Text>
        </tracker.Tracker>
      </ChatThemeProvider>,
    );
    expect(tracker.renders).toBe(1);
  });

  it('a host re-render does not re-render a memoized context consumer (stable theme)', () => {
    const tracker = createRenderTracker();

    const Consumer = React.memo(function Consumer() {
      const accent = useColor('accent'); // reads theme context
      return (
        <tracker.Tracker>
          <Text>{accent}</Text>
        </tracker.Tracker>
      );
    });

    function Host() {
      const [n, setN] = useState(0);
      return (
        <ChatThemeProvider>
          <Pressable accessibilityRole="button" onPress={() => setN((v) => v + 1)}>
            <Text>tick {n}</Text>
          </Pressable>
          <Consumer />
        </ChatThemeProvider>
      );
    }

    const { getByText } = render(<Host />);
    expect(tracker.renders).toBe(1);

    // Host (and thus the provider element) re-renders; the theme value is a
    // stable frozen singleton, so the memoized Consumer must NOT re-render.
    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1);
  });
});
