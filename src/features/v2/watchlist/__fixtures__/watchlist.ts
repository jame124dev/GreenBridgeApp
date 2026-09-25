/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * These are RAW rows (`WishlistRow`), not mapped cards, so the fixture
 * exercises `toWishCards()` too: the `attachments` → `image1` fallback, the
 * `&amp;` unescape, the `batch_id || product_id` choice and the
 * product-less row all run on this data rather than being assumed.
 *
 * ⚠️ Fixtures are not real data. Every case below is deliberately awkward
 * because the plausible version of this list is the one that hides bugs:
 *
 * | Row | The case it covers |
 * |---|---|
 * | 1 | the happy one — an image that **actually loads**, a category, a `batch_id` |
 * | 2 | **a 104-character title** — AI-written titles here run past 90, and a 2-up grid is the tightest column in the app |
 * | 3 | **`image1` only** — older rows have no `attachments` array at all |
 * | 4 | **no image, no category** — both optional fields absent at once |
 * | 5 | **`&amp;` in the category** — WordPress-derived terms arrive HTML-escaped |
 * | 6 | **a dead image URL** — renders an empty box with no error unless `onError` catches it |
 * | 7 | **`product_id` only, no `batch_id`** — a single product rather than a grouped lot |
 * | 8 | **no `product`** — the join is empty when a saved lot has been deleted; must not render |
 *
 * Row 8 is why the count on screen is 7, not 8.
 */
import type { WishlistRow } from '../types';

/**
 * An 8×6 solid PNG as a `data:` URI — the ONE row that actually renders a
 * bitmap.
 *
 * The first version of this fixture used invented URLs
 * (`https://images.greenbidz.com/lots/5091-1.jpg`). They look real and resolve
 * to nothing, so on the device **all seven tiles showed "No photo"** and the
 * working-image path — the `cover` aspect crop, the image-to-body transition,
 * a tile whose top half is a photograph rather than a flat fill — was never
 * exercised at all. A fixture that fails uniformly proves only the fallback.
 *
 * A `data:` URI rather than a real remote image because it needs no network
 * and cannot rot. It does NOT prove remote loading; that is phase 2's job,
 * against real rows. Row 6 keeps a deliberately dead URL so `onError` is still
 * covered.
 */
const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

export const WATCHLIST_FIXTURE: readonly WishlistRow[] = [
  {
    product: {
      batch_id: 5091,
      title: 'Keysight EDUX1002G Oscilloscope',
      attachments: [{ url: LOADABLE_IMAGE }],
      categories: [{ term: 'Test &amp; Measurement' }],
    },
  },
  {
    product: {
      batch_id: 4870,
      title:
        'Thermo Scientific Sorvall RC-6 Plus Superspeed Centrifuge with F21S-8x50y Fixed Angle Rotor Set',
      attachments: [{ url: 'https://images.greenbidz.com/lots/4870-1.jpg' }],
      categories: [{ term: 'Centrifuges' }],
    },
  },
  {
    product: {
      batch_id: 4655,
      title: 'Agilent 7890B Gas Chromatograph',
      image1: 'https://images.greenbidz.com/lots/4655-legacy.jpg',
      categories: [{ term: 'Chromatography' }],
    },
  },
  {
    product: {
      batch_id: 4402,
      title: 'Mettler Toledo XPE205 Analytical Balance',
    },
  },
  {
    product: {
      batch_id: 4310,
      title: 'Bruker AVANCE III HD 400 MHz NMR',
      attachments: [{ url: 'https://images.greenbidz.com/lots/4310-1.jpg' }],
      categories: [{ term: 'Spectroscopy &amp; Imaging' }],
    },
  },
  {
    product: {
      batch_id: 4188,
      title: 'Waters ACQUITY UPLC H-Class Bio System',
      // Resolves to nothing. Without `onError` this is a silent grey box.
      attachments: [{ url: 'https://example.invalid/4188.jpg' }],
      categories: [{ term: 'Liquid Chromatography' }],
    },
  },
  {
    product: {
      product_id: 90211,
      title: 'Eppendorf Research Plus Pipette, 100–1000 µL',
      attachments: [{ url: 'https://images.greenbidz.com/products/90211.jpg' }],
      categories: [{ term: 'Liquid Handling' }],
    },
  },
  // The saved lot was deleted; `toWishCards` must drop this row entirely.
  {},
];
