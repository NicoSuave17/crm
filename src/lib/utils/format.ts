const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "\u20AC",
  GBP: "\u00A3",
  JPY: "\u00A5",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF ",
  BRL: "R$",
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

export function formatCurrency(value: string | number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";

  const symbol = currency ? getCurrencySymbol(currency) : "$";

  if (num >= 1_000_000) {
    return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${symbol}${(num / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${num.toFixed(0)}`;
}

/**
 * Format totals grouped by currency. Returns a string like "$50K / €10K"
 * or a single value if all deals share the same currency.
 */
export function formatCurrencyTotals(
  items: { value: string | number | null; currency?: string | null }[]
): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.value === null || item.value === undefined) continue;
    const num = typeof item.value === "string" ? parseFloat(item.value) : item.value;
    if (isNaN(num) || num === 0) continue;
    const cur = item.currency?.toUpperCase() || "USD";
    totals.set(cur, (totals.get(cur) ?? 0) + num);
  }

  if (totals.size === 0) return "";

  // Sort: USD first, then alphabetically
  const sorted = [...totals.entries()].sort((a, b) => {
    if (a[0] === "USD") return -1;
    if (b[0] === "USD") return 1;
    return a[0].localeCompare(b[0]);
  });

  return sorted
    .map(([cur, total]) => formatCurrency(total, cur))
    .join(" / ");
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat().format(value);
}

export function getInitials(firstName: string, lastName?: string | null): string {
  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  return (first + last).toUpperCase();
}
