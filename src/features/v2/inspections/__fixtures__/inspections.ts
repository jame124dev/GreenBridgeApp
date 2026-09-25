/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * Shapes are `InspectionItem` from the web's declared type, so this exercises
 * the real field names rather than a convenient subset.
 *
 * | Row | The case it covers |
 * |---|---|
 * | 1 | `attended` — an image that **actually loads**, several products |
 * | 2 | `scheduled` — the other status, a future site visit |
 * | 3 | **a 104-character title** next to a chip, in a row layout (the tightest case for `minWidth: 0`) |
 * | 4 | **`images: []`** — the placeholder path |
 * | 5 | **a dead image URL** — `onError` must fall back to the same placeholder |
 * | 6 | **`products: []`** — no title, no image, no count; the card must still render its dates |
 * | 7 | **an unparseable `inspection_date`** — `inspectionDate()` returns the em dash rather than "Invalid Date" |
 *
 * ⚠️ Row 1's image is a `data:` URI, not a plausible-looking URL. On the
 * watchlist, seven invented URLs meant every tile showed the placeholder and
 * the working-image path was never exercised at all — a fixture that fails
 * uniformly proves only the fallback. Row 5 keeps a deliberately dead URL so
 * `onError` is still covered.
 */
import type { InspectionItem } from '../types';

/** 8×6 solid PNG — always loads, needs no network, cannot rot. */
const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

export const INSPECTION_FIXTURE: readonly InspectionItem[] = [
  {
    batch_id: 5091,
    inspection_number: 'INS-2026-0412',
    inspection_date: '2026-09-18T09:00:00Z',
    registered_date: '2026-09-02T14:21:00Z',
    status: 'attended',
    products: [
      { title: 'Keysight EDUX1002G Oscilloscope', images: [LOADABLE_IMAGE], category: 'Test & Measurement' },
      { title: 'Fluke 87V Multimeter', images: [], category: 'Test & Measurement' },
      { title: 'Rigol DP832 Power Supply', images: [], category: 'Test & Measurement' },
    ],
  },
  {
    batch_id: 5044,
    inspection_number: 'INS-2026-0455',
    inspection_date: '2026-10-07T13:30:00Z',
    registered_date: '2026-09-19T08:05:00Z',
    status: 'scheduled',
    products: [
      { title: 'Agilent 7890B Gas Chromatograph', images: [LOADABLE_IMAGE], category: 'Chromatography' },
    ],
  },
  {
    batch_id: 4870,
    inspection_number: 'INS-2026-0398',
    inspection_date: '2026-09-11T10:00:00Z',
    registered_date: '2026-08-28T16:40:00Z',
    status: 'attended',
    products: [
      {
        title:
          'Thermo Scientific Sorvall RC-6 Plus Superspeed Centrifuge with F21S-8x50y Fixed Angle Rotor Set',
        images: [LOADABLE_IMAGE],
        category: 'Centrifuges',
      },
      { title: 'Eppendorf 5804R Refrigerated Centrifuge', images: [], category: 'Centrifuges' },
    ],
  },
  {
    batch_id: 4655,
    inspection_number: 'INS-2026-0361',
    inspection_date: '2026-10-22T11:00:00Z',
    registered_date: '2026-09-20T09:12:00Z',
    status: 'scheduled',
    products: [{ title: 'Mettler Toledo XPE205 Analytical Balance', images: [], category: 'Balances' }],
  },
  {
    batch_id: 4402,
    inspection_number: 'INS-2026-0344',
    inspection_date: '2026-09-04T15:00:00Z',
    registered_date: '2026-08-15T11:30:00Z',
    status: 'attended',
    products: [
      {
        title: 'Bruker AVANCE III HD 400 MHz NMR Spectrometer',
        // Resolves to nothing. Without `onError` this is a silent empty box.
        images: ['https://example.invalid/4402.jpg'],
        category: 'Spectroscopy',
      },
    ],
  },
  {
    batch_id: 4310,
    inspection_number: 'INS-2026-0330',
    inspection_date: '2026-11-03T09:30:00Z',
    registered_date: '2026-09-21T13:55:00Z',
    status: 'scheduled',
    // The batch was emptied after registration — the appointment still stands.
    products: [],
  },
  {
    batch_id: 4188,
    inspection_number: 'INS-2026-0318',
    inspection_date: 'not-a-date',
    registered_date: '2026-09-01T10:00:00Z',
    status: 'scheduled',
    products: [
      { title: 'Waters ACQUITY UPLC H-Class Bio System', images: [LOADABLE_IMAGE], category: 'Liquid Chromatography' },
    ],
  },
];
