import { z } from 'zod';

// S1 expansion (web parity). Keeps required fields strict (title, description,
// category, condition, operation status, location). New spec fields (brand,
// model, year, etc.) are optional strings — they fold into product_content via
// appendSpecsToDescription rather than going through their own backend slots.
//
// `priceCurrency` is widened from the locked `USD|TWD` union to the 6-item set
// that the rest of the app already uses (see `src/features/settings/constants.ts`
// CURRENCY_OPTIONS). Backend treats it as an opaque string
// (controller/wordPressV2.js:360 just forwards to `_product_currency` meta)
// so the constraint is mobile-side only — guarding against typos, not a real
// server-side enum. If broader currency support is needed later this is the
// single line to update.

const SUPPORTED_CURRENCIES = ['USD', 'TWD', 'HKD', 'CNY', 'JPY', 'THB'] as const;

export const detailSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  // Category display name — clears in lockstep with categoryId when the
  // marketplace switches (W3 carry-forward; web parity with ReviewSubmitScreen).
  categoryName: z.string().optional(),
  condition: z.array(z.string()).min(1, 'Select at least one condition'),
  operationStatus: z.array(z.string()).min(1, 'Select operation status'),
  priceFormat: z.enum(['buyNow', 'offer']),
  pricePerUnit: z.string().optional(),
  priceCurrency: z.enum(SUPPORTED_CURRENCIES),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  // S5.2: multi-location. `locations` must have ≥1 non-empty entry;
  // `locationCountries` is parallel (one country per location row, optional
  // per-row). superRefine below enforces array-length parity and trims empty
  // location strings before counting.
  locations: z.array(z.string()).min(1, 'At least one pickup location is required'),
  locationCountries: z.array(z.string()),
  // ── S1 spec fields (all optional — fold into description) ────────────────
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  weight: z.string().optional(),
  dimensions: z.string().optional(),
  co2Emissions: z.string().optional(),
  // Required with a hard default in emptyDraft(); enum guards against typos.
  grade: z.enum(['A', 'B', 'C', 'D']),
  serialNumber: z.string().optional(),
  // ── S1 fields pulled forward from S5 per reviewer Note #3 ────────────────
  marketplace: z.enum(['101lab', '101machine', '101recycle', '101it']),
  installation: z.enum(['installed', 'deinstalled']),
  // Captured even though backend doesn't accept the field yet — S5 hides the
  // UI per reviewer Note #6 until backend lands the slot.
  listingDurationDays: z.number().int().positive(),
}).superRefine((data, ctx) => {
  if (data.priceFormat === 'buyNow' && !data.pricePerUnit?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Price is required for buy now',
      path: ['pricePerUnit'],
    });
  }
  // S5.2: every visible row must have a non-empty address. Empty rows are a
  // UI artifact ("Add location" then never typed) — flag as required so the
  // submit gate locks until the user fills or removes the row.
  data.locations.forEach((loc, i) => {
    if (!loc.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Address is required',
        path: ['locations', i],
      });
    }
  });
  // Parallel-array invariant — should never trip if UI is consistent, but
  // guards against future readers assuming length parity.
  if (data.locationCountries.length !== data.locations.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Internal: location and country arrays must be the same length',
      path: ['locationCountries'],
    });
  }
});

export type DetailFormInput = z.infer<typeof detailSchema>;
