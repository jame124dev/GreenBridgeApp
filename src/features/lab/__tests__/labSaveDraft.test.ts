// src/features/lab/__tests__/labSaveDraft.test.ts
// Locks the lab "Save as draft" contract: the shared payload builder
// (`buildLabDraftPayload`, Task 6) must map a live draft frame's title through
// and stamp the lab sell/buy `mode` onto `payload.mode` — that field, NOT the
// top-level `createDraft` `mode` (which only ever accepts 'single'/'multi'),
// is how Task 13 tells lab drafts apart from scan drafts.
import { describe, it, expect } from '@jest/globals';
import { buildLabDraftPayload } from '@/services/drafts/draftPayload';

describe('labSaveDraft', () => {
  it('builds a lab draft payload with title + mode', () => {
    const out = buildLabDraftPayload({ title: 'HPLC System' }, 'sell');
    expect(out.title).toBe('HPLC System');
    expect((out.payload as any).mode).toBe('sell');
  });

  it('falls back to a mode-appropriate title when the frame has none', () => {
    const sell = buildLabDraftPayload({}, 'sell');
    const buy = buildLabDraftPayload(undefined, 'buy');
    expect(sell.title).toBe('Untitled listing');
    expect(buy.title).toBe('Buying request');
  });

  it('carries the raw frame through as payload.labDraft', () => {
    const frame = { title: 'GC-MS', specs: [{ k: 'Brand', v: 'Agilent' }] };
    const out = buildLabDraftPayload(frame, 'buy');
    expect((out.payload as any).kind).toBe('form-blob');
    expect((out.payload as any).labDraft).toBe(frame);
  });
});
