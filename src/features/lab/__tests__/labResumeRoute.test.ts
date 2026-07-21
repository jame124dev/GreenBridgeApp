// src/features/lab/__tests__/labResumeRoute.test.ts
//
// Task 13 scope change: ALL drafts (seller + lab) carry a top-level
// `mode: 'single'|'multi'` (Task 2) — the lab sell/buy distinction only lives
// in the FETCHED `payload.mode` (stamped by `buildLabDraftPayload`, Task 6/12).
// `isLabDraft` must inspect the resolved `DraftDetail.payload`, never the
// summary's top-level `mode`, so it only works after `getDraft(id)` — which is
// exactly what `app/scan/drafts.tsx`'s `onResume` already calls.
import { describe, it, expect } from '@jest/globals';
import { isLabDraft, labResumeRoute } from '@/features/lab/labResumeRoute';

describe('labResumeRoute', () => {
  it('isLabDraft is true for a sell-mode lab payload', () => {
    expect(isLabDraft({ payload: { kind: 'form-blob', mode: 'sell', labDraft: {} } })).toBe(true);
  });

  it('isLabDraft is true for a buy-mode lab payload', () => {
    expect(isLabDraft({ payload: { kind: 'form-blob', mode: 'buy', labDraft: {} } })).toBe(true);
  });

  it('isLabDraft is false for a seller form-blob payload (no sell/buy mode)', () => {
    expect(
      isLabDraft({ payload: { kind: 'form-blob', persistedScan: {}, imagesOrdered: [] } }),
    ).toBe(false);
  });

  it('isLabDraft is false for a pending-ai (background recognition) payload', () => {
    expect(
      isLabDraft({
        payload: { kind: 'pending-ai', result: {}, imagesOrdered: [], language: 'en', mode: 'single' },
      }),
    ).toBe(false);
  });

  it('isLabDraft is false for a pending-ai payload even if mode happens to be sell/buy', () => {
    // PendingAiPayload['mode'] is typed 'single'|'multi'|'sell'|'buy' for
    // forward-compat (no lab background-recognition caller sets it today —
    // Task 13 explicitly drops lab background as out of scope), but the
    // `kind` guard must win over the mode check regardless.
    expect(
      isLabDraft({
        payload: { kind: 'pending-ai', result: {}, imagesOrdered: [], language: 'en', mode: 'sell' },
      }),
    ).toBe(false);
  });

  it('isLabDraft is false when payload is missing', () => {
    expect(isLabDraft({})).toBe(false);
    expect(isLabDraft({ payload: undefined })).toBe(false);
  });

  it('labResumeRoute returns the lab draft screen route', () => {
    expect(labResumeRoute()).toBe('/(lab)/draft');
  });
});
