import { describe, it, expect, jest } from '@jest/globals';

// turnFold.ts imports `@/i18n`, which pulls in MMKV (native module, unavailable
// under plain jest) — mock it the same way frameReplay.characterization.test.ts
// does, since `computeLatestDraft` itself never touches i18n.
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

// Follow-up #3 — BUY-mode chat sessions stream a `wtb_draft` card (not
// `listing_draft`), but `computeLatestDraft` only matched `listing_draft` in
// both the live-cards scan and the committed-messages scan. That meant
// `chat.latestDraft` never populated for buy requests, so the "Save as draft"
// button (Task 17, gated on `draftsEnabled() && chat.latestDraft` in
// app/(lab)/chat.tsx) never appeared for buy-mode. Fix: match BOTH
// `listing_draft` and `wtb_draft` in both scans. This locks that contract
// without needing the full chat screen/controller stack.
import { computeLatestDraft } from '../turnFold';
import { textContent, type Message } from '../../types/message';

describe('computeLatestDraft — buy-mode wtb_draft support', () => {
  it('a live wtb_draft card yields a non-null latestDraft', () => {
    const live = [{ type: 'wtb_draft', data: { from: 'live-wtb' } }];
    expect(computeLatestDraft(live, [])).toEqual({ from: 'live-wtb' });
  });

  it('a live listing_draft card still yields a non-null latestDraft (no regression)', () => {
    const live = [{ type: 'listing_draft', data: { from: 'live-listing' } }];
    expect(computeLatestDraft(live, [])).toEqual({ from: 'live-listing' });
  });

  it('a committed wtb_draft card (no live card) yields a non-null latestDraft', () => {
    const messages: Message[] = [
      {
        id: 'b',
        role: 'assistant',
        createdAt: 0,
        reason: 'complete',
        content: textContent(''),
        cards: [{ type: 'wtb_draft', data: { from: 'history-wtb' } }],
      },
    ];
    expect(computeLatestDraft([], messages)).toEqual({ from: 'history-wtb' });
  });

  it('a committed listing_draft card still yields a non-null latestDraft (no regression)', () => {
    const messages: Message[] = [
      {
        id: 'b',
        role: 'assistant',
        createdAt: 0,
        reason: 'complete',
        content: textContent(''),
        cards: [{ type: 'listing_draft', data: { from: 'history-listing' } }],
      },
    ];
    expect(computeLatestDraft([], messages)).toEqual({ from: 'history-listing' });
  });

  it('no draft card anywhere (live or committed) yields null', () => {
    const messages: Message[] = [
      {
        id: 'b',
        role: 'assistant',
        createdAt: 0,
        reason: 'complete',
        content: textContent(''),
        cards: [{ type: 'product_list', data: {} }],
      },
    ];
    expect(computeLatestDraft([], messages)).toBeNull();
    expect(computeLatestDraft([], [])).toBeNull();
  });
});
