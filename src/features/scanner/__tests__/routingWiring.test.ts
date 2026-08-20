import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * M-3/M-4 — the SCREEN seams. Everything the chip and the locks do is unit-tested
 * elsewhere (`RoutingChip.test.tsx`, `MarketplaceSheet.test.tsx`,
 * `routingState.test.ts`, `scanDraftStore.test.ts`, `onConfirmPatch.test.ts`,
 * `missingRouting.test.ts`) — but ALL of that stays green if the chip is never
 * mounted, or if `onConfirm` is wired without the category clear. The feature is
 * the wiring, and none of the three route files is renderable under jest (they
 * need expo-router, React Query, the whole detail form and MMKV).
 *
 * So: assertions over SOURCE TEXT, the same deliberate trade-off and the same
 * reasoning as `categoryPickerWiring.test.ts` and `detailScreenWiring.test.ts`.
 * They prove the wiring is still WRITTEN; the device checks (V-5 … V-9) prove it
 * works.
 *
 * If the chip ever stops being a chip, delete this file along with it — do not
 * weaken an assertion to keep it green.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const DETAIL = 'app/scan/detail.tsx';
const GEDIT = 'app/scan/grouped-edit.tsx';
const GREVIEW = 'app/scan/grouped-review.tsx';
const PROCESSING = 'app/scan/processing.tsx';

describe('M-3 — the chip is mounted on BOTH editors', () => {
  for (const rel of [DETAIL, GEDIT]) {
    it(`${rel} renders <RoutingChip>`, () => {
      const src = read(rel);
      expect(src).toContain('<RoutingChip');
      expect(src).toContain('  RoutingChip,'); // barrel import
    });

    it(`${rel} passes a draft and an onConfirm`, () => {
      const src = read(rel);
      expect(src).toMatch(/<RoutingChip[\s\S]{0,80}draft=\{/);
      expect(src).toMatch(/<RoutingChip[\s\S]{0,200}onConfirm=\{/);
    });
  }

  // The routing answer decides which category tree and which currency the rest
  // of the form uses, so it belongs at the TOP of the scroll — not as an
  // eleventh card behind ~3,200 px (plan §6.1).
  //
  // TIGHTENED (device pass, 2026-08-19). This used to assert "above
  // <IdentityCard />" for detail.tsx but only "above <DescriptionCard />" for
  // grouped-edit.tsx — which was the WEAKER of the two assertions written to
  // fit code that had drifted: grouped-edit shipped the chip BELOW IdentityCard
  // (a48e893, whose own message claims "at the TOP of both editors"). The chip
  // moved up rather than the plan moving down: "where does this item go" is the
  // question that decides which category tree and which currency the identity
  // fields are then edited against, so it belongs above "what is this item", and
  // the two editors must not disagree about it. One loop, one rule, both files.
  for (const rel of [DETAIL, GEDIT]) {
    it(`the chip sits above the identity fields on ${rel}`, () => {
      const src = read(rel);
      const chip = src.indexOf('<RoutingChip');
      // Prefix, not `'<IdentityCard />'`: FIX 1b gives the tag a prop on both
      // editors, and an exact-tag match would have made this assertion silently
      // unreachable (indexOf -1 < chip is false, so it would FAIL loudly here —
      // but the same pattern below slices a block and would have gone vacuous).
      const identity = src.indexOf('<IdentityCard');
      expect(chip).toBeGreaterThan(-1);
      expect(identity).toBeGreaterThan(-1);
      expect(chip).toBeLessThan(identity);
    });
  }
});

/**
 * ⛔ FIX 1b (2026-08-20) — the nameplate hint's CALL SITES.
 *
 * `routingNeedsAsk` no longer asks a MARKETPLACE question just because the server
 * could not read a nameplate (FIX 1: that flag is about BRAND and MODEL, and it
 * fired on 9/24 measured items, including a device case that named the item
 * "Wireless Earbuds", routed it to 101IT and asked anyway).
 *
 * The flag must not vanish along with the question. `IdentityCard` renders it —
 * `IdentityCard.nameplateHint.test.tsx` proves the component — but the component
 * defaults the prop to `undefined` and stays silent, so WITHOUT these two lines
 * the whole of FIX 1b is dead code with a fully green suite. That is exactly how
 * three earlier phases on this project shipped deletable behaviour, so the prop
 * is pinned at both editors here.
 */
describe('FIX 1b — both scan editors hand IdentityCard the unreadable-photo flag', () => {
  // detail.tsx calls the draft `draft`; grouped-edit.tsx calls it `item`.
  const EXPECTED: Record<string, string> = {
    [DETAIL]: '<IdentityCard needsClearerPhoto={draft.needsClearerPhoto === true} />',
    [GEDIT]: '<IdentityCard needsClearerPhoto={item.needsClearerPhoto === true} />',
  };

  for (const rel of [DETAIL, GEDIT]) {
    it(`${rel} passes needsClearerPhoto off the draft`, () => {
      expect(read(rel)).toContain(EXPECTED[rel]);
    });

    // A bare `<IdentityCard />` on either editor means the hint can never render
    // there, which is the deletion this block exists to catch.
    it(`${rel} has no un-wired <IdentityCard /> left`, () => {
      expect(read(rel)).not.toContain('<IdentityCard />');
    });
  }

  // The published-listing editor is NOT a scan: it has no smart-detect response
  // and no `needs_clearer_photo`, so it must stay on the default (silent) prop.
  it('the published-listing editor is deliberately NOT wired', () => {
    const src = read('app/(lab)/listing-edit.tsx');
    expect(src).toContain('<IdentityCard variant="edit" />');
    expect(src).not.toContain('needsClearerPhoto');
  });
});

describe('blocker (c) — both onConfirm call sites clear the category in the SAME patch', () => {
  it('detail.tsx patches marketplace + confirmed + the cleared fields together', () => {
    const src = read(DETAIL);
    const at = src.indexOf('<RoutingChip');
    // Prefix match — see the note in the block above. An exact `'<IdentityCard />'`
    // would return -1 after FIX 1b, and `slice(at, -1)` silently swallows the
    // whole rest of the file, which would make every assertion below vacuous.
    const end = src.indexOf('<IdentityCard', at);
    expect(end).toBeGreaterThan(at);
    const block = src.slice(at, end);
    expect(block).toContain('useScanDraft.getState().patch({');
    expect(block).toContain('marketplaceConfirmed: true,');
    expect(block).toContain('...CLEARED_CATEGORY_DRAFT_FIELDS,');
  });

  it('grouped-edit.tsx does the same through patchQueuedItem', () => {
    const src = read(GEDIT);
    const at = src.indexOf('<RoutingChip');
    // Sliced to <IdentityCard — the SAME boundary as detail.tsx above, now
    // that the chip sits above the identity fields on both editors. Slicing to
    // <DescriptionCard /> would keep passing but would silently tolerate the chip
    // drifting back down between the two cards.
    const end = src.indexOf('<IdentityCard', at);
    expect(end).toBeGreaterThan(at);
    const block = src.slice(at, end);
    expect(block).toContain('patchQueuedItem(index, {');
    expect(block).toContain('marketplaceConfirmed: true,');
    expect(block).toContain('...CLEARED_CATEGORY_DRAFT_FIELDS,');
  });
});

describe('M-3 — an unanswered routing question blocks Submit everywhere', () => {
  // The footer gate is inert on the single-item path after Phase 5 (C4 —
  // missingRouting() is the correctness fix there), but it still drives the three
  // GROUPED buttons, so both must be present.
  it('detail.tsx ANDs isRoutingResolved into the footer gate', () => {
    expect(read(DETAIL)).toContain('allRequired={required.allComplete && isRoutingResolved(draft)}');
  });

  it('grouped-review folds routing into per-row readiness', () => {
    const src = read(GREVIEW);
    expect(src).toContain('const routingResolved = isRoutingResolved(item);');
    expect(src).toContain('const ready = status.allComplete && hasPhotos && routingResolved;');
  });

  it('grouped-review folds routing into the pre-flight submit sweep', () => {
    // The sweep reads the LIVE store queue, so a row that never opened its
    // editor still cannot slip through.
    const src = read(GREVIEW);
    expect(src).toContain('isRoutingResolved(it);');
  });

  it('an unanswered row is counted as missing, not silently ready', () => {
    expect(read(GREVIEW)).toContain(
      'const missingCount = missingKeys.length + (routingResolved ? 0 : 1);',
    );
  });
});

describe('M-3 — the hub shows each row its destination (plan §6.2)', () => {
  it('renders the marketplace label per row, from the ONE options constant', () => {
    const src = read(GREVIEW);
    expect(src).toContain("MARKETPLACE_OPTIONS.find((o) => o.value === item.marketplace)?.label");
  });

  it('names the gap instead of the label when routing is unanswered', () => {
    const src = read(GREVIEW);
    expect(src).toContain("t('mobile.reviewHub.pickMarketplace'");
    expect(src).toContain("t('mobile.reviewHub.statusMissingMarketplace'");
  });

  // Retargeting belongs in the item editor (plan §9). A second write path to
  // `marketplace` re-opens the hydration race useDetailController documents.
  it('the hub is READ-ONLY — it never writes marketplace', () => {
    const src = read(GREVIEW);
    expect(src).not.toContain('<RoutingChip');
    expect(src).not.toMatch(/marketplace:\s/);
  });
});

/**
 * M-4 lock 3 — the ANALYZE screen's seam. Added 2026-08-19 after review found it
 * missing: deleting the single spread below removed the whole of lock 3 (the
 * marketplace adoption, `marketplaceConfirmed`, all four carried routing fields
 * and the §0.5 category clear) and the full suite stayed 123 suites / 1147 tests
 * green with tsc at exit 0. Grouped scans ALWAYS take this branch, so it is the
 * most travelled path in the feature and it was the least guarded.
 *
 * Two halves, both needed: the DECISION is unit-tested directly in
 * `routingState.test.ts` (17 tests — that only became possible once the function
 * moved out of this un-importable route file), and the CALL SITE is here.
 *
 * Assertions are `indexOf` / `toContain` on single-line fragments only:
 * `processing.tsx` has MIXED line endings (1183 CRLF + 5 LF-only lines), so
 * anything spanning a newline would pin bytes that have already drifted once.
 */
describe('M-4 lock 3 — the analyze path applies the routing patch', () => {
  const MARK = '...routingPatchFromAi(';

  it('spreads routingPatchFromAi into the analyze onSuccess patch', () => {
    expect(read(PROCESSING)).toContain(MARK);
  });

  it('imports it from routingState — the ONE home — and defines no local copy', () => {
    const src = read(PROCESSING);
    expect(src).toContain(
      "import { routingPatchFromAi } from '@/features/scanner/routing/routingState';",
    );
    // A second definition here is the three-copies regression blocker (d) exists
    // for, and it would also make the unit tests in routingState.test.ts a lie.
    expect(src).not.toMatch(/function\s+routingPatchFromAi/);
  });

  it('passes the live supported list and the build fallback, not hardcoded values', () => {
    const src = read(PROCESSING);
    const at = src.indexOf(MARK);
    const args = src.slice(at, at + 400);
    expect(args).toContain('supported: supportedNow(),');
    expect(args).toContain('fallbackMarketplace: marketplaceFromSiteType(getSiteType())');
  });

  // The ordering constraint the call site's own comment states, and the reason
  // this spread is written where it is: when the routed tree is untrusted the
  // patch CLEARS the five category fields, so anything spreading `ai.categoryId`
  // afterwards would silently undo the clear.
  it('is the LAST spread in the patch — after ai.categoryId, before lastStep', () => {
    const src = read(PROCESSING);
    const at = src.indexOf(MARK);
    const catAt = src.indexOf('...(ai.categoryId');
    const lastStepAt = src.indexOf("lastStep: 'detail',", at);
    expect(catAt).toBeGreaterThan(-1);
    expect(catAt).toBeLessThan(at);
    expect(lastStepAt).toBeGreaterThan(at);
    expect(src.slice(at + MARK.length, lastStepAt)).not.toContain('...');
  });
});
