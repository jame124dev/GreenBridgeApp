import { describe, it, expect } from '@jest/globals';

import type {
  Message,
  Conversation,
  ActiveTurn,
  Effect,
  Card,
  ContentPart,
  Command,
  TransportSignal,
} from '../index';

// PR-1: validates the domain-type barrel resolves and the A2/A3/A4 shapes are
// constructible. `satisfies` keeps the sample values at runtime (so this is a
// real test) while type-checking their shape at compile time (tsc --noEmit).
// These types are otherwise UNUSED by production — this test is the only
// consumer until the migration PRs.

describe('chat domain type contracts', () => {
  it('Message (A2 §12) is constructible with reason + content parts', () => {
    const textPart = { kind: 'text', text: 'Here is what I found.' } satisfies ContentPart;
    const card = { type: 'listing_draft', data: { title: 'X' } } satisfies Card;
    const msg = {
      id: 'bot-1',
      role: 'assistant',
      createdAt: 0,
      content: [textPart],
      cards: [card],
      sources: ['search_marketplace'],
      reason: 'complete',
    } satisfies Message;

    expect(msg.role).toBe('assistant');
    expect(msg.content[0].text).toBe('Here is what I found.');
    expect(msg.cards?.[0].type).toBe('listing_draft');
    expect(msg.reason).toBe('complete');
  });

  it('Conversation (A2 §13) holds an append-only message list', () => {
    const convo = {
      id: 'conv-1',
      messages: [],
      createdAt: 0,
      updatedAt: 0,
      lifecycle: 'active',
    } satisfies Conversation;
    expect(convo.lifecycle).toBe('active');
    expect(convo.messages).toHaveLength(0);
  });

  it('ActiveTurn (A2 §12) uses ProtocolState + raw buffer', () => {
    const turn = {
      state: 'STREAMING',
      buffer: 'Hello',
      cards: [],
      phase: 'ai_running',
    } satisfies ActiveTurn;
    expect(turn.state).toBe('STREAMING');
    expect(turn.buffer).toBe('Hello');
  });

  it('Effect (A2 §7.2/§9) covers every reducer effect kind', () => {
    const effects: Effect[] = [
      { kind: 'commit', reason: 'interrupted' },
      { kind: 'reset' },
      { kind: 'cancelPost' },
      { kind: 'haptic', of: 'error' },
    ];
    expect(effects.map((e) => e.kind)).toEqual(['commit', 'reset', 'cancelPost', 'haptic']);
  });

  it('reducer inputs (A2 §9.1) — Command and TransportSignal are constructible', () => {
    const start = { type: 'START', text: 'hi' } satisfies Command;
    const cancel = { type: 'CANCEL' } satisfies Command;
    const fail = { type: 'TRANSPORT_FAILURE', code: 'connection_lost', retriable: true } satisfies TransportSignal;
    expect(start.type).toBe('START');
    expect(cancel.type).toBe('CANCEL');
    expect(fail.retriable).toBe(true);
  });
});
