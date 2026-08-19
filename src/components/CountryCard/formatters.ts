export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', opts).format(value);
}

export function formatCompact(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
}
