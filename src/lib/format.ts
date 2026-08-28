export function formatMoney(
  amount: number,
  currency: string,
  opts: { decimals?: number; sign?: boolean } = {},
) {
  const decimals =
    opts.decimals ?? (Math.abs(amount) >= 100 ? 0 : Math.abs(amount) >= 10 ? 2 : 2);
  const value = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = opts.sign && amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${prefix}${currency}${value}`;
}

/** Sub-unit precision — a single cigarette often costs less than a coin. */
export function formatUnitCost(amount: number, currency: string) {
  if (!Number.isFinite(amount) || amount <= 0) return `${currency}0.00`;
  const decimals = amount < 1 ? 3 : 2;
  return `${currency}${amount.toFixed(decimals)}`;
}

export function formatCount(value: number, decimals = 1) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(decimals);
}

export function formatPercent(value: number, decimals = 0) {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${Math.abs(count) === 1 ? singular : plural}`;
}
