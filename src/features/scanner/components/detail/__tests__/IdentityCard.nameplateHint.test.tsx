import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (typeof opts === 'string') return opts;
      return (opts as { defaultValue?: string } | undefined)?.defaultValue ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

import { IdentityCard } from '../IdentityCard';
import type { DetailFormInput } from '@/features/scanner/schema';

/**
 * ⛔ FIX 1b (2026-08-20) — WHERE THE UNREADABLE PHOTO GOES.
 *
 * FIX 1 stopped `needs_clearer_photo` from forcing a MARKETPLACE question,
 * because the server flag means "I could not read a nameplate" — a statement
 * about BRAND and MODEL. The flag must not silently disappear with the question,
 * so it is surfaced here, on the two fields it is actually about, plus
 * `routingWhyLine`'s `whyNoNameplate` on the confirmed routing card.
 *
 * ONE hint for the PAIR, under the row, not one per field: brand and model share
 * a `flex-row` so each column is roughly half the card, and a sentence repeated
 * in both would wrap to three lines twice and say the same thing about one photo.
 *
 * QUIET BY CONSTRUCTION: it renders only while something is still missing. A
 * seller who has typed both values has already answered, and a warning on a
 * field the seller corrected themselves is exactly the noise this work removes.
 */
const HINT =
  "We couldn't read the nameplate in your photos — add what you know, or retake a closer shot.";

function Harness({
  needsClearerPhoto,
  brand = '',
  model = '',
  variant,
}: {
  needsClearerPhoto?: boolean;
  brand?: string;
  model?: string;
  variant?: 'draft' | 'edit';
}) {
  const form = useForm<DetailFormInput>({
    defaultValues: { title: '', brand, model, year: '' } as DetailFormInput,
  });
  return (
    <FormProvider {...form}>
      <IdentityCard variant={variant} needsClearerPhoto={needsClearerPhoto} />
    </FormProvider>
  );
}

describe('IdentityCard — the illegible-nameplate hint (FIX 1b)', () => {
  it('says so on brand/model when the server could not read the nameplate', () => {
    const { getByText } = render(<Harness needsClearerPhoto brand="" model="" />);
    expect(getByText(HINT)).toBeTruthy();
  });

  it('stays silent when the photo was fine — this is not a permanent label', () => {
    const { queryByText } = render(
      <Harness needsClearerPhoto={false} brand="" model="" />,
    );
    expect(queryByText(HINT)).toBeNull();
  });

  it('stays silent when the prop is absent, so every other screen is unchanged', () => {
    const { queryByText } = render(<Harness brand="" model="" />);
    expect(queryByText(HINT)).toBeNull();
  });

  // ⛔ "honest and quiet": no warning on a field the seller has already fixed.
  it('disappears once the seller has supplied BOTH brand and model', () => {
    const { queryByText } = render(
      <Harness needsClearerPhoto brand="Agilent" model="1200 Series" />,
    );
    expect(queryByText(HINT)).toBeNull();
  });

  it('still shows while only one of the two has been filled in', () => {
    expect(
      render(<Harness needsClearerPhoto brand="Agilent" model="" />).queryByText(HINT),
    ).toBeTruthy();
    expect(
      render(<Harness needsClearerPhoto brand="" model="1200 Series" />).queryByText(HINT),
    ).toBeTruthy();
  });

  // Whitespace is not an answer — `' '` would otherwise silence the hint while
  // leaving the field effectively empty on the listing.
  it('treats a whitespace-only value as still missing', () => {
    const { getByText } = render(<Harness needsClearerPhoto brand="   " model="  " />);
    expect(getByText(HINT)).toBeTruthy();
  });

  // The published-listing editor hides MODEL entirely (no v1 edit-contract slot),
  // so there it must judge on BRAND alone rather than on a field the seller
  // cannot even see.
  it('judges on brand alone in the edit variant, where model is not rendered', () => {
    expect(
      render(<Harness needsClearerPhoto variant="edit" brand="" model="" />).queryByText(HINT),
    ).toBeTruthy();
    expect(
      render(<Harness needsClearerPhoto variant="edit" brand="Agilent" model="" />).queryByText(
        HINT,
      ),
    ).toBeNull();
  });
});
