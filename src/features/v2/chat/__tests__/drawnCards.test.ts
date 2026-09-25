/**
 * The sanitizer may only delete prose for a card v2 will actually draw.
 *
 * ── THE BUG THIS PINS ──
 *
 * `streamSanitizer` strips a reply's field dump whenever a card is present, on
 * the contract that the card shows the same facts. It recognises 13 types. v2
 * draws three. For the other ten the prose was deleted for a card that then
 * rendered nothing, so a seller was told a draft listing existed and shown
 * neither the draft nor the fields — `listing_draft` is in that gap and is the
 * most important card in the product.
 *
 * These tests run the REAL `resolveBotText`, not a stand-in, because the bug
 * lived in the seam between two correct components and a mock of either would
 * have agreed with whichever one it was modelled on.
 */
import { resolveBotText } from '@/features/lab/chat/streamSanitizer';
import { V2_DRAWN_CARD_TYPES, drawnCards } from '../drawnCards';

/** Every type `streamSanitizer` strips for, read off its two sets. */
const STRIPPED_BY_SANITIZER = [
  // DRAFT_CARD_TYPES
  'listing_draft',
  'wtb_draft',
  // INFO_CARD_TYPES
  'product_list',
  'product',
  'wtb_matches',
  'wtb_request',
  'wtb_request_list',
  'catalog_summary',
  'overview',
  'seller_summary',
  'seller_activity',
  'platform_info',
  'batch_list',
] as const;

/** The shape the strip targets: a lead-in, a "- **Label:** value" dump, a close. */
const REPLY_WITH_FIELDS = [
  "Great — I've put together a draft listing from what you sent. Here are the details:",
  '- **Make:** Beckman Coulter',
  '- **Model:** Avanti J-26S XPI',
  '- **Condition:** Used – functional',
  'Please add a location before publishing.',
].join('\n');

describe('drawnCards', () => {
  it('keeps the types v2 renders', () => {
    const kept = drawnCards([{ type: 'product_list' }, { type: 'wtb_draft' }]);
    expect(kept?.map((c) => c.type)).toEqual(['product_list', 'wtb_draft']);
  });

  it('drops the types v2 does not render', () => {
    expect(drawnCards([{ type: 'catalog_summary' }, { type: 'batch_list' }])).toBeUndefined();
  });

  it('keeps only the drawn one from a mixed frame', () => {
    const kept = drawnCards([{ type: 'catalog_summary' }, { type: 'product' }]);
    expect(kept?.map((c) => c.type)).toEqual(['product']);
  });

  it('is undefined, not [], when nothing survives — resolveBotText reads it as "no card"', () => {
    expect(drawnCards([{ type: 'overview' }])).toBeUndefined();
    expect(drawnCards([])).toBeUndefined();
    expect(drawnCards(undefined)).toBeUndefined();
  });
});

describe('prose survives when the card will not be drawn', () => {
  /**
   * The invariant, stated once over every type the sanitizer knows: filtered
   * through `drawnCards`, the text is only ever shortened when v2 has a
   * renderer to show the missing facts in.
   */
  it.each(STRIPPED_BY_SANITIZER)('%s', (type) => {
    const filtered = resolveBotText(REPLY_WITH_FIELDS, drawnCards([{ type }]));

    if (V2_DRAWN_CARD_TYPES.has(type)) {
      // v2 draws it, so stripping is the intended behaviour.
      expect(filtered.length).toBeLessThan(REPLY_WITH_FIELDS.length);
    } else {
      expect(filtered).toBe(REPLY_WITH_FIELDS);
    }
  });

  /** The regression in its original form: unfiltered, the facts disappear. */
  it('WOULD lose the fields if the cards were passed unfiltered', () => {
    const unfiltered = resolveBotText(REPLY_WITH_FIELDS, [{ type: 'listing_draft' }]);
    expect(unfiltered).not.toContain('Beckman Coulter');
    expect(unfiltered.length).toBeLessThan(REPLY_WITH_FIELDS.length);
  });
});
