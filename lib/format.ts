/**
 * Format utilities using Intl for locale-aware output.
 * @see Web Interface Guidelines: Dates/times and numbers use Intl.
 */

export const formatCurrency = (
  value: number,
  currency = 'USD',
  locale?: string
): string => {
  return new Intl.NumberFormat(locale ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export const formatDecimal = (
  value: number,
  options?: { minFractionDigits?: number; maxFractionDigits?: number }
): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: options?.minFractionDigits ?? 0,
    maximumFractionDigits: options?.maxFractionDigits ?? 2,
  }).format(value)
}

export const formatPercent = (
  value: number,
  options?: { minFractionDigits?: number; maxFractionDigits?: number }
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: options?.minFractionDigits ?? 0,
    maximumFractionDigits: options?.maxFractionDigits ?? 1,
  }).format(value / 100)
}
