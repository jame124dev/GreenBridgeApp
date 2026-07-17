import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';

import { createRenderTracker } from '@/test-utils/renderCounter';

// PR-8: proves the unified render path (A4 §2.1/§12.7) — StreamingMessage and the
// committed ChatMessage render the SAME AssistantMessage subtree, and a token
// burst re-renders ONLY the streaming leaf (A2 I10 / A4 §4 render isolation).
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
    useReducedMotion: () => false,
    // R3 glow primitives (StreamingMessage calls these unconditionally, before
    // the CHAT_UI_V2 gate — stub them so the flag-off render path works).
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    cancelAnimation: () => undefined,
  };
});
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});
jest.mock('@/animations/recipes', () => ({ usePop: () => undefined }));
jest.mock('@/features/lab/chat/ThinkingDots', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return { ThinkingDots: () => React_.createElement(View, { testID: 'thinking-dots' }) };
});
jest.mock('@/features/lab/chat/cardKit', () => ({ toolLabel: (n: string) => n }));
jest.mock('@/features/lab/chat/cards', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return { GhostButton: () => null, renderCard: (type: string) => React_.createElement(View, { testID: `card-${type}` }) };
});
jest.mock('@/components/ui', () => {
  const React_ = require('react');
  const { Image } = require('react-native');
  return { AppImage: (props: object) => React_.createElement(Image, props) };
});
// Reveal instantly so assertions are deterministic (no timer-driven reveal).
jest.mock('@/features/lab/chat/hooks/useStreamReveal', () => ({ useStreamReveal: (text: string) => text }));

import { useThread } from '@/features/lab/stores/threadStore';
import { StreamingMessage } from '../StreamingMessage';
import { ChatMessage } from '../ChatMessage';
import { ChatThemeProvider } from '../theme';

const noop = () => {};
const stream = (
  <ChatThemeProvider>
    <StreamingMessage mode="buyer" onSend={noop} />
  </ChatThemeProvider>
);

beforeEach(() => useThread.getState().reset());

describe('StreamingMessage (PR-8 unified render path)', () => {
  it('renders nothing when no turn is streaming', () => {
    const { toJSON } = render(stream);
    expect(toJSON()).toBeNull();
  });

  it('renders thinking dots pre-first-token, then the revealed prose + cards', () => {
    useThread.getState().startTurn();
    const { getByTestId, rerender } = render(stream);
    expect(getByTestId('thinking-dots')).toBeTruthy(); // no text, no cards yet

    useThread.getState().applyFrame({ type: 'token', delta: 'Hello there' });
    useThread.getState().applyFrame({ type: 'data', data: { type: 'product_list', data: {} } });
    rerender(stream);
    const { getByText, getByTestId: byId } = render(stream);
    expect(getByText('Hello there')).toBeTruthy();
    expect(byId('card-product_list')).toBeTruthy();
  });

  it('G3: once result cards land pre-token, the label says summarizing, not searching', () => {
    useThread.getState().startTurn();
    useThread.getState().applyFrame({ type: 'data', data: { type: 'product_list', data: {} } });
    const { getByText, queryByText } = render(stream);
    // The i18n mock returns the raw key — assert the RESOLVED key flipped from
    // the search copy to the summarizing copy (glitch-audit G3).
    expect(getByText('mobile.labChat.working.summarizing')).toBeTruthy();
    expect(queryByText('mobile.labChat.working.searching')).toBeNull();
  });

  it('G3: a held DRAFT card gets the preparing-draft label', () => {
    useThread.getState().startTurn();
    useThread.getState().applyFrame({ type: 'data', data: { type: 'wtb_draft', data: {} } });
    const { getByText } = render(stream);
    expect(getByText('mobile.labChat.working.draft')).toBeTruthy();
  });

  it('an early data card before the first token keeps the thinking slot above the card (ordering fix)', () => {
    useThread.getState().startTurn();
    // A card arrives as an early `data` frame BEFORE any text token.
    useThread.getState().applyFrame({ type: 'data', data: { type: 'product_list', data: {} } });
    const { getByTestId } = render(stream);
    // The reserved streaming slot still shows the thinking dots (top bubble) even
    // though a card already exists — so the card can never render above the text.
    expect(getByTestId('thinking-dots')).toBeTruthy();
    expect(getByTestId('card-product_list')).toBeTruthy();
  });

  it('holds a DRAFT card until the intro text begins, then reveals it (artifact reveal)', () => {
    useThread.getState().startTurn();
    // A WTB draft card streams in BEFORE any text token.
    useThread.getState().applyFrame({ type: 'data', data: { type: 'wtb_draft', data: {} } });
    const held = render(stream);
    // While there is no text yet, the draft card is HELD (only the thinking slot
    // shows) so it slides in beneath the intro rather than popping in first.
    expect(held.getByTestId('thinking-dots')).toBeTruthy();
    expect(held.queryByTestId('card-wtb_draft')).toBeNull();

    // Once the intro text arrives, the draft card is revealed (below the text).
    useThread.getState().applyFrame({ type: 'token', delta: "Here's a draft" });
    const shown = render(stream);
    expect(shown.getByText("Here's a draft")).toBeTruthy();
    expect(shown.getByTestId('card-wtb_draft')).toBeTruthy();
  });

  it('streaming and committed render the SAME subtree for identical content (parity)', () => {
    // Committed assistant message with the same text + card.
    const committed = render(
      <ChatThemeProvider>
        <ChatMessage
          msg={{
            id: 'a',
            role: 'assistant',
            createdAt: 0,
            reason: 'complete',
            content: [{ kind: 'text', text: 'Same body' }],
            cards: [{ type: 'product_list', data: {} }],
          }}
          mode="buyer"
          onSend={noop}
          onRetry={noop}
        />
      </ChatThemeProvider>,
    );
    useThread.getState().startTurn();
    useThread.getState().applyFrame({ type: 'token', delta: 'Same body' });
    useThread.getState().applyFrame({ type: 'data', data: { type: 'product_list', data: {} } });
    const streaming = render(stream);

    // Both surface the same prose + the same card renderer.
    expect(committed.getByText('Same body')).toBeTruthy();
    expect(streaming.getByText('Same body')).toBeTruthy();
    expect(committed.getByTestId('card-product_list')).toBeTruthy();
    expect(streaming.getByTestId('card-product_list')).toBeTruthy();
  });

  it('holds a partial code fence — no chrome, raw backticks, or growing language label (D2)', () => {
    useThread.getState().startTurn();
    useThread.getState().applyFrame({ type: 'token', delta: 'Here is code:\n' });
    useThread.getState().applyFrame({ type: 'token', delta: '``' });
    const partial = render(stream);
    expect(partial.queryByText(/`/)).toBeNull(); // backtick run held whole
    partial.unmount();

    useThread.getState().applyFrame({ type: 'token', delta: '`py' });
    const typingLang = render(stream);
    expect(typingLang.queryByText(/`/)).toBeNull();
    expect(typingLang.queryByText('py')).toBeNull(); // no partial language label
    typingLang.unmount();

    // The opener's newline releases it — CodeBlock mounts once, full label.
    useThread.getState().applyFrame({ type: 'token', delta: 'thon\n' });
    const mounted = render(stream);
    expect(mounted.getByText('python')).toBeTruthy();
  });

  it('never paints the draft field-dump prose mid-stream (D4)', () => {
    useThread.getState().startTurn();
    useThread.getState().applyFrame({ type: 'data', data: { type: 'wtb_draft', data: {} } });
    useThread.getState().applyFrame({ type: 'token', delta: 'Draft ready.\n' });
    // The "- **Camera:** 12MP" bullet arrives in character groups; at EVERY step
    // it is either held (unclosed bold) or already stripped (label closed).
    for (const delta of ['- ', '**Cam', 'era', ':**', ' 12MP']) {
      useThread.getState().applyFrame({ type: 'token', delta });
      const r = render(stream);
      expect(r.queryByText(/Camera/)).toBeNull();
      expect(r.queryByText(/\*\*/)).toBeNull();
      r.unmount();
    }
  });

  it('holds an in-flight save prompt next to a draft card (held-then-stripped, never visible)', () => {
    useThread.getState().startTurn();
    useThread.getState().applyFrame({ type: 'data', data: { type: 'wtb_draft', data: {} } });
    useThread.getState().applyFrame({ type: 'token', delta: 'Draft ready. Would you like to sa' });
    const r = render(stream);
    expect(r.queryByText(/Would you like/)).toBeNull();
    expect(r.getByText(/Draft ready\./)).toBeTruthy();
  });

  it('stays mounted through the done window, unmounts only on reset (D3 handoff)', () => {
    useThread.getState().startTurn();
    useThread.getState().applyFrame({ type: 'token', delta: 'Hello' });
    // Terminal frame with NO controller mounted → the commit/reset effects stay
    // pending, so the turn sits in the done window. The leaf must keep rendering
    // (no blank gap frame between the stream and the committed row).
    useThread.getState().applyFrame({ type: 'done', data: {} });
    const done = render(stream);
    expect(done.getByText('Hello')).toBeTruthy();
    done.unmount();

    useThread.getState().reset();
    const idle = render(stream);
    expect(idle.toJSON()).toBeNull();
  });

  it('a token burst re-renders only the streaming leaf, not a committed message (A2 I10)', () => {
    const tracker = createRenderTracker();
    const committedMsg = {
      id: 'c',
      role: 'assistant' as const,
      createdAt: 0,
      reason: 'complete' as const,
      content: [{ kind: 'text' as const, text: 'Committed' }],
    };
    const Committed = React.memo(function Committed() {
      return (
        <tracker.Tracker>
          <ChatMessage msg={committedMsg} mode="buyer" onSend={noop} onRetry={noop} />
        </tracker.Tracker>
      );
    });

    useThread.getState().startTurn();
    const { rerender } = render(
      <ChatThemeProvider>
        <Committed />
        <StreamingMessage mode="buyer" onSend={noop} />
      </ChatThemeProvider>,
    );
    expect(tracker.renders).toBe(1);

    // Burst tokens through the store (what the transport does per SSE frame).
    for (const d of ['a', 'b', 'c', 'd', 'e']) {
      useThread.getState().applyFrame({ type: 'token', delta: d });
    }
    rerender(
      <ChatThemeProvider>
        <Committed />
        <StreamingMessage mode="buyer" onSend={noop} />
      </ChatThemeProvider>,
    );
    // Committed memoized boundary did NOT re-render on the token burst.
    expect(tracker.renders).toBe(1);
  });
});
