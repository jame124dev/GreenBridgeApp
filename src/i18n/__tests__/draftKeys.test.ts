import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

// Task 15 — real (non-defaultValue) locale entries for the drafts feature
// introduced across Tasks 8-14. `itemCount` is pluralized (i18next
// `_one`/`_other` suffixes, matching the existing `itemsCount_one/_other`
// convention already used elsewhere in these same files), so the required
// list checks both variants rather than a bare `itemCount` key.
const REQUIRED = [
  'saved',
  'saveFailed',
  'saveDraft',
  'continue',
  'delete',
  'deleteConfirmTitle',
  'deleteConfirmBody',
  'deleteFailed',
  'empty',
  'flowAi',
  'flowManual',
  'itemCount_one',
  'itemCount_other',
  'loadError',
  'pendingAiNotReady',
  'readyToast',
  'resumeFailed',
  'yourDrafts',
  'yourDraftsDesc',
];

const LOCALES = { en, zhHant, zhHans, ja, th, vi };

describe('drafts i18n', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has all mobile.drafts keys`, () => {
      const drafts = (dict as any).mobile?.drafts ?? {};
      for (const k of REQUIRED) {
        expect(drafts[k]).toBeTruthy();
      }
    });
  }

  // flowAi/flowManual carry emoji prefixes (🤖/✏️) that must survive
  // translation verbatim in every locale — a translator dropping the emoji
  // would silently break the visual convention used across all drafts UI.
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} preserves the flowAi/flowManual emoji`, () => {
      const drafts = (dict as any).mobile.drafts;
      expect(drafts.flowAi).toContain('🤖');
      expect(drafts.flowManual).toContain('✏️');
    });
  }
});

describe('mobile.detail / mobile.processing / mobile.profile drafts-adjacent keys', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has the new saveDraft/background/activity keys`, () => {
      const mobile = (dict as any).mobile;
      expect(mobile.detail?.saveDraft).toBeTruthy();
      expect(mobile.processing?.continueInBackground).toBeTruthy();
      expect(mobile.processing?.leftToast).toBeTruthy();
      expect(mobile.processing?.failed).toBeTruthy();
      expect(mobile.profile?.sectionActivity).toBeTruthy();
    });
  }
});
