/**
 * Read-only money on the scan review screen is shown as an ISO CODE, not a symbol.
 *
 * WHY THIS IS PINNED. "$" is ambiguous across USD/AUD/CAD/HKD/SGD, and `NT$`
 * means nothing to most buyers outside Taiwan. On a cross-border B2B
 * marketplace a scrap value or a profit range has to say which currency it is
 * without the reader guessing. These assertions fail if anyone reintroduces the
 * symbol into `formatCurrency`.
 */
import { formatCurrency, CURRENCY_PREFIX } from '../currencyFx';

describe('formatCurrency', () => {
  it('prefixes the ISO code, never the symbol', () => {
    expect(formatCurrency(12500, 'USD')).toBe('USD 12,500');
    expect(formatCurrency(393750, 'TWD')).toBe('TWD 393,750');
  });

  it('never emits $ or NT$', () => {
    for (const c of ['USD', 'TWD'] as const) {
      const out = formatCurrency(1234.5, c);
      expect(out).not.toMatch(/\$/);
      expect(out).not.toMatch(/NT/);
    }
  });

  it('keeps the signed form for profit deltas', () => {
    expect(formatCurrency(4200, 'USD', { signed: true })).toBe('+USD 4,200');
    expect(formatCurrency(-4200, 'USD', { signed: true })).toBe('-USD 4,200');
    // Unsigned by default, so a plain figure is not decorated with '+'.
    expect(formatCurrency(4200, 'USD')).toBe('USD 4,200');
  });

  it('shows USD decimals only when the amount actually has them', () => {
    expect(formatCurrency(12500, 'USD')).toBe('USD 12,500');
    expect(formatCurrency(12500.5, 'USD')).toBe('USD 12,500.50');
  });

  it('rounds TWD to whole units', () => {
    expect(formatCurrency(393750.4, 'TWD')).toBe('TWD 393,750');
  });

  it('still exports the symbols, which the editable price input may use', () => {
    // Kept deliberately: removing them would be a wider change than intended.
    expect(CURRENCY_PREFIX.USD).toBe('$');
    expect(CURRENCY_PREFIX.TWD).toBe('NT$');
  });
});
