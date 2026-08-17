/**
 * The pending-edit / sold / not-owner gate.
 *
 * The product rule these tests exist for: "if a pending edit already exists,
 * show that state rather than letting them submit a second one." A regression
 * here is invisible in the UI right up until two competing edits are sitting in
 * the admin queue for one listing.
 */
import { describe, expect, it } from '@jest/globals';

import {
  canSubmitListingEdit,
  resolveEditGate,
  type ListingEditGate,
} from '@/features/listings/listingEditGate';
import type { ListingEditResource, ListingPendingEdit } from '@/features/listings/listingEditTypes';

const pending: ListingPendingEdit = {
  edit_id: 123,
  status: 'pending',
  submitted_at: '2026-08-16T09:30:00Z',
  changed_fields: { title: { from: 'Old title', to: 'New title' } },
};

function resource(over: Partial<ListingEditResource> = {}): ListingEditResource {
  return {
    product_id: 501,
    fields: {},
    images: [],
    pending_edit: null,
    editable: true,
    lock_reason: null,
    is_sold: false,
    ...over,
  };
}

describe('resolveEditGate', () => {
  it('is editable for an owned, unsold listing with nothing in review', () => {
    expect(resolveEditGate(resource())).toEqual({ kind: 'editable' });
  });

  it('is pendingReview when an edit is already queued, and carries it through', () => {
    const gate = resolveEditGate(resource({ pending_edit: pending }));
    expect(gate.kind).toBe('pendingReview');
    expect(gate).toEqual({ kind: 'pendingReview', pending });
  });

  it('locks a sold listing even when the server still says editable', () => {
    expect(resolveEditGate(resource({ is_sold: true }))).toEqual({
      kind: 'locked',
      reason: 'sold',
    });
  });

  it('prefers "sold" over "pending" when both are set', () => {
    const gate = resolveEditGate(
      resource({ is_sold: true, editable: false, lock_reason: 'sold', pending_edit: pending }),
    );
    expect(gate).toEqual({ kind: 'locked', reason: 'sold' });
  });

  it('reads lock_reason "sold" even when is_sold was not sent', () => {
    expect(resolveEditGate(resource({ editable: false, lock_reason: 'sold' }))).toEqual({
      kind: 'locked',
      reason: 'sold',
    });
  });

  it('reports not-owner distinctly, so the copy can say why', () => {
    expect(resolveEditGate(resource({ editable: false, lock_reason: 'not_owner' }))).toEqual({
      kind: 'locked',
      reason: 'notOwner',
    });
  });

  it('falls back to a generic lock for an unrecognised lock_reason', () => {
    expect(
      resolveEditGate(resource({ editable: false, lock_reason: 'under_investigation' })),
    ).toEqual({ kind: 'locked', reason: 'unknown' });
  });

  it('locks when there is no listing at all', () => {
    expect(resolveEditGate(undefined)).toEqual({ kind: 'locked', reason: 'unknown' });
  });
});

describe('canSubmitListingEdit', () => {
  const editable: ListingEditGate = { kind: 'editable' };

  it('enables save once something has actually changed', () => {
    expect(canSubmitListingEdit({ gate: editable, changedCount: 1, saving: false })).toBe(true);
  });

  it('keeps save disabled while nothing has changed', () => {
    expect(canSubmitListingEdit({ gate: editable, changedCount: 0, saving: false })).toBe(false);
  });

  it('keeps save disabled while a save is in flight', () => {
    expect(canSubmitListingEdit({ gate: editable, changedCount: 3, saving: true })).toBe(false);
  });

  it('refuses a SECOND submission while one edit is already in review', () => {
    expect(
      canSubmitListingEdit({
        gate: { kind: 'pendingReview', pending },
        changedCount: 4,
        saving: false,
      }),
    ).toBe(false);
  });

  it('refuses a submission on a sold listing', () => {
    expect(
      canSubmitListingEdit({
        gate: { kind: 'locked', reason: 'sold' },
        changedCount: 4,
        saving: false,
      }),
    ).toBe(false);
  });
});
