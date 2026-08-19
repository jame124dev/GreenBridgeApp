import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import en from '@/i18n/locales/en.json';

/**
 * M-10 / integration doc C7 — `MARKETPLACE_OPTIONS[].description` is the ONE home
 * for marketplace description copy, and the phase that owns it (5) also ships the
 * six locales. `i18n/__tests__/phase5Keys.test.ts` guards the locale files; this
 * guards the other three halves of the contract, all of which were deletable with
 * a green suite before this file existed:
 *
 *   - the `description` field itself (the constant is what M-3's marketplace sheet
 *     reads, so a locale-only test cannot see it disappear),
 *   - option value ↔ locale key parity (a fifth marketplace with no key, or a key
 *     with no option, is a silent blank line on the screen),
 *   - the render site, which M-4 MOVED. Before the unlock the picker lived in
 *     `MarketplaceCard` behind `MARKETPLACE_LOCKED = true`, so the only guard
 *     available was a grep of that file's source. M-4 flipped the lock: the
 *     card renders nothing at all and the picker is `MarketplaceSheet`, opened
 *     from `RoutingChip`. Both read the same key with the same fallback, and
 *     the sheet is now covered by a REAL render assertion in
 *     `components/detail/__tests__/MarketplaceSheet.test.tsx`. What is asserted
 *     from source here is only that neither consumer has dropped the
 *     key-first/constant-fallback pairing.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SHEET = 'src/features/scanner/components/detail/MarketplaceSheet.tsx';
const CHIP = 'src/features/scanner/components/detail/RoutingChip.tsx';
const CARD = 'src/features/scanner/components/detail/MarketplaceCard.tsx';

describe('MARKETPLACE_OPTIONS descriptions (M-10, C7)', () => {
  it('every option carries a non-empty English description fallback', () => {
    expect(MARKETPLACE_OPTIONS.length).toBeGreaterThan(0);
    for (const opt of MARKETPLACE_OPTIONS) {
      expect(typeof opt.description).toBe('string');
      expect(opt.description.trim().length).toBeGreaterThan(0);
      // A description that just repeats the codename explains nothing.
      expect(opt.description.trim().toLowerCase()).not.toBe(opt.label.toLowerCase());
    }
  });

  it('option values and locale keys are the same set', () => {
    const fromLocale = Object.keys((en as any).mobile.detail.marketplaceOption ?? {});
    expect(fromLocale.sort()).toEqual(MARKETPLACE_OPTIONS.map((o) => o.value).sort());
  });

  it('both M-3 consumers read the key first with the constant as fallback', () => {
    const sheet = fs.readFileSync(path.join(ROOT, SHEET), 'utf8');
    expect(sheet).toContain('mobile.detail.marketplaceOption.${opt.value}.description');
    expect(sheet).toContain('defaultValue: opt.description');
    const chip = fs.readFileSync(path.join(ROOT, CHIP), 'utf8');
    expect(chip).toContain('mobile.detail.marketplaceOption.${m}.description');
    expect(chip).toContain('defaultValue: o.description');
  });

  // C7's other half: this phase must NOT resurrect a second field name or a
  // second key namespace for the same sentence.
  it('there is no second description field and no marketplaceHint namespace', () => {
    for (const rel of [SHEET, CHIP, CARD]) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src).not.toContain('marketplaceHint');
      expect(src).not.toContain('hintKey');
    }
    expect((en as any).mobile.detail.marketplaceHint).toBeUndefined();
  });

  // The card is now empty by design (M-4 lock 1). If a picker comes back here
  // there are two controls writing `marketplace` — the duplicate control
  // UX_DESIGN_RULES.md forbids, and the hydration race useDetailController
  // documents.
  it('MarketplaceCard renders nothing at all', () => {
    const src = fs.readFileSync(path.join(ROOT, CARD), 'utf8');
    expect(src).toContain('export function MarketplaceCard() {');
    expect(src).toContain('return null;');
    expect(src).not.toContain('const MARKETPLACE_LOCKED');
    // Zero imports is the real invariant: a card that imports nothing cannot
    // render a picker. (The docblock still NAMES the old flag, on purpose.)
    expect(src).not.toMatch(/^import /m);
  });
});
