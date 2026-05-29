import { describe, it, expect } from '@jest/globals';

import { mapAnalyzeResponse } from '../mapAnalyze';

// Behavior matrix mirrors GreenBridgeSeller's mapAiToForm test cases. The AI
// response is unpredictable (year as number/string, fields missing, condition
// as string vs string[]) — keep web + mobile aligned so a scan from either
// platform fills the form identically.

describe('mapAnalyzeResponse', () => {
  it('returns empty/default fields for an empty AI response', () => {
    const r = mapAnalyzeResponse({});
    expect(r.name).toBe('');
    expect(r.description).toBe('');
    expect(r.brand).toBe('');
    expect(r.model).toBe('');
    expect(r.year).toBe('');
    expect(r.weight).toBe('');
    expect(r.dimensions).toBe('');
    expect(r.co2Emissions).toBe('');
    expect(r.grade).toBe('A');
    expect(r.suggestedPrice).toBeNull();
    expect(r.currency).toBe('USD');
  });

  it('extracts the full spec block from a complete AI response', () => {
    const r = mapAnalyzeResponse({
      name: 'Agilent 1260 Infinity HPLC',
      brand: 'Agilent',
      model: '1260 Infinity',
      year: 2018,
      weight: '50 kg',
      dimensions: '100x80x120 cm',
      co2_emissions: '2.3',
      grade: 'B',
      equipment_description: 'A great HPLC',
      condition: 'used',
      currency: 'USD',
      price: { reselling_price: '12500' },
    });
    expect(r.name).toBe('Agilent 1260 Infinity HPLC');
    expect(r.brand).toBe('Agilent');
    expect(r.model).toBe('1260 Infinity');
    expect(r.year).toBe('2018');
    expect(r.weight).toBe('50 kg');
    expect(r.dimensions).toBe('100x80x120 cm');
    expect(r.co2Emissions).toBe('2.3');
    expect(r.grade).toBe('B');
    expect(r.suggestedPrice).toBe('12500');
    expect(r.currency).toBe('USD');
  });

  it('coerces year as a number to a trimmed string', () => {
    expect(mapAnalyzeResponse({ year: 1914 }).year).toBe('1914');
  });

  it('trims whitespace on string spec values', () => {
    const r = mapAnalyzeResponse({
      brand: '  Bruker  ',
      model: '\tD8 Advance\n',
    });
    expect(r.brand).toBe('Bruker');
    expect(r.model).toBe('D8 Advance');
  });

  it('defaults grade to A when missing or unparseable', () => {
    expect(mapAnalyzeResponse({}).grade).toBe('A');
    expect(mapAnalyzeResponse({ grade: '' }).grade).toBe('A');
    expect(mapAnalyzeResponse({ grade: 'Z' }).grade).toBe('A');
    expect(mapAnalyzeResponse({ grade: null }).grade).toBe('A');
  });

  it('uppercases lowercase grade input', () => {
    expect(mapAnalyzeResponse({ grade: 'c' }).grade).toBe('C');
  });

  it('accepts each of A/B/C/D verbatim', () => {
    for (const g of ['A', 'B', 'C', 'D'] as const) {
      expect(mapAnalyzeResponse({ grade: g }).grade).toBe(g);
    }
  });

  it('maps TWD currency and falls back to USD for everything else', () => {
    expect(mapAnalyzeResponse({ currency: 'TWD' }).currency).toBe('TWD');
    expect(mapAnalyzeResponse({ currency: 'USD' }).currency).toBe('USD');
    expect(mapAnalyzeResponse({ currency: 'EUR' }).currency).toBe('USD');
    expect(mapAnalyzeResponse({}).currency).toBe('USD');
  });

  it('handles null spec values without throwing', () => {
    const r = mapAnalyzeResponse({
      brand: null,
      model: undefined,
      year: null,
      weight: '',
    });
    expect(r.brand).toBe('');
    expect(r.model).toBe('');
    expect(r.year).toBe('');
    expect(r.weight).toBe('');
  });

  it('preserves partial responses — only set fields populate', () => {
    const r = mapAnalyzeResponse({
      name: 'Test',
      brand: 'OnlyBrand',
    });
    expect(r.name).toBe('Test');
    expect(r.brand).toBe('OnlyBrand');
    // Everything else stays at defaults.
    expect(r.model).toBe('');
    expect(r.year).toBe('');
    expect(r.weight).toBe('');
    expect(r.grade).toBe('A');
  });

  // ── W2 (scan_v3): site_type → suggestedMarketplace + integer-price defense.
  describe('W2 — site_type extraction', () => {
    it('maps backend canonical site_type values to MarketplaceKey', () => {
      expect(mapAnalyzeResponse({ site_type: 'LabGreenbidz' }).suggestedMarketplace).toBe('101lab');
      expect(mapAnalyzeResponse({ site_type: 'machines' }).suggestedMarketplace).toBe('101machine');
      expect(mapAnalyzeResponse({ site_type: '101it' }).suggestedMarketplace).toBe('101it');
      expect(mapAnalyzeResponse({ site_type: 'recycle' }).suggestedMarketplace).toBe('101recycle');
    });

    it('returns null suggestedMarketplace when site_type is missing or unknown', () => {
      expect(mapAnalyzeResponse({}).suggestedMarketplace).toBeNull();
      expect(mapAnalyzeResponse({ site_type: '' }).suggestedMarketplace).toBeNull();
      expect(mapAnalyzeResponse({ site_type: 'bogus' }).suggestedMarketplace).toBeNull();
      expect(mapAnalyzeResponse({ site_type: null }).suggestedMarketplace).toBeNull();
    });

    it('case-insensitive substring match: "Machines" → 101machine', () => {
      expect(mapAnalyzeResponse({ site_type: 'Machines' }).suggestedMarketplace).toBe('101machine');
      expect(mapAnalyzeResponse({ site_type: 'RECYCLE' }).suggestedMarketplace).toBe('101recycle');
    });
  });

  describe('W2 — integer-price defense (B5)', () => {
    it('reads a bare integer price (new backend prompt shape)', () => {
      // Backend prompt now: "return a single integer (no decimals, no currency
      // symbol, no ranges). Never return an object or array."
      expect(mapAnalyzeResponse({ price: 1234 }).suggestedPrice).toBe('1234');
    });

    it('reads a bare numeric string price', () => {
      expect(mapAnalyzeResponse({ price: '500' }).suggestedPrice).toBe('500');
    });

    it('still reads the legacy nested-object shape { reselling_price }', () => {
      // The defensive `pickPrice` keeps the old shape working so a partial
      // server rollout doesn't lose AI prices.
      expect(mapAnalyzeResponse({ price: { reselling_price: '12500' } }).suggestedPrice).toBe('12500');
    });

    it('returns null when price is missing or unparseable', () => {
      expect(mapAnalyzeResponse({}).suggestedPrice).toBeNull();
      expect(mapAnalyzeResponse({ price: null }).suggestedPrice).toBeNull();
      expect(mapAnalyzeResponse({ price: '' }).suggestedPrice).toBeNull();
    });

    it('rounds floating-point prices to an integer', () => {
      expect(mapAnalyzeResponse({ price: 1234.7 }).suggestedPrice).toBe('1235');
    });
  });
});
