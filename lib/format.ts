/**
 * Format utilities using Intl for locale-aware output.
 * @see Web Interface Guidelines: Dates/times and numbers use Intl.
 */

export const formatCurrency = (
  value: number,
  currency = 'USD',
  locale?: string,
  options?: { minFractionDigits?: number; maxFractionDigits?: number }
): string => {
  return new Intl.NumberFormat(locale ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: options?.minFractionDigits ?? 0,
    maximumFractionDigits: options?.maxFractionDigits ?? 0,
  }).format(value)
}

/** USDC amounts with cents — use for yields, fees, and repay estimates. */
export const formatUSDC = (value: number, locale?: string): string =>
  formatCurrency(value, 'USD', locale, {
    minFractionDigits: 2,
    maxFractionDigits: 2,
  })

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

/**
 * Normalize numeric values to a consistent USDC representation.
 * Keeps 2 decimals for UI/state parity across the app.
 */
export const normalizeUSDC = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(2))
}
