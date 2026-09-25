export function formatNumber(n: number, locale = "en") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, notation: n >= 10_000 ? "compact" : "standard" }).format(n);
}
export function formatCurrency(n: number, currency = "USD", locale = "en") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${formatNumber(n, locale)} ${currency}`;
  }
}
export function formatPercent(n: number, locale = "en", fractionDigits = 1) {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits }).format(n)}%`;
}
export function formatDelta(delta: number, locale = "en") {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(delta * 100)}%`;
}
export function formatDate(iso: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}
export function formatMetric(value: number, format: "number" | "currency" | "percent" | "multiplier", locale = "en", unit?: string) {
  switch (format) {
    case "currency":
      return unit ? formatCurrency(value, unit, locale) : formatNumber(value, locale);
    case "percent":
      return formatPercent(value, locale);
    case "multiplier":
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}×`;
    default:
      return `${formatNumber(value, locale)}${unit ? ` ${unit}` : ""}`;
  }
}
