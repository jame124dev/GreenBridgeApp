// Validation for the seller application form (`app/(lab)/sell/apply.tsx`).
//
// Messages are i18n KEYS, not English — the screen runs them through `t()`, the
// same convention as `src/features/auth/schema.ts`. `.trim()` before `.min(1)`
// means a whitespace-only entry is rejected AND the parsed value is already
// trimmed, so nothing pads the multipart body.
//
// Every field here is required by the form even though the backend accepts
// nulls: an admin cannot review an application with blank company details.
// The two optional documents are handled outside the schema (a file picker has
// no text value to validate) — see `SellerDocs` in
// `@/services/seller/sellerUpgrade`.
import { z } from 'zod';

export const sellerApplicationSchema = z.object({
  companyName: z.string().trim().min(1, 'mobile.seller.apply.companyRequired'),
  taxId: z.string().trim().min(1, 'mobile.seller.apply.taxIdRequired'),
  businessType: z.string().trim().min(1, 'mobile.seller.apply.businessTypeRequired'),
  phone: z.string().trim().min(1, 'mobile.seller.apply.phoneRequired'),
  country: z.string().trim().min(1, 'mobile.seller.apply.countryRequired'),
  reason: z.string().trim().min(1, 'mobile.seller.apply.reasonRequired'),
});

/** Structurally identical to `SellerApplicationInput` — the form's output feeds
 *  `submitSellerUpgrade` unchanged. */
export type SellerApplicationValues = z.infer<typeof sellerApplicationSchema>;
