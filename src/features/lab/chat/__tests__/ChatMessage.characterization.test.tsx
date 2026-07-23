import React, { useState } from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { Pressable, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { buildUserMessage, buildBotMessage, buildErrorMessage, buildCard } from '@/test-utils/builders';
import { createRenderTracker } from '@/test-utils/renderCounter';

// ── Environment mocks (things that can't run natively under Jest) ─────────────
// Per the PR-0 refinement: stub animation-heavy leaves rather than execute
// animations under Jest. We baseline STRUCTURE + BEHAVIOR, not animation fidelity.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}));
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const makeChain = () => {
    const fn = () => makeChain();
    return new Proxy(fn, { get: () => makeChain() });
  };
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: (c: unknown) => c },
    FadeIn: makeChain(),
    FadeOut: makeChain(),
    useReducedMotion: () => false,
  };
});
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});
// Animation-heavy / heavy-dependency leaves stubbed to structural markers.
jest.mock('@/animations/recipes', () => ({ usePop: () => undefined, useRise: () => undefined }));
jest.mock('@/features/lab/chat/ThinkingDots', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return { ThinkingDots: () => React_.createElement(View, { testID: 'thinking-dots' }) };
});
jest.mock('@/features/lab/chat/cardKit', () => ({ toolLabel: (n: string) => n }));
jest.mock('@/features/lab/chat/cards', () => {
  const React_ = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    GhostButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React_.createElement(Pressable, { onPress, accessibilityRole: 'button' }, React_.createElement(Text, null, label)),
    renderCard: (type: string) => React_.createElement(View, { testID: `card-${type}` }),
  };
});
jest.mock('@/components/ui', () => {
  const React_ = require('react');
  const { Image } = require('react-native');
  return { AppImage: (props: object) => React_.createElement(Image, props) };
});

// Import AFTER mocks so ChatMessage's module graph resolves against the stubs.
// Import AFTER mocks so ChatMessage's module graph resolves against the stubs.
import { ChatMessage, MarkdownLite, stripDraftFieldDump, parseBlocks } from '../ChatMessage';
import { ChatThemeProvider } from '../theme';

const noop = () => {};

function renderMessage(msg: Parameters<typeof ChatMessage>[0]['msg'], extra?: { onRetry?: () => void }) {
  return render(
    <ChatMessage msg={msg} mode="buyer" onSend={noop} onRetry={extra?.onRetry ?? noop} />,
  );
}

// ── Golden structural snapshots (small, regression detection only) ────────────
describe('ChatMessage — golden structure', () => {
  it('user message', () => {
    expect(renderMessage(buildUserMessage()).toJSON()).toMatchSnapshot();
  });

  it('bot markdown message', () => {
    expect(
      renderMessage(
        buildBotMessage({ text: 'Here is a **bold** word.\n- item one\n[Google](https://g.com)' }),
      ).toJSON(),
    ).toMatchSnapshot();
  });

  it('error message', () => {
    expect(renderMessage(buildErrorMessage()).toJSON()).toMatchSnapshot();
  });
});

// ── Behavior (preferred over large snapshots per PR-0 refinement) ─────────────
describe('ChatMessage — behavior', () => {
  it('renders the user text', () => {
    const { getByText } = renderMessage(buildUserMessage({ text: 'Need a lathe' }));
    expect(getByText('Need a lathe')).toBeTruthy();
  });

  it('renders markdown bold, bullet, and link label as text', () => {
    const { getByText } = renderMessage(
      buildBotMessage({ text: 'A **strong** point.\n- first item\n[Docs](https://x)' }),
    );
    expect(getByText('strong')).toBeTruthy();
    expect(getByText('first item')).toBeTruthy();
    expect(getByText('Docs')).toBeTruthy(); // label, never the raw URL
  });

  it('renders nothing for a committed bot message with no text and no cards', () => {
    // A settled bot message that ended up empty (e.g. a gap-filler save whose
    // card got collapsed away) is a superseded placeholder — it must NOT paint
    // a frozen "AI is working" thinking bubble in history. The live thinking
    // indicator belongs to StreamingMessage (the streaming leaf), not here.
    const { queryByTestId } = renderMessage(buildBotMessage({ text: '' }));
    expect(queryByTestId('thinking-dots')).toBeNull();
  });

  it('dispatches a card to renderCard by type', () => {
    const { getByTestId } = renderMessage(
      buildBotMessage({ text: 'Draft ready.', cards: [buildCard('listing_draft', { title: 'X' })] }),
    );
    expect(getByTestId('card-listing_draft')).toBeTruthy();
  });

  it('renders the sources strip from sources', () => {
    const { getByText } = renderMessage(
      buildBotMessage({ text: 'Found it.', sources: ['search_marketplace'] }),
    );
    expect(getByText('search_marketplace')).toBeTruthy();
  });

  it('fires onRetry with the original text from an error message', () => {
    const onRetry = jest.fn();
    const { getByText } = renderMessage(
      buildErrorMessage({ retry: 'redo this' }),
      { onRetry },
    );
    fireEvent.press(getByText('mobile.labCards.retry'));
    expect(onRetry).toHaveBeenCalledWith('redo this');
  });
});

// ── Pure text transforms (cheap, deterministic; guard PR-10/F4 relocation) ────
describe('MarkdownLite / stripDraftFieldDump', () => {
  it('MarkdownLite renders bold + link + bullet without leaking raw syntax', () => {
    const { getByText, queryByText } = render(
      <MarkdownLite text={'A **bold** bit.\n- point\n[Label](https://u)'} />,
    );
    expect(getByText('bold')).toBeTruthy();
    expect(getByText('point')).toBeTruthy();
    expect(getByText('Label')).toBeTruthy();
    expect(queryByText('https://u')).toBeNull();
  });

  it('MarkdownLite parses and renders headings, inline code, and block quotes', () => {
    const { getByText } = render(
      <MarkdownLite text={'# My Heading\nSome `inline code` here.\n> My Quote'} />,
    );
    expect(getByText('My Heading')).toBeTruthy();
    expect(getByText('inline code')).toBeTruthy();
    expect(getByText('My Quote')).toBeTruthy();
  });

  it('parseBlocks splits markdown code fences from prose', () => {
    const blocks = parseBlocks('Some text\n```python\nprint("hello")\n```\nMore text');
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'prose', text: 'Some text' });
    expect(blocks[1]).toEqual({ type: 'code', code: 'print("hello")', language: 'python' });
    expect(blocks[2]).toEqual({ type: 'prose', text: 'More text' });
  });

  it('stripDraftFieldDump drops **Label:** field bullets, keeps opening/closing prose', () => {
    const out = stripDraftFieldDump(
      'Your draft is ready — here are the details:\n- **Title:** Foo\n- **Price:** 100\nPlease add a location to publish.',
    );
    expect(out).not.toContain('**Title:**');
    expect(out).not.toContain('**Price:**');
    expect(out).toContain('Your draft is ready');
    expect(out).toContain('Please add a location to publish.');
  });
});

// PR-3A render-count verification: the StyleSheet→theme-hook migration reads a
// STABLE theme context, so it must add no renders. A memoized message boundary
// mounts once and does NOT re-render when an unrelated host state changes.
describe('ChatMessage — render neutrality (PR-3A)', () => {
  it('mounts once and holds through host re-renders (theme hooks add no renders)', () => {
    const tracker = createRenderTracker();
    const msg = buildBotMessage({ text: 'Here is a result.' });

    // Memoized, prop-less boundary → renders exactly once, then skipped on any
    // parent re-render. The tracker counts that boundary's render passes.
    const Boundary = React.memo(function Boundary() {
      return (
        <tracker.Tracker>
          <ChatMessage msg={msg} mode="buyer" onSend={noop} onRetry={noop} />
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
          <Boundary />
        </ChatThemeProvider>
      );
    }

    const { getByText } = render(<Host />);
    expect(tracker.renders).toBe(1);

    fireEvent.press(getByText(/tick/));
    fireEvent.press(getByText(/tick/));
    expect(tracker.renders).toBe(1); // migrated message did not re-render
  });
});
