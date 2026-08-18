import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';

// lucide icons are ESM-ish and not in transformIgnorePatterns; same Proxy mock the
// chat characterization suites use (src/features/lab/chat/__tests__/cards.characterization.test.tsx:25-29).
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});

import { ProfitIntelligenceCard } from '@/features/scanner/components/detail/ProfitIntelligenceCard';
import { emptyDetailDefaults } from '@/features/scanner/components/detail/formMapping';
import type { DetailFormInput } from '@/features/scanner/schema';
import type { AiPrices } from '@/features/scanner/smartDetectionTypes';

function Harness({ aiPrices }: { aiPrices?: AiPrices | null }) {
  const form = useForm<DetailFormInput>({ defaultValues: emptyDetailDefaults() });
  return (
    <FormProvider {...form}>
      <ProfitIntelligenceCard aiPrices={aiPrices} />
    </FormProvider>
  );
}

// L1 from the measured DEV set (SCAN_FLOW_BACKEND.md:364): scrap 100-300,
// used 3000-6000 -> the old card rendered "999% more than scrap value alone".
const L1: AiPrices = {
  scrap: { min: 100, max: 300 },
  used: { min: 3000, max: 6000 },
  currency: 'USD',
};

describe('ProfitIntelligenceCard — honesty (M-5)', () => {
  it('renders no fabricated figures when the AI returned no tiers', () => {
    const { queryByText, getByText } = render(<Harness aiPrices={null} />);
    // The deleted static stub: 12,500 / 4,200 / 33.
    expect(queryByText(/12,500/)).toBeNull();
    expect(queryByText(/4,200/)).toBeNull();
    expect(queryByText(/33%/)).toBeNull();
    // An honest empty state instead of a half-empty card.
    expect(getByText(/No price estimate/i)).toBeTruthy();
    // ...and no AI badge on content the AI never produced.
    expect(queryByText('AI')).toBeNull();
    // ...and no disclaimer about an estimate that does not exist. The
    // `mobile.detail.profitAiEstimate` row used to sit OUTSIDE the `figures`
    // ternary, so the empty state said "No price estimate" and then, two lines
    // below, "AI estimate — verify before publishing". The populated case below
    // asserts the disclaimer IS present; this is the other half of that pair.
    expect(queryByText(/AI estimate/i)).toBeNull();
    expect(queryByText(/verify before publishing/i)).toBeNull();
  });

  it('never renders a percentage, capped or otherwise', () => {
    const { queryByText } = render(<Harness aiPrices={L1} />);
    expect(queryByText(/999/)).toBeNull();
    expect(queryByText(/more than scrap/i)).toBeNull();
    expect(queryByText(/%/)).toBeNull();
  });

  it('keeps the AI ranges and labels them as an estimate', () => {
    const { getByText } = render(<Harness aiPrices={L1} />);
    expect(getByText('USD 100 – USD 300')).toBeTruthy();       // scrap range
    expect(getByText('+USD 2,700 – +USD 5,900')).toBeTruthy();  // used.min-scrap.max .. used.max-scrap.min
    expect(getByText(/AI estimate/i)).toBeTruthy();
    expect(getByText('AI')).toBeTruthy();                       // badge IS honest here
  });

  it('never names a marketplace (the old suggestion was circular)', () => {
    const { queryByText } = render(<Harness aiPrices={L1} />);
    expect(queryByText(/101LAB|101MACHINE|101IT|101RECYCLE/)).toBeNull();
  });
});
