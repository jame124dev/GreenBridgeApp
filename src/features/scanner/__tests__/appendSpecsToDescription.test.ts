import { describe, it, expect } from '@jest/globals';

import { appendSpecsToDescription } from '../appendSpecsToDescription';

// Behavior matrix mirrors GreenBridgeSeller's web implementation in
// utils/mapAiToForm.ts:101-114. Each case here is a 1:1 invariant — keep web
// and mobile aligned so listings created on either platform read identically.

describe('appendSpecsToDescription', () => {
  it('returns description unchanged when no spec fields are populated', () => {
    expect(
      appendSpecsToDescription({ description: 'hello' }),
    ).toBe('hello');
  });

  it('returns empty when description is empty and no specs', () => {
    expect(appendSpecsToDescription({ description: '' })).toBe('');
  });

  it('returns only the spec block when description is empty', () => {
    expect(
      appendSpecsToDescription({
        description: '',
        brand: 'Agilent',
        model: 'HPLC-2000',
      }),
    ).toBe('Brand: Agilent\nModel: HPLC-2000');
  });

  it('appends spec block with --- separator when both description and specs exist', () => {
    expect(
      appendSpecsToDescription({
        description: 'A great instrument.',
        brand: 'Agilent',
        year: '2018',
      }),
    ).toBe('A great instrument.\n\n---\nBrand: Agilent\nYear: 2018');
  });

  it('preserves the fixed spec field order: Brand, Model, Year, Weight, Dimensions, CO2', () => {
    expect(
      appendSpecsToDescription({
        description: 'desc',
        co2Emissions: '2.3',
        dimensions: '100×80×120',
        weight: '50 kg',
        year: '2020',
        model: 'XYZ',
        brand: 'ABC',
      }),
    ).toBe(
      'desc\n\n---\nBrand: ABC\nModel: XYZ\nYear: 2020\nWeight: 50 kg\nDimensions: 100×80×120\nCO2: 2.3',
    );
  });

  it('drops whitespace-only and empty spec values', () => {
    expect(
      appendSpecsToDescription({
        description: 'desc',
        brand: '   ',
        model: '',
        year: 'present',
      }),
    ).toBe('desc\n\n---\nYear: present');
  });

  it('trims spec values before emitting', () => {
    expect(
      appendSpecsToDescription({
        description: 'desc',
        brand: '  Bruker  ',
      }),
    ).toBe('desc\n\n---\nBrand: Bruker');
  });

  it('trims the description before joining with spec block', () => {
    expect(
      appendSpecsToDescription({
        description: '   leading and trailing   ',
        brand: 'X',
      }),
    ).toBe('leading and trailing\n\n---\nBrand: X');
  });

  it('does not touch whitespace inside the description body', () => {
    expect(
      appendSpecsToDescription({
        description: 'line one\nline two',
        brand: 'X',
      }),
    ).toBe('line one\nline two\n\n---\nBrand: X');
  });
});
