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
  it('the chip sits above the identity fields on detail.tsx', () => {
    const src = read(DETAIL);
    expect(src.indexOf('<RoutingChip')).toBeLessThan(src.indexOf('<IdentityCard />'));
  });

  it('the chip sits above the description on grouped-edit.tsx', () => {
    const src = read(GEDIT);
    expect(src.indexOf('<RoutingChip')).toBeLessThan(src.indexOf('<DescriptionCard />'));
  });
});

describe('blocker (c) — both onConfirm call sites clear the category in the SAME patch', () => {
  it('detail.tsx patches marketplace + confirmed + the cleared fields together', () => {
    const src = read(DETAIL);
    const at = src.indexOf('<RoutingChip');
    const block = src.slice(at, src.indexOf('<IdentityCard />', at));
    expect(block).toContain('useScanDraft.getState().patch({');
    expect(block).toContain('marketplaceConfirmed: true,');
    expect(block).toContain('...CLEARED_CATEGORY_DRAFT_FIELDS,');
  });

  it('grouped-edit.tsx does the same through patchQueuedItem', () => {
    const src = read(GEDIT);
    const at = src.indexOf('<RoutingChip');
    const block = src.slice(at, src.indexOf('<DescriptionCard />', at));
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
