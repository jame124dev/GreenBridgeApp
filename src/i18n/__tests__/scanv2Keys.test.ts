/**
 * Scan V2 i18n coverage — `mobile.scanv2.*`.
 *
 * The v2 scan surface shipped entirely in hardcoded English on an app with six
 * locales and a visible language chip in its own header. This pins the keys as
 * they are translated, screen by screen, so a new locale gap fails here rather
 * than on a seller's phone.
 *
 * ⚠️ REAL ENTRIES, not `defaultValue` fallbacks. `t(key, { defaultValue })`
 * renders English silently in every language that lacks the key, which looks
 * translated in review and is not. Same discipline as `draftKeys.test.ts`.
 */
import { describe, it, expect } from '@jest/globals';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import ja from '@/i18n/locales/ja.json';
import th from '@/i18n/locales/th.json';
import vi from '@/i18n/locales/vi.json';

/**
 * `itemCount` is PLURALISED, so both i18next suffixes are required rather than
 * a bare `itemCount` — matching the `itemCount_one`/`_other` convention already
 * used by `mobile.drafts`.
 *
 * Japanese, Thai, Vietnamese and both Chinese variants have no grammatical
 * plural, so their two entries are legitimately identical. That is a
 * translation fact, not a copy-paste error — do not "fix" it by deleting one.
 */
const PUBLISHED = [
  'title',
  'body',
  'batch',
  'itemCount_one',
  'itemCount_other',
  'nextTitle',
  'reviewIt',
  'reviewItDetail',
  'goesLive',
  'goesLiveDetail',
  'getOffers',
  'getOffersDetail',
  'inThisBatch',
  'yourListing',
  'viewListings',
  'listAnother',
];

/** Shared across the v2 scan surface — one wording for one idea. */
const COMMON = ['signIn', 'sessionEndedTitle', 'scanAnItem', 'typeDetails', 'tryAgain'];

/** Home's selling pane — the first screen a seller sees. */
const HOME = [
  'heading',
  'subline',
  'scanIt',
  'askAssistant',
  'askAssistantExample',
  'bannerEyebrow',
  'bannerHeadline',
  'bannerAction',
  'draftsTitle',
  'listingsTitle',
  'seeAll',
  'seeAllCount',
  'draftsEmpty',
  'draftsError',
  'listingsError',
];

/** Same seven shapes on both list screens, deliberately. */
const LIST_SCREEN = [
  'title',
  'subtitle',
  'loading',
  'sessionEndedBody',
  'loadError',
  'emptyTitle',
  'emptyBody',
];

/**
 * The camera's document lane — `app/v2/scan/camera.tsx`.
 *
 * Every string here is spoken as well as shown: `addFile`, `addFileHint` and
 * `addFileGuestHint` are the accessibility label and hint of an icon-only
 * control, and `removeFile` is the only name a screen reader gives the × on a
 * file chip. An untranslated one is not a cosmetic gap — it is the control
 * losing its name in five of six languages.
 *
 * `reviewA11y` is PLURALISED (`_one`/`_other`, numeric `count`) for the same
 * reason `itemCount` is; see the note above.
 */
const CAMERA = [
  'addFile',
  'addFileHint',
  'addFileGuestHint',
  'removeFile',
  'reviewA11y_one',
  'reviewA11y_other',
  'tooLargeTitle',
  'tooLargeBody',
  'tooLargeManyBody',
  'pickFailedTitle',
  'pickFailedBody',
];

const LOCALES = { en, zhHant, zhHans, ja, th, vi };

describe('scan v2 i18n — common, drafts, listings', () => {
  const GROUPS: [string, string[]][] = [
    ['common', COMMON],
    ['home', HOME],
    ['drafts', LIST_SCREEN],
    ['listings', LIST_SCREEN],
    ['camera', CAMERA],
  ];

  for (const [group, keys] of GROUPS) {
    for (const [name, dict] of Object.entries(LOCALES)) {
      it(`${name} has every mobile.scanv2.${group} key`, () => {
        const block = (dict as any).mobile?.scanv2?.[group] ?? {};
        for (const k of keys) {
          expect(block[k]).toBeTruthy();
        }
      });
    }
  }

  /**
   * The two list screens describe DIFFERENT things and must not drift into the
   * same sentence — "Your drafts did not load" vs "Your listings did not load".
   * Asserted in English only: that is where the distinction is authored, and a
   * translator who collapses them in one locale is a translation issue, not a
   * code one.
   */
  it('drafts and listings do not share their copy', () => {
    const d = (en as any).mobile.scanv2.drafts;
    const l = (en as any).mobile.scanv2.listings;

    for (const k of LIST_SCREEN) expect(d[k]).not.toBe(l[k]);
  });

  for (const [name, dict] of Object.entries(LOCALES)) {
    if (name === 'en') continue;
    it(`${name} translates the shared strings`, () => {
      const c = (dict as any).mobile.scanv2.common;
      const e = (en as any).mobile.scanv2.common;

      for (const k of COMMON) expect(c[k]).not.toBe(e[k]);
    });
  }

  /**
   * Home's headline carries a DELIBERATE line break — "What are you\nselling
   * today?" is two balanced lines in the display type, not a sentence that
   * happens to wrap. It lives in the string so each language picks its own
   * break point instead of inheriting English's, and a translator who drops it
   * reflows the largest text on the first screen a seller sees.
   */
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} keeps the deliberate line break in the headline`, () => {
      expect((dict as any).mobile.scanv2.home.heading).toContain('\n');
    });
  }

  it('the see-all count keeps its placeholder', () => {
    for (const dict of Object.values(LOCALES)) {
      expect((dict as any).mobile.scanv2.home.seeAllCount).toContain('{{count}}');
    }
  });
});

/**
 * The detected-items screen — the densest of the four, and the only one whose
 * strings carry MONEY and COUNTS together.
 */
const ITEMS = [
  'title',
  'lede',
  'noDraftTitle',
  'noDraftBody',
  'backHome',
  'found',
  'toReview',
  'accepted',
  'discarded',
  'totals',
  'totalsAccepted',
  'mixedCurrency',
  'subtotal_one',
  'subtotal_other',
  'noCurrency_one',
  'noCurrency_other',
  'marketEstimate',
  'scrapFloor',
  'needPrice',
  'loading',
  'loadError',
  'tryAgain',
  'emptyBody',
  'writeFailed',
  'dismiss',
  'needsClearerPhoto',
  'discard',
  'accept',
];

describe('scan v2 i18n — detected items', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has every mobile.scanv2.items key`, () => {
      const block = (dict as any).mobile?.scanv2?.items ?? {};
      for (const k of ITEMS) {
        expect(block[k]).toBeTruthy();
      }
    });
  }

  /**
   * Every placeholder these strings interpolate, per key. A translator who
   * localises `{{band}}` or drops `{{total}}` produces either literal braces or
   * a money line missing its figure — and on this screen the figures ARE the
   * content.
   */
  const PLACEHOLDERS: [string, string[]][] = [
    ['found', ['{{count}}']],
    ['toReview', ['{{count}}']],
    ['accepted', ['{{count}}']],
    ['discarded', ['{{count}}']],
    ['totalsAccepted', ['{{count}}']],
    ['subtotal_one', ['{{total}}', '{{count}}']],
    ['subtotal_other', ['{{total}}', '{{count}}']],
    ['noCurrency_one', ['{{count}}']],
    ['noCurrency_other', ['{{count}}']],
    ['marketEstimate', ['{{band}}']],
    ['scrapFloor', ['{{band}}']],
    ['needPrice', ['{{count}}', '{{total}}']],
  ];

  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} keeps every items placeholder`, () => {
      const block = (dict as any).mobile.scanv2.items;
      for (const [key, tokens] of PLACEHOLDERS) {
        for (const token of tokens) {
          expect(block[key]).toContain(token);
        }
      }
    });
  }

  for (const [name, dict] of Object.entries(LOCALES)) {
    if (name === 'en') continue;
    it(`${name} translates the items strings`, () => {
      const block = (dict as any).mobile.scanv2.items;
      const e = (en as any).mobile.scanv2.items;

      for (const k of ['title', 'accept', 'discard', 'totals', 'tryAgain']) {
        expect(block[k]).not.toBe(e[k]);
      }
    });
  }
});

describe('scan v2 i18n — camera documents', () => {
  /**
   * `{{name}}` is the file the seller picked and `{{size}}`/`{{limit}}` are
   * the two numbers the message exists to compare. A translator who drops one
   * produces "is  — over the  limit", which reads as a bug rather than as a
   * file that is too big.
   */
  const PLACEHOLDERS: [string, string[]][] = [
    ['removeFile', ['{{name}}']],
    ['reviewA11y_one', ['{{count}}']],
    ['reviewA11y_other', ['{{count}}']],
    ['tooLargeBody', ['{{name}}', '{{size}}', '{{limit}}']],
    ['tooLargeManyBody', ['{{count}}']],
  ];

  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} keeps every camera placeholder`, () => {
      const block = (dict as any).mobile.scanv2.camera;
      for (const [key, tokens] of PLACEHOLDERS) {
        for (const token of tokens) {
          expect(block[key]).toContain(token);
        }
      }
    });
  }

  for (const [name, dict] of Object.entries(LOCALES)) {
    if (name === 'en') continue;
    it(`${name} translates the camera strings`, () => {
      const block = (dict as any).mobile.scanv2.camera;
      const e = (en as any).mobile.scanv2.camera;

      for (const k of ['addFile', 'addFileGuestHint', 'tooLargeTitle', 'pickFailedBody']) {
        expect(block[k]).not.toBe(e[k]);
      }
    });
  }
});

describe('scan v2 i18n — published', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} has every mobile.scanv2.published key`, () => {
      const published = (dict as any).mobile?.scanv2?.published ?? {};
      for (const k of PUBLISHED) {
        expect(published[k]).toBeTruthy();
      }
    });
  }

  /**
   * The interpolation placeholders must survive translation verbatim. A
   * translator who localises `{{number}}` into `{{número}}` produces a string
   * that renders the literal braces to the seller — and the batch number is the
   * one fact this screen exists to carry.
   */
  for (const [name, dict] of Object.entries(LOCALES)) {
    it(`${name} keeps the interpolation placeholders`, () => {
      const p = (dict as any).mobile.scanv2.published;

      expect(p.batch).toContain('{{number}}');
      expect(p.itemCount_one).toContain('{{count}}');
      expect(p.itemCount_other).toContain('{{count}}');
    });
  }

  /**
   * Nothing outside `en` may simply be the English string. This is the check
   * that catches a block pasted across six files and translated in one.
   */
  const TRANSLATED = ['title', 'viewListings', 'listAnother', 'nextTitle'];

  for (const [name, dict] of Object.entries(LOCALES)) {
    if (name === 'en') continue;
    it(`${name} is actually translated, not copied from en`, () => {
      const p = (dict as any).mobile.scanv2.published;
      const e = (en as any).mobile.scanv2.published;

      for (const k of TRANSLATED) expect(p[k]).not.toBe(e[k]);
    });
  }
});
