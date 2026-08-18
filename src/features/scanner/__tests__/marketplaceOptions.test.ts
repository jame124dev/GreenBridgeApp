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
 *   - the render site in `MarketplaceCard`, which is asserted from SOURCE on
 *     purpose: the card returns null while `MARKETPLACE_LOCKED = true`
 *     (MarketplaceCard.tsx:22 — flipping it is M-4, another phase), so no render
 *     test can reach the line until then. This is the honest guard available now.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
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

  it('MarketplaceCard renders the selected option description, key first', () => {
    const src = fs.readFileSync(path.join(ROOT, CARD), 'utf8');
    // The i18n key wins; the constant is the fallback argument.
    expect(src).toContain('mobile.detail.marketplaceOption.${marketplace}.description');
    expect(src).toContain('MARKETPLACE_OPTIONS.find((o) => o.value === marketplace)?.description');
  });
});
