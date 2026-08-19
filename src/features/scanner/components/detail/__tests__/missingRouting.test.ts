import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { isRoutingResolved } from '@/features/scanner/routing/routingState';
import { detailSchema } from '@/features/scanner/schema';
import type { DraftItem } from '@/stores/scanDraftStore';

/**
 * C4 — the single-mode Submit guard.
 *
 * `missingRouting()` itself needs the RHF + i18n + store harness this repo does
 * not fund for hooks, so what is pinned here is (a) the decision it makes,
 * (b) the fact that the DRAFT field is invisible to `detailSchema` — which is
 * C4's entire point — and (c) from SOURCE, that the guard is actually WIRED into
 * `submitSingleValidated`. (c) matters because (a) and (b) both stay green if
 * someone deletes the call: after Phase 5 the footer's `allRequired` no longer
 * gates the single-mode Submit at all, so the call site IS the feature.
 */
const draft = (over: Partial<DraftItem>): DraftItem => ({ ...over }) as DraftItem;

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const CONTROLLER = 'src/features/scanner/components/detail/useDetailController.ts';

describe('C4 — the single-mode submit guard', () => {
  it('refuses an unconfirmed draft', () => {
    expect(isRoutingResolved(draft({ marketplaceConfirmed: false }))).toBe(false);
  });

  it('allows a confirmed draft and a legacy 1.0.3 draft', () => {
    expect(isRoutingResolved(draft({ marketplaceConfirmed: true }))).toBe(true);
    expect(isRoutingResolved(draft({}))).toBe(true);
  });

  // ⛔ C4 — this is WHY the guard must exist. `marketplaceConfirmed` is a DRAFT
  // field, so `handleSubmit`/`onInvalid` can never fire for it and ANDing
  // `isRoutingResolved` into the footer's `allRequired` is a silent no-op on the
  // single-item path. If this ever fails because the field became a schema
  // field, delete the guard and use `onInvalid` instead.
  it('marketplaceConfirmed is NOT a detailSchema field', () => {
    // `detailSchema` is z.object(...).superRefine(...), so there is no top-level
    // `.shape`. Prove the blindness behaviourally instead: zod strips unknown
    // keys, so the field cannot survive a parse and cannot be validated.
    const parsed = detailSchema.safeParse({
      title: 't',
      description: 'd',
      categoryId: '5375',
      condition: ['used'],
      operationStatus: ['working'],
      priceFormat: 'buyNow',
      pricePerUnit: '100',
      priceCurrency: 'USD',
      quantity: 1,
      locations: ['Taipei'],
      locationCountries: ['TW'],
      grade: 'A',
      marketplace: '101lab',
      installation: 'deinstalled',
      listingDurationDays: 90,
      // The routing answer the seller has NOT given:
      marketplaceConfirmed: false,
    } as unknown as Record<string, unknown>);
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {})).not.toContain('marketplaceConfirmed');
  });

  it('is actually called from submitSingleValidated', () => {
    const src = fs.readFileSync(path.join(ROOT, CONTROLLER), 'utf8');
    expect(src).toContain('const missingRouting = (): boolean => {');
    expect(src).toContain('isRoutingResolved(draftNow)');
    // The call, immediately after the photos guard, inside the VALID path.
    expect(src).toContain('if (missingPhotos()) return;\n    if (missingRouting()) return;');
    // Phase 5's seam comment must be GONE — leaving it tells the next reader the
    // work is still outstanding.
    expect(src).not.toContain('SEAM FOR PHASE 4');
  });
});
