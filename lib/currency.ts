export type DisplayCurrency = 'USD' | 'BRL';

export const DISPLAY_CURRENCY_COOKIE = 'akaashi_pulse_currency';
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'USD';

export function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
  return value === 'USD' || value === 'BRL';
}

export function formatCurrency(
  value: number,
  currency: DisplayCurrency = DEFAULT_DISPLAY_CURRENCY,
  opts?: { maxFrac?: number; minFrac?: number },
): string {
  return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: opts?.minFrac ?? 2,
    maximumFractionDigits: opts?.maxFrac ?? 2,
  }).format(value);
}

export function formatCurrencyPrecise(
  value: number,
  currency: DisplayCurrency = DEFAULT_DISPLAY_CURRENCY,
): string {
  if (value === 0) return currency === 'BRL' ? 'R$ 0' : '$0';
  if (value < 0.01) {
    return formatCurrency(value, currency, { minFrac: 4, maxFrac: 6 });
  }
  return formatCurrency(value, currency);
}

/** Kept for the CLI and older callers whose output is explicitly USD. */
export function formatUSD(value: number, opts?: { maxFrac?: number; minFrac?: number }): string {
  return formatCurrency(value, 'USD', opts);
}

export function formatUSDPrecise(value: number): string {
  return formatCurrencyPrecise(value, 'USD');
}
