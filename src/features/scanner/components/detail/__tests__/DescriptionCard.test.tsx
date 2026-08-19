import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

// MMKV is a native module with no jest binary, and `@/i18n` pulls it in.
jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));

// Real en resources so the assertions read the SHIPPED copy, not a key.
import '@/i18n';

import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import { detailSchema, type DetailFormInput } from '@/features/scanner/schema';

import { DescriptionCard } from '@/features/scanner/components/detail/DescriptionCard';

/**
 * Device pass 2026-08-19 — the counter rendered "635/500" in plain grey.
 *
 * It is not a typing bug: `maxLength={500}` stops the SELLER at 500, but the
 * AI's own generated description arrives through `reset(draftToFormValues(draft))`
 * and routinely exceeds it (635 measured on a BD FACSVerse scan), so the seller
 * is shown a silently-invalid field with no indication that anything is wrong.
 *
 * In-repo prior art: the lab listing editor already has exactly this state —
 * `LabListingEditSheet.tsx:817` passes `counterOver={descLen > 500}` and
 * `:1293` styles it with `fieldCounterOver`. This card was the odd one out.
 *
 * ⚠️ What these tests can and cannot prove: they prove the counter FLIPS state
 * and that the explanatory line appears with the right overage. They cannot prove
 * the rendered colour — `className` is asserted because nativewind leaves it on
 * the node under jest and it is the only observable for a colour token. If the
 * design system renames the token, this file is the place to update.
 */
const LIMIT = 500;

function renderCard(description: string) {
  function Host() {
    const form = useForm<DetailFormInput>({
      defaultValues: { ...emptyDetailDefaults(), description },
    });
    return (
      <FormProvider {...form}>
        <DescriptionCard />
      </FormProvider>
    );
  }
  return render(<Host />);
}

const counterOf = (utils: ReturnType<typeof renderCard>) =>
  utils.getByTestId('description-counter');

describe('the description counter is honest about the limit', () => {
  it('is quiet and neutral under the limit', () => {
    const utils = renderCard('x'.repeat(97));
    const counter = counterOf(utils);
    expect(counter).toHaveTextContent(`97/${LIMIT}`);
    expect(String(counter.props.className)).toContain('text-brand-placeholder');
    expect(String(counter.props.className)).not.toContain('text-brand-destructive');
    expect(utils.queryByTestId('description-over-limit')).toBeNull();
  });

  it('is still neutral EXACTLY at the limit — 500 is allowed, 501 is not', () => {
    const utils = renderCard('x'.repeat(LIMIT));
    expect(String(counterOf(utils).props.className)).toContain('text-brand-placeholder');
    expect(utils.queryByTestId('description-over-limit')).toBeNull();
  });

  it('turns the counter to the destructive token the moment it goes over', () => {
    const utils = renderCard('x'.repeat(LIMIT + 1));
    const counter = counterOf(utils);
    expect(counter).toHaveTextContent(`501/${LIMIT}`);
    expect(String(counter.props.className)).toContain('text-brand-destructive');
    expect(String(counter.props.className)).not.toContain('text-brand-placeholder');
  });

  it('says how far over it is, in words, on the AI-length description from the device', () => {
    // 635 is the measured length of the AI's own description on the scan in
    // screenshot 18. A red number alone tells the seller something is wrong but
    // not what to do (UX_DESIGN_RULES: every error needs a next step).
    const utils = renderCard('x'.repeat(635));
    expect(counterOf(utils)).toHaveTextContent(`635/${LIMIT}`);
    // Regex, not a bare string: RNTL's toHaveTextContent matches a STRING
    // exactly, so the whole sentence would have to be duplicated here and this
    // test would then fail on a copy tweak rather than on the behaviour.
    const msg = utils.getByTestId('description-over-limit');
    expect(msg).toHaveTextContent(/135 characters/);
    expect(msg).toHaveTextContent(new RegExp(String(LIMIT)));
  });

  it('drops the warning again once the seller has trimmed it', () => {
    const utils = renderCard('x'.repeat(120));
    expect(utils.queryByTestId('description-over-limit')).toBeNull();
    expect(String(counterOf(utils).props.className)).toContain('text-brand-placeholder');
  });
});

/**
 * ⛔ DELIBERATELY PINNING TODAY'S BEHAVIOUR, NOT ENDORSING IT.
 *
 * An over-limit description does NOT block Submit: `detailSchema.description` is
 * `z.string().min(1)` with no `.max`, so `handleSubmit` never sees an error and
 * the 635-character value is what `buildFormData` sends. (`appendSpecsToDescription`
 * can then make it LONGER still at submit time.) That was left unchanged on
 * purpose in this fix set — the AI itself generates over-limit copy, so making it
 * a hard gate would block the happy path on a seller who did nothing wrong, and
 * that is a product call with a backend question attached (does the API truncate,
 * reject, or store it?).
 *
 * If product decides to block: add `.max(500)` in `schema.ts`, delete this test,
 * and soften the counter copy from "please shorten it" to whatever the gate says.
 * Until then this test is the record that the counter is a WARNING.
 */
describe('an over-limit description is a warning, not a submit gate (today)', () => {
  it('detailSchema still accepts 635 characters', () => {
    const parsed = detailSchema.safeParse({
      ...emptyDetailDefaults(),
      title: 'BD FACSVerse',
      description: 'x'.repeat(635),
      categoryId: '5375',
      condition: ['used'],
      operationStatus: ['working'],
      pricePerUnit: '100',
      locations: ['Taipei'],
      locationCountries: ['TW'],
      parentCategoryId: '5375',
      parentCategoryName: 'Lab Infrastructure & Essentials',
    } as unknown as Record<string, unknown>);
    expect(parsed.success).toBe(true);
  });
});
