/**
 * The review-policy mirror.
 *
 * The seller is told which of their edits needs approval BEFORE they save, so
 * these buckets are user-facing promises, not internal detail. They also have
 * to stay switchable by config: the owner may move between Option A/B/C after
 * seeing it, and that must not mean editing branching logic.
 */
import { describe, expect, it } from '@jest/globals';

import {
  groupNeedsReview,
  resolveEditMode,
  reviewOutcomeFor,
  splitByPolicy,
} from '@/features/listings/listingEditPolicy';
import { makeListingEditSchema, listingToFormValues } from '@/features/listings/listingEditMapping';

describe('split (Option C, the default)', () => {
  it('applies the contract instant bucket immediately', () => {
    for (const f of ['description', 'quantity', 'location', 'operation_status', 'grade']) {
      expect(reviewOutcomeFor(f, 'split')).toBe('instant');
    }
  });

  it('holds the contract review bucket for admin', () => {
    for (const f of [
      'title',
      'price_per_unit',
      'price_format',
      'price_currency',
      'category_id',
      'category_name',
      'images',
    ]) {
      expect(reviewOutcomeFor(f, 'split')).toBe('review');
    }
  });

  it('defaults an unknown field to review rather than over-promising', () => {
    expect(reviewOutcomeFor('some_future_field', 'split')).toBe('review');
  });

  it('partitions a mixed card without losing a field', () => {
    const out = splitByPolicy(
      ['quantity', 'price_format', 'price_per_unit', 'price_currency'],
      'split',
    );
    expect(out.instant).toEqual(['quantity']);
    expect(out.review).toEqual(['price_format', 'price_per_unit', 'price_currency']);
  });
});

describe('the other two modes are the same table, switched', () => {
  it('instant (Option A) applies everything, including the review bucket', () => {
    expect(reviewOutcomeFor('title', 'instant')).toBe('instant');
    expect(reviewOutcomeFor('images', 'instant')).toBe('instant');
    expect(splitByPolicy(['title', 'description'], 'instant').review).toEqual([]);
  });

  it('review_all (Option B) holds everything, including the instant bucket', () => {
    expect(reviewOutcomeFor('description', 'review_all')).toBe('review');
    expect(reviewOutcomeFor('quantity', 'review_all')).toBe('review');
    expect(splitByPolicy(['description', 'quantity'], 'review_all').instant).toEqual([]);
  });
});

describe('groupNeedsReview', () => {
  it('is true when any one field in a section is held', () => {
    expect(groupNeedsReview(['title', 'brand'], 'split')).toBe(true);
  });
  it('is false for a wholly instant section', () => {
    expect(groupNeedsReview(['location', 'operation_status'], 'split')).toBe(false);
  });
});

describe('resolveEditMode', () => {
  it('defaults to split, the contract default', () => {
    expect(resolveEditMode(undefined)).toBe('split');
    expect(resolveEditMode(null)).toBe('split');
  });

  it('honours a mode echoed by the server', () => {
    expect(resolveEditMode('instant')).toBe('instant');
    expect(resolveEditMode('review_all')).toBe('review_all');
  });

  it('ignores a value that is not one of the three modes', () => {
    expect(resolveEditMode('whatever')).toBe('split');
  });
});

describe('makeListingEditSchema — "you can change it, you can\'t blank it"', () => {
  const full = listingToFormValues({
    product_id: 1,
    fields: {
      title: 'A pump',
      description: 'Works fine',
      category_id: '12',
      condition: ['usedFunctional'],
      price_per_unit: '100',
      price_format: 'buyNow',
      price_currency: 'USD',
      quantity: 1,
      grade: 'A',
      location: 'Taipei',
    },
    images: [],
    pending_edit: null,
    editable: true,
    lock_reason: null,
  });

  it('accepts the listing exactly as loaded', () => {
    expect(makeListingEditSchema(full).safeParse(full).success).toBe(true);
  });

  it('rejects blanking a field the listing had', () => {
    const res = makeListingEditSchema(full).safeParse({ ...full, title: '   ' });
    expect(res.success).toBe(false);
  });

  it('does NOT demand a field the listing never had', () => {
    // A legacy/imported listing with no address must still allow a description
    // edit — otherwise an unrelated empty field locks the seller out entirely.
    const sparse = { ...full, locations: [''], categoryId: '', condition: [] };
    const schema = makeListingEditSchema(sparse);
    expect(schema.safeParse({ ...sparse, description: 'Updated text' }).success).toBe(true);
  });

  it('still requires a price while the format is Buy now', () => {
    const res = makeListingEditSchema(full).safeParse({ ...full, pricePerUnit: '' });
    expect(res.success).toBe(false);
  });

  it('drops that requirement once the format is Make offer', () => {
    const res = makeListingEditSchema(full).safeParse({
      ...full,
      priceFormat: 'offer',
      pricePerUnit: '',
    });
    expect(res.success).toBe(true);
  });
});
