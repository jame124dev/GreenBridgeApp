// src/services/drafts/__tests__/draftPayload.test.ts
import { describe, it, expect } from '@jest/globals';
import { pendingAiPayload, buildScanDraftPayload, hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';

describe('draftPayload', () => {
  it('pendingAiPayload stamps kind + carries fields', () => {
    const p = pendingAiPayload({ result: { products: [] }, imagesOrdered: [{ url: 'u', objectName: 'o' }], language: 'en', mode: 'single' });
    expect(p.kind).toBe('pending-ai');
    expect(p.imagesOrdered).toHaveLength(1);
  });

  it('buildScanDraftPayload -> hydrate round-trips the current item title', () => {
    const snapshot: any = { mode: 'single', queuedItems: [], current: { id: 'i1', title: 'Pump', photos: [], productIds: [] }, sessionVisibility: 'public', networkSellers: [] };
    const built = buildScanDraftPayload(snapshot, []);
    expect(built.title).toBe('Pump');
    expect(built.mode).toBe('single');
    const back = hydrateScanDraftFromPayload(built.payload);
    expect(back.current?.title).toBe('Pump');
  });
});
