export function parsePositiveAmount(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function projectedEarnings(amount: number, apy: number) {
  const yearly = amount * (apy / 100)
  return {
    monthly: yearly / 12,
    yearly,
  }
}
