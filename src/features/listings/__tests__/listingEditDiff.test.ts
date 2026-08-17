/**
 * Dirty-field diffing for the seller listing editor.
 *
 * The PATCH contract is "only the changed fields", so these tests are the
 * guard against the two ways that goes wrong: sending a field nobody touched
 * (which under `split` drags the whole listing into admin review for nothing),
 * and dropping a field the seller did change.
 */
import { describe, expect, it } from '@jest/globals';

import {
  buildListingEditChangeSet,
  listingToFormValues,
} from '@/features/listings/listingEditMapping';
import type { ListingEditResource } from '@/features/listings/listingEditTypes';

function resource(over: Partial<ListingEditResource> = {}): ListingEditResource {
  return {
    product_id: 501,
    batch_id: 90,
    seller_id: 7,
    batch_status: 'live',
    is_sold: false,
    fields: {
      title: 'Buchi Rotavapor R-300',
      description: 'Rotary evaporator, single owner.',
      condition: ['usedFunctional'],
      operation_status: ['deinstalled'],
      quantity: 2,
      grade: 'B',
      brand: 'Buchi',
      category_id: '1234',
      category_name: 'Evaporators',
      price_per_unit: '4200',
      price_format: 'buyNow',
      price_currency: 'USD',
      location: 'Taipei, Taiwan',
      marketplace: 'LabGreenbidz',
    },
    images: [
      { attachment_id: 11, url: 'https://cdn/1.jpg' },
      { attachment_id: 12, url: 'https://cdn/2.jpg' },
      { attachment_id: 13, url: 'https://cdn/3.jpg' },
    ],
    pending_edit: null,
    editable: true,
    lock_reason: null,
    ...over,
  };
}

describe('buildListingEditChangeSet', () => {
  it('sends nothing when the seller opened the editor and changed nothing', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual([]);
    expect(out.body).toEqual({});
  });

  it('sends ONLY the edited field, not the whole object', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, description: 'Rotary evaporator, one careful owner.' },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual(['description']);
    expect(out.body).toEqual({ description: 'Rotary evaporator, one careful owner.' });
    expect(Object.keys(out.body)).toHaveLength(1);
  });

  it('reports several edits, ordered for display', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: {
        ...baseline,
        title: 'Buchi Rotavapor R-300 (2019)',
        quantity: 5,
        pricePerUnit: '3900',
      },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual(['title', 'quantity', 'price_per_unit']);
    expect(out.body).toEqual({
      title: 'Buchi Rotavapor R-300 (2019)',
      quantity: 5,
      price_per_unit: '3900',
    });
  });

  it('NEVER sends marketplace — it is not editable in v1', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      // Simulates anything upstream mutating the form value; the diff must
      // still refuse to put it on the wire.
      current: { ...baseline, marketplace: '101machine' },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual([]);
    expect(out.body).not.toHaveProperty('marketplace');
  });

  it('treats whitespace-only retyping as no change', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, title: '  Buchi Rotavapor R-300  ' },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual([]);
  });

  it('treats "4200" and "4200.00" as the same price', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, pricePerUnit: '4200.00' },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual([]);
  });

  it('clears the price when the seller switches to Make offer (create-flow parity)', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, priceFormat: 'offer' },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual(['price_format', 'price_per_unit']);
    expect(out.body.price_format).toBe('offer');
    expect(out.body.price_per_unit).toBe('');
  });

  it('ignores condition reordering but catches a real condition change', () => {
    const res = resource({
      fields: { ...resource().fields, condition: ['usedFunctional', 'forParts'] },
    });
    const baseline = listingToFormValues(res);

    const reordered = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, condition: ['forParts', 'usedFunctional'] },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(reordered.fields).toEqual([]);

    const real = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, condition: ['usedFunctional'] },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(real.fields).toEqual(['condition']);
    expect(real.body.condition).toEqual(['usedFunctional']);
  });

  it('echoes condition back as a scalar when the server sent a scalar', () => {
    const res = resource({
      fields: { ...resource().fields, condition: 'usedFunctional' },
    });
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, condition: ['forParts'] },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.body.condition).toBe('forParts');
  });

  it('maps the installation picker back onto operation_status', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    expect(baseline.installation).toBe('deinstalled');
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, installation: 'installed' },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual(['operation_status']);
    expect(out.body.operation_status).toEqual(['needDeinstall']);
  });

  it('coerces a string quantity from the server before comparing', () => {
    const res = resource({ fields: { ...resource().fields, quantity: '2' } });
    const baseline = listingToFormValues(res);
    const same = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, quantity: 2 },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(same.fields).toEqual([]);
  });

  it('sends the retained images (and the category name) when those change', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, categoryId: '9999' },
      original: res.fields,
      baselineImages: res.images,
      keptImages: [res.images[0], res.images[2]],
      categoryOptions: [{ id: '9999', name: 'Centrifuges' }],
    });
    expect(out.fields).toEqual(['category_id', 'category_name', 'images']);
    expect(out.body.category_id).toBe('9999');
    expect(out.body.category_name).toBe('Centrifuges');
    // IDs, not objects — the server reads `images` as "the photo ids to keep".
    expect(out.body.images).toEqual([11, 13]);
  });

  /**
   * REVIEW GAP: `location`, `brand`, `grade` and `price_currency` each had a
   * diff branch that could be DELETED WHOLESALE with all 45 tests still green
   * — i.e. a seller's edit to any of them would have been silently dropped
   * while the UI said it had been saved. One emission test each, so the branch
   * cannot go missing again.
   */
  it.each([
    ['location', { locations: ['Kaohsiung, Taiwan'] }, 'location', 'Kaohsiung, Taiwan'],
    ['brand', { brand: 'Heidolph' }, 'brand', 'Heidolph'],
    ['grade', { grade: 'C' as const }, 'grade', 'C'],
    ['price_currency', { priceCurrency: 'TWD' as const }, 'price_currency', 'TWD'],
  ])('emits %s when the seller changes it', (_name, patch, wireName, wireValue) => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline, ...patch },
      original: res.fields,
      baselineImages: res.images,
      keptImages: res.images,
    });
    expect(out.fields).toEqual([wireName]);
    expect(out.body[wireName as 'location']).toBe(wireValue);
  });

  it('does not report an image change when nothing was removed', () => {
    const res = resource();
    const baseline = listingToFormValues(res);
    const out = buildListingEditChangeSet({
      baseline,
      current: { ...baseline },
      original: res.fields,
      baselineImages: res.images,
      keptImages: [...res.images],
    });
    expect(out.fields).toEqual([]);
    expect(out.body).not.toHaveProperty('images');
  });
});

describe('listingToFormValues', () => {
  it('reads the contract bag into the shape the scan-detail cards render', () => {
    const v = listingToFormValues(resource());
    expect(v.title).toBe('Buchi Rotavapor R-300');
    expect(v.quantity).toBe(2);
    expect(v.grade).toBe('B');
    expect(v.priceCurrency).toBe('USD');
    expect(v.locations).toEqual(['Taipei, Taiwan']);
    expect(v.marketplace).toBe('101lab');
  });

  it('does not invent values for fields the v1 contract has no slot for', () => {
    const v = listingToFormValues(resource());
    expect(v.model).toBe('');
    expect(v.year).toBe('');
    expect(v.serialNumber).toBe('');
    expect(v.locationCountries).toEqual(['']);
  });

  it('survives a sparse listing without throwing', () => {
    const v = listingToFormValues(resource({ fields: {}, images: [] }));
    expect(v.title).toBe('');
    expect(v.quantity).toBe(1);
    expect(v.grade).toBe('A');
    expect(v.condition).toEqual([]);
    expect(v.installation).toBe('deinstalled');
  });
});
