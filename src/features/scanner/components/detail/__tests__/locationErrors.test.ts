import { describe, it, expect } from '@jest/globals';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldErrors } from 'react-hook-form';

import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';
import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import { locationErrorAt } from '@/features/scanner/components/detail/locationErrors';

/**
 * These assertions run the REAL schema through the REAL resolver rather than
 * hand-building an error object, because the whole point of `locationErrorAt`
 * is the SHAPE react-hook-form puts location issues in — and a hand-built
 * fixture would just restate my assumption about that shape instead of
 * checking it. `detailSchema` reports a blank row at `['locations', i]` and the
 * array-level rule at `['locations']`, and RHF represents those two
 * differently.
 */
async function errorsFor(locations: string[]) {
  const values: DetailFormInput = {
    ...emptyDetailDefaults(),
    locations,
    locationCountries: locations.map(() => ''),
  };
  const { errors } = await zodResolver(detailSchema)(values, undefined, {
    shouldUseNativeValidation: false,
    fields: {},
  });
  return errors as FieldErrors<DetailFormInput>;
}

describe('locationErrorAt — which address row shows which message', () => {
  it('puts the array-level "at least one" message on row 0', async () => {
    const errors = await errorsFor([]);
    expect(locationErrorAt(errors, 0)).toMatch(/at least one/i);
  });

  it('flags ONLY the blank row when another row is filled', async () => {
    const errors = await errorsFor(['12 Mill Lane, Leeds', '   ']);
    // Row 0 is a real address: it must stay clean, or every row goes red at
    // once and the seller cannot tell which one we mean.
    expect(locationErrorAt(errors, 0)).toBeUndefined();
    expect(locationErrorAt(errors, 1)).toBeTruthy();
  });

  it('returns nothing for every row when all addresses are valid', async () => {
    const errors = await errorsFor(['12 Mill Lane, Leeds', '8 Dock Road, Hull']);
    expect(locationErrorAt(errors, 0)).toBeUndefined();
    expect(locationErrorAt(errors, 1)).toBeUndefined();
  });

  it('does not invent a message for a row index that does not exist', async () => {
    const errors = await errorsFor(['12 Mill Lane, Leeds']);
    expect(locationErrorAt(errors, 5)).toBeUndefined();
  });
});
