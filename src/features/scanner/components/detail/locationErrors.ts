import type { FieldErrors } from 'react-hook-form';

import type { DetailFormInput } from '@/features/scanner/schema';

/**
 * Which message, if any, belongs under address row `index`.
 *
 * Extracted from `LocationCard` so it can be tested without standing up the
 * whole card — rendering it needs the device-location service, the user
 * profile and the scan-draft store, none of which this mapping touches.
 *
 * `detailSchema` emits location issues at TWO different paths and they mean
 * different things:
 *
 *   - `['locations', i]`  — THIS row is empty or whitespace (the superRefine
 *     loop). One message per offending row, so with three addresses and the
 *     second one blank, only the second row should turn red.
 *   - `['locations']`     — the array-level `.min(1)`, "at least one pickup
 *     location is required". It belongs to no particular row, so it is shown
 *     on the first one, which is the only row that exists in that state.
 *
 * React Hook Form represents the first as an ARRAY of per-index error objects
 * and the second as a plain object with `.message`, and an array can carry a
 * `message` of its own — hence the ordering below: a row's own issue always
 * wins over the array-level one.
 */
export function locationErrorAt(
  errors: FieldErrors<DetailFormInput>,
  index: number,
): string | undefined {
  const locationErrors = errors.locations;
  if (!locationErrors) return undefined;

  const rowIssue = Array.isArray(locationErrors) ? locationErrors[index] : undefined;
  if (rowIssue?.message) return String(rowIssue.message);

  if (index === 0 && !Array.isArray(locationErrors) && locationErrors.message) {
    return String(locationErrors.message);
  }
  return undefined;
}
