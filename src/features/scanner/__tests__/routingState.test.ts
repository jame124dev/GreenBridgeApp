import { describe, it, expect } from '@jest/globals';

import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  CLEARED_CATEGORY_FORM_FIELDS,
  deriveRoutingState,
  isRoutingResolved,
  routingNeedsAsk,
  routingPatchFromAi,
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


// ─────────────────────────────────────────────────────────────────────────────
// M-4 lock 3 — the analyze path's patch.
//
// ⛔ WHY THIS BLOCK EXISTS. Before it, deleting the single spread
// `...routingPatchFromAi(...)` from `app/scan/processing.tsx` removed the WHOLE
// of lock 3 — marketplace adoption, `marketplaceConfirmed`, all four carried
// routing fields and the approved machines/recycle category clear — and the full
// suite stayed 123 suites / 1147 tests green with tsc at exit 0. GROUPED scans
// always take that branch, so it is the most travelled path in the feature.
// Third time on this project that a phase's headline behaviour was free to
// delete (Step 8-8 was the first, C4's call site the second), so it is closed
// the same way: the DECISION is pinned here, the CALL SITE in
// `routingWiring.test.ts`.
//
// The function is pure because `supported` and `fallbackMarketplace` are
// arguments — the same trick `routingNeedsAsk` uses, and what keeps
// `routingState.ts` import-type-only for blocker (d).
// ─────────────────────────────────────────────────────────────────────────────
const aiFrom = (over: Partial<RoutingSignal>): AiResult =>
  ({
    name: 'Hsiangtai CN-1050',
    description: 'benchtop centrifuge',
    condition: ['used'],
    operationStatus: ['working'],
    suggestedPrice: '1200',
    currency: 'USD',
    suggestedMarketplace: null,
    needsClearerPhoto: false,
    siteTypeConfidence: null,
    siteTypeSource: null,
    categorySource: null,
    ...over,
  }) as unknown as AiResult;

/** The analyze path's real arguments: every marketplace on, lab as the build's own. */
const patchOf = (
  over: Partial<RoutingSignal>,
  supported: MarketplaceKey[] = ALL,
  fallbackMarketplace: MarketplaceKey = '101lab',
) => routingPatchFromAi({ ai: aiFrom(over), supported, fallbackMarketplace });

describe('routingPatchFromAi — marketplace adoption', () => {
  it('adopts the AI marketplace when the server list allows it', () => {
    expect(patchOf({ suggestedMarketplace: '101it' }).marketplace).toBe('101it');
  });

  it('OMITS the key entirely when the AI named nothing', () => {
    // Not `marketplace: undefined` — the patch is spread over a draft, so a
    // present-but-undefined key would clobber `emptyDraft`s env default with
    // undefined instead of leaving it alone.
    expect('marketplace' in patchOf({})).toBe(false);
  });

  it('OMITS the key when the AI named a marketplace this build does not support', () => {
    const patch = patchOf({ suggestedMarketplace: '101recycle' }, ['101lab', '101it']);
    expect('marketplace' in patch).toBe(false);
  });
});

describe('routingPatchFromAi — the confirmed/ask answer', () => {
  it('is confirmed on a clean signal', () => {
    expect(patchOf({ suggestedMarketplace: '101lab' }).marketplaceConfirmed).toBe(true);
  });

  it('must ask when the nameplate could not be read', () => {
    expect(
      patchOf({ suggestedMarketplace: '101lab', needsClearerPhoto: true }).marketplaceConfirmed,
    ).toBe(false);
  });

  it('must ask on an override or a low-confidence fallback', () => {
    for (const siteTypeSource of ['regex_override', 'low_confidence_fallback'] as const) {
      expect(
        patchOf({ suggestedMarketplace: '101lab', siteTypeSource }).marketplaceConfirmed,
      ).toBe(false);
    }
  });

  it('must ask when the AI routed somewhere this build cannot list', () => {
    expect(
      patchOf({ suggestedMarketplace: '101recycle' }, ['101lab', '101it']).marketplaceConfirmed,
    ).toBe(false);
  });

  it('never asks on a single-marketplace build — a fail-closed install is 1.0.3', () => {
    expect(
      patchOf({ suggestedMarketplace: null, needsClearerPhoto: true }, ['101lab'])
        .marketplaceConfirmed,
    ).toBe(true);
  });
});

describe('routingPatchFromAi — the four carried routing fields', () => {
  it('carries every one of them onto the draft', () => {
    const patch = patchOf({
      suggestedMarketplace: '101it',
      needsClearerPhoto: true,
      siteTypeConfidence: 0.42,
      siteTypeSource: 'vision',
      categorySource: 'fuzzy',
    });
    expect(patch.needsClearerPhoto).toBe(true);
    expect(patch.siteTypeConfidence).toBe(0.42);
    expect(patch.siteTypeSource).toBe('vision');
    expect(patch.categorySource).toBe('fuzzy');
  });

  it('writes explicit nulls/false rather than leaving stale values behind', () => {
    const patch = patchOf({ suggestedMarketplace: '101lab' });
    expect(patch.needsClearerPhoto).toBe(false);
    expect(patch.siteTypeConfidence).toBeNull();
    expect(patch.siteTypeSource).toBeNull();
    expect(patch.categorySource).toBeNull();
  });
});

describe('routingPatchFromAi — the §0.5 category clear (owner-approved)', () => {
  const cleared = (patch: Partial<DraftItem>) =>
    Object.entries(CLEARED_CATEGORY_DRAFT_FIELDS).every(
      ([k, v]) => patch[k as keyof DraftItem] === v,
    );

  it('leaves a trusted marketplace resolved category alone', () => {
    const patch = patchOf({ suggestedMarketplace: '101lab', categorySource: 'ai' });
    expect('categoryId' in patch).toBe(false);
    expect(cleared(patch)).toBe(false);
  });

  it('clears all FIVE fields for a machines-routed item', () => {
    // /machines is 13 flat parents with zero subcategories, so the backend
    // pickDefaultParent ships tree[0] on anything it cannot place.
    expect(cleared(patchOf({ suggestedMarketplace: '101machine' }))).toBe(true);
  });

  it('clears all FIVE fields for a recycle-routed item', () => {
    expect(cleared(patchOf({ suggestedMarketplace: '101recycle' }))).toBe(true);
  });

  it('clears when the server itself says the category is unresolved', () => {
    expect(
      cleared(patchOf({ suggestedMarketplace: '101lab', categorySource: 'unresolved' })),
    ).toBe(true);
  });

  // ⛔ The subtle one, and the reason `marketplace` is recomputed before the
  // prefill question is asked. The AI verdict was REJECTED (not on the server
  // list), so the draft will hold the build's own lab marketplace — judging the
  // rejected machines verdict would clear a lab category that is perfectly fine.
  it('judges the prefill on what the draft will ACTUALLY hold, not the rejected verdict', () => {
    const patch = patchOf({ suggestedMarketplace: '101machine' }, ['101lab', '101it'], '101lab');
    expect('marketplace' in patch).toBe(false);
    expect(cleared(patch)).toBe(false);
  });

  // The mirror image: nothing adopted, and the build's OWN marketplace is one of
  // the untrusted trees, so the clear must still happen.
  it('judges against the build fallback when the AI named nothing', () => {
    expect(cleared(patchOf({}, ALL, '101recycle'))).toBe(true);
  });
});
