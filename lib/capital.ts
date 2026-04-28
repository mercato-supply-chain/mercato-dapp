import type { CapitalState } from '@/lib/types'

interface BuildCapitalStateInput {
  wallet: number
  inVault: number
  allocated: number
}

export function buildCapitalState({
  wallet,
  inVault,
  allocated,
}: BuildCapitalStateInput): CapitalState {
  return {
    wallet: normalize(wallet),
    inVault: normalize(inVault),
    allocated: normalize(allocated),
  }
}

export function totalCapital(state: CapitalState): number {
  return normalize(state.wallet + state.inVault + state.allocated)
}

export function availableCapital(state: CapitalState): number {
  return state.wallet
}

function normalize(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Number(value.toFixed(2))
}
