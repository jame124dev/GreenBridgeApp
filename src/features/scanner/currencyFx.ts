import type { SupportedCurrency } from '@/stores/scanDraftStore';

// Static FX rate used wherever the seller-app needs to convert a value when
// the currency pill is toggled. Approximate mid-market for USD/TWD as of
// June 2026. Replace with a live API rate (or a backend-provided figure) when
// the product team makes the call.
//
// Adding a third currency means extending `convertPrice` + `formatCurrency`
// with the new arm — both branches here intentionally lock to the 2-currency
// world so callers don't silently fall through with the wrong unit.
export const FX_RATE_TWD_PER_USD = 31.5;

export function convertPrice(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
): number {
  if (from === to) return amount;
  if (from === 'USD' && to === 'TWD') {
    // TWD is typically displayed without sub-units in retail.
    return Math.round(amount * FX_RATE_TWD_PER_USD);
  }
  if (from === 'TWD' && to === 'USD') {
    return Math.round((amount / FX_RATE_TWD_PER_USD) * 100) / 100;
  }
  return amount;
}

export const CURRENCY_PREFIX: Record<SupportedCurrency, string> = {
  USD: '$',
  TWD: 'NT$',
};

/**
 * Format a numeric amount for read-only display ("USD 12,500", "TWD 393,750",
 * "+USD 4,200"). The currency-input component used for the editable price
 * field has its own formatter and shouldn't go through this helper.
 *
 * USD shows two decimals only when the amount has a fractional part — whole
 * scrap-value style numbers come back as "USD 12,500" not "USD 12,500.00".
 *
 * The ISO CODE is deliberate, not the symbol. This is a cross-border B2B
 * marketplace: "$" is ambiguous across USD/AUD/CAD/HKD/SGD and a buyer reading
 * a scrap value or a profit range has to know which currency it is without
 * guessing. `NT$` compounded it by being unfamiliar outside Taiwan. The symbols
 * remain in CURRENCY_PREFIX for the editable price input, where the currency is
 * already chosen right beside the field.
 */
export function formatCurrency(
  amount: number,
  currency: SupportedCurrency,
  opts: { signed?: boolean } = {},
): string {
  const prefix = currency;
  const absAmount = Math.abs(amount);
  let body: string;
  if (currency === 'USD') {
    const hasFraction = absAmount % 1 !== 0;
    body = absAmount.toLocaleString('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    });
  } else {
    body = Math.round(absAmount).toLocaleString('en-US');
  }
  const sign = opts.signed && amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${prefix} ${body}`;
}
