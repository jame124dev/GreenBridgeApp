import { describe, it, expect } from '@jest/globals';

import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  CLEARED_CATEGORY_FORM_FIELDS,
  deriveRoutingState,
  isRoutingResolved,
  routingNeedsAsk,
  routingWhyLine,
  shouldPrefillCategory,
  signalFromAiResult,
  signalFromDraft,
  signalFromSmartFields,
  type RoutingSignal,
} from '../routing/routingState';
import type { AiResult, DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';
import type { SmartItemFields } from '@/features/scanner/smartDetectionTypes';

const ALL: MarketplaceKey[] = ['101lab', '101machine', '101it', '101recycle'];

const clean: RoutingSignal = {
  suggestedMarketplace: '101lab',
  needsClearerPhoto: false,
  siteTypeConfidence: null,
  siteTypeSource: null,
  categorySource: null,
};

describe('routingNeedsAsk — the ONE home for the trigger (blocker (d))', () => {
  it('does not ask on a clean signal', () => {
    expect(routingNeedsAsk({ signal: clean, supported: ALL })).toBe(false);
  });

  it('asks on needs_clearer_photo (the primary live v1 trigger)', () => {
    expect(
      routingNeedsAsk({ signal: { ...clean, needsClearerPhoto: true }, supported: ALL }),
    ).toBe(true);
  });

  it('asks on an override or a low-confidence fallback source', () => {
    for (const src of ['regex_override', 'low_confidence_fallback'] as const) {
      expect(routingNeedsAsk({ signal: { ...clean, siteTypeSource: src }, supported: ALL })).toBe(
        true,
      );
    }
  });

  it('does NOT ask on hint or vision', () => {
    for (const src of ['hint', 'vision'] as const) {
      expect(routingNeedsAsk({ signal: { ...clean, siteTypeSource: src }, supported: ALL })).toBe(
        false,
      );
    }
  });

  it('asks when the AI named a marketplace the server list does not allow', () => {
    expect(
      routingNeedsAsk({
        signal: { ...clean, suggestedMarketplace: '101recycle' },
        supported: ['101lab', '101machine'],
      }),
    ).toBe(true);
  });

  it('asks when the AI named nothing at all', () => {
    expect(
      routingNeedsAsk({ signal: { ...clean, suggestedMarketplace: null }, supported: ALL }),
    ).toBe(true);
  });

  // Fail-closed: this is the V-8 / G15 path, and it must be reachable from the
  // pure function so it is testable without an emulator.
  it('never asks when only one marketplace is supported (1.0.3 behaviour)', () => {
    expect(
      routingNeedsAsk({ signal: { ...clean, needsClearerPhoto: true }, supported: ['101lab'] }),
    ).toBe(false);
    expect(routingNeedsAsk({ signal: clean, supported: [] })).toBe(false);
  });

  // PLAN §2.1 — no numeric threshold in v1.
  it('the confidence NUMBER alone never flips the trigger', () => {
    expect(routingNeedsAsk({ signal: { ...clean, siteTypeConfidence: 0.01 }, supported: ALL })).toBe(
      routingNeedsAsk({ signal: { ...clean, siteTypeConfidence: 0.99 }, supported: ALL }),
    );
  });
});

describe('shouldPrefillCategory — §0.5 owner decision', () => {
  it('pre-fills on a trusted tree', () => {
    expect(shouldPrefillCategory({ marketplace: '101lab', signal: clean })).toBe(true);
    expect(shouldPrefillCategory({ marketplace: '101it', signal: clean })).toBe(true);
  });

  // ⛔ OWNER DECISION — APPROVED 2026-08-18. If this test fails, someone has
  // re-enabled the silent "Boring & Drilling Machines" pre-fill.
  it('never pre-fills on machines or recycle', () => {
    for (const m of ['101machine', '101recycle'] as MarketplaceKey[]) {
      expect(shouldPrefillCategory({ marketplace: m, signal: clean })).toBe(false);
    }
  });

  it('never pre-fills when the backend says the category is unresolved', () => {
    expect(
      shouldPrefillCategory({
        marketplace: '101lab',
        signal: { ...clean, categorySource: 'unresolved' },
      }),
    ).toBe(false);
  });

  it('still pre-fills for the other two server values (C6 enum)', () => {
    for (const src of ['ai', 'fuzzy'] as const) {
      expect(
        shouldPrefillCategory({ marketplace: '101lab', signal: { ...clean, categorySource: src } }),
      ).toBe(true);
    }
  });
});

describe('CLEARED_CATEGORY_* — all five fields, both shapes', () => {
  const FIVE = [
    'categoryId',
    'categoryName',
    'customSubcategory',
    'parentCategoryId',
    'parentCategoryName',
  ];

  // Clearing three of the five would leave a PREVIOUS marketplace's parent id in
  // the submit payload (buildFormData.ts:161 / :270) and its name at :164 / :271.
  it('covers all five marketplace-scoped fields in both shapes', () => {
    expect(Object.keys(CLEARED_CATEGORY_DRAFT_FIELDS).sort()).toEqual(FIVE);
    expect(Object.keys(CLEARED_CATEGORY_FORM_FIELDS).sort()).toEqual(FIVE);
  });

  // The draft shape must match `emptyDraft`, so a cleared draft is
  // indistinguishable from a fresh one.
  it('uses null for the draft leaf and empty strings for the form', () => {
    expect(CLEARED_CATEGORY_DRAFT_FIELDS.categoryId).toBeNull();
    expect(CLEARED_CATEGORY_DRAFT_FIELDS.categoryName).toBeNull();
    expect(CLEARED_CATEGORY_DRAFT_FIELDS.parentCategoryId).toBe('');
    expect(Object.values(CLEARED_CATEGORY_FORM_FIELDS).every((v) => v === '')).toBe(true);
  });

  // Both must read as "missing" to the checklist / detailSchema.
  it('both shapes fail the required-category rule', () => {
    expect(String(CLEARED_CATEGORY_DRAFT_FIELDS.categoryId ?? '')).toHaveLength(0);
    expect(CLEARED_CATEGORY_FORM_FIELDS.categoryId).toHaveLength(0);
  });
});

describe('deriveRoutingState', () => {
  it('confirmed + prefill when the AI routed a legible item to a trusted tree', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: clean,
      supported: ALL,
    });
    expect(s.kind).toBe('confirmed');
    expect(s.resolved).toBe(true);
    expect(s.prefillCategory).toBe(true);
  });

  it('asks when needs_clearer_photo is true (the v1 trigger)', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, needsClearerPhoto: true },
      supported: ALL,
    });
    expect(s.kind).toBe('ask');
    expect(s.resolved).toBe(false);
    expect(s.prefillCategory).toBe(false);
    // The guess is surfaced but NOT adopted.
    expect(s.suggested).toBe('101lab');
    expect(s.current).toBe('101lab');
  });

  it('stops asking once the seller has confirmed', () => {
    const s = deriveRoutingState({
      current: '101it',
      confirmed: true,
      signal: { ...clean, needsClearerPhoto: true, suggestedMarketplace: '101lab' },
      supported: ALL,
    });
    expect(s.kind).toBe('confirmed');
    expect(s.resolved).toBe(true);
  });

  it('does not pre-fill the category on machines or recycle (§4.1 / §0.5)', () => {
    for (const m of ['101machine', '101recycle'] as MarketplaceKey[]) {
      const s = deriveRoutingState({
        current: m,
        confirmed: false,
        signal: { ...clean, suggestedMarketplace: m },
        supported: ALL,
      });
      expect(s.kind).toBe('confirmed');
      expect(s.prefillCategory).toBe(false);
    }
  });

  it('does not pre-fill the category when the backend says unresolved', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, categorySource: 'unresolved' },
      supported: ALL,
    });
    expect(s.prefillCategory).toBe(false);
  });

  it('asks when the source is an override or a low-confidence fallback', () => {
    for (const src of ['regex_override', 'low_confidence_fallback'] as const) {
      const s = deriveRoutingState({
        current: '101lab',
        confirmed: false,
        signal: { ...clean, siteTypeSource: src },
        supported: ALL,
      });
      expect(s.kind).toBe('ask');
    }
  });

  it('never asks when only one marketplace is supported (1.0.3 behaviour)', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, needsClearerPhoto: true },
      supported: ['101lab'],
    });
    expect(s.kind).toBe('confirmed');
    expect(s.resolved).toBe(true);
  });

  it('drops a suggestion the server list does not allow, and asks instead', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, suggestedMarketplace: '101recycle' },
      supported: ['101lab', '101machine'],
    });
    expect(s.suggested).toBeNull();
    expect(s.kind).toBe('ask');
  });

  // ⛔ blocker (d) — the deriver and the trigger must be ONE decision, not two
  // that happen to agree today. This is the test the old plan claimed to have.
  it('agrees with routingNeedsAsk on every combination it can reach', () => {
    const bools = [false, true];
    const sources = [null, 'hint', 'vision', 'regex_override', 'low_confidence_fallback'] as const;
    const suggestions = [null, '101lab', '101recycle'] as const;
    const lists: MarketplaceKey[][] = [['101lab'], ['101lab', '101machine'], ALL];
    for (const needsClearerPhoto of bools) {
      for (const siteTypeSource of sources) {
        for (const suggestedMarketplace of suggestions) {
          for (const supported of lists) {
            const signal: RoutingSignal = {
              ...clean,
              needsClearerPhoto,
              siteTypeSource,
              suggestedMarketplace,
            };
            const expected = routingNeedsAsk({ signal, supported });
            const derived = deriveRoutingState({
              current: '101lab',
              confirmed: false,
              signal,
              supported,
            });
            expect(derived.kind === 'ask').toBe(expected);
          }
        }
      }
    }
  });

  // ⛔ PLAN §2.1 — no numeric threshold in v1.
  it('the confidence NUMBER alone never changes the state', () => {
    const low = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, siteTypeConfidence: 0.01 },
      supported: ALL,
    });
    const high = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, siteTypeConfidence: 0.99 },
      supported: ALL,
    });
    expect(low.kind).toBe(high.kind);
    expect(low.resolved).toBe(high.resolved);
    expect(low.prefillCategory).toBe(high.prefillCategory);
    expect(low.confidence).toBe(0.01); // carried for display
    expect(high.confidence).toBe(0.99);
  });
});

const draft = (over: Partial<DraftItem>): DraftItem =>
  ({ brand: '', model: '', needsClearerPhoto: false, ...over }) as DraftItem;

describe('signalFrom* adapters', () => {
  it('reads a draft, defaulting every absent field', () => {
    expect(signalFromDraft(draft({}))).toEqual({
      suggestedMarketplace: null,
      needsClearerPhoto: false,
      siteTypeConfidence: null,
      siteTypeSource: null,
      categorySource: null,
    });
  });

  it('reads the smart-detect mapper output verbatim', () => {
    const fields = {
      suggestedMarketplace: '101it',
      needsClearerPhoto: true,
      siteTypeConfidence: 0.31,
      siteTypeSource: 'low_confidence_fallback',
      categorySource: 'unresolved',
    } as unknown as SmartItemFields;
    expect(signalFromSmartFields(fields)).toEqual({
      suggestedMarketplace: '101it',
      needsClearerPhoto: true,
      siteTypeConfidence: 0.31,
      siteTypeSource: 'low_confidence_fallback',
      categorySource: 'unresolved',
    });
  });

  it('reads the analyze mapper output verbatim', () => {
    const ai = {
      suggestedMarketplace: '101machine',
      needsClearerPhoto: false,
      siteTypeConfidence: null,
      siteTypeSource: null,
      categorySource: 'fuzzy',
    } as unknown as AiResult;
    expect(signalFromAiResult(ai).suggestedMarketplace).toBe('101machine');
    expect(signalFromAiResult(ai).categorySource).toBe('fuzzy');
  });
});

describe('isRoutingResolved', () => {
  it('treats a persisted 1.0.3 draft (field absent) as resolved', () => {
    expect(isRoutingResolved(draft({}))).toBe(true);
  });
  it('blocks only an explicit false', () => {
    expect(isRoutingResolved(draft({ marketplaceConfirmed: false }))).toBe(false);
    expect(isRoutingResolved(draft({ marketplaceConfirmed: true }))).toBe(true);
  });
});

describe('routingWhyLine', () => {
  it('quotes the nameplate when brand/model were read', () => {
    expect(routingWhyLine(draft({ brand: 'Hsiangtai', model: 'CN-1050' }))).toEqual({
      key: 'mobile.detail.routing.whyNameplate',
      identity: 'Hsiangtai CN-1050',
    });
  });
  it('says the nameplate was illegible when that is what happened', () => {
    expect(routingWhyLine(draft({ needsClearerPhoto: true }))).toEqual({
      key: 'mobile.detail.routing.whyNoNameplate',
    });
  });
  it('invents nothing when there is nothing to say', () => {
    expect(routingWhyLine(draft({}))).toBeNull();
  });
});
