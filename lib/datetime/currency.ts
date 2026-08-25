import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "./constants";

export function formatCurrency(
  amount: number,
  options: { currency?: string; locale?: string } = {},
): string {
  const currency = options.currency ?? DEFAULT_CURRENCY;
  const locale = options.locale ?? DEFAULT_LOCALE;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number, options: { locale?: string } = {}): string {
  const locale = options.locale ?? DEFAULT_LOCALE;
  return new Intl.NumberFormat(locale).format(value);
}
