import { describe, expect, test } from 'bun:test'
import {
  buildVaultPositionSummary,
  computeVaultOwnershipBreakdown,
} from '@/lib/defindex/vault-position'

describe('computeVaultOwnershipBreakdown', () => {
  test('no user position: others hold the full TVL', () => {
    const b = computeVaultOwnershipBreakdown({ userPositionDisplay: 0, vaultTvlDisplay: 100 })
    expect(b.hasPosition).toBe(false)
    expect(b.othersDisplay).toBe(100)
    expect(b.userSharePercent).toBe(0)
    expect(b.othersSharePercent).toBe(100)
  })

  test('user position but zero TVL: treated as sole depositor', () => {
    const b = computeVaultOwnershipBreakdown({ userPositionDisplay: 50, vaultTvlDisplay: 0 })
    expect(b.isSoleDepositor).toBe(true)
    expect(b.userSharePercent).toBe(100)
    expect(b.othersDisplay).toBe(0)
  })

  test('partial ownership splits shares proportionally', () => {
    const b = computeVaultOwnershipBreakdown({ userPositionDisplay: 25, vaultTvlDisplay: 100 })
    expect(b.userSharePercent).toBe(25)
    expect(b.othersSharePercent).toBe(75)
    expect(b.othersDisplay).toBe(75)
    expect(b.isSoleDepositor).toBe(false)
  })

  test('caps the user position at the TVL and clamps negatives', () => {
    const b = computeVaultOwnershipBreakdown({ userPositionDisplay: 150, vaultTvlDisplay: 100 })
    expect(b.userPositionDisplay).toBe(100)
    expect(b.userSharePercent).toBe(100)
    expect(b.isSoleDepositor).toBe(true)

    const neg = computeVaultOwnershipBreakdown({ userPositionDisplay: -5, vaultTvlDisplay: -10 })
    expect(neg.userPositionDisplay).toBe(0)
    expect(neg.vaultTvlDisplay).toBe(0)
  })
})

describe('buildVaultPositionSummary', () => {
  test('derives dfTokens display and estimated yearly yield from APY', () => {
    const s = buildVaultPositionSummary({
      userPositionDisplay: 100,
      vaultTvlDisplay: 200,
      dfTokensRaw: 10_000_000,
      apy: 10,
      assetDecimals: 7,
    })
    expect(s.dfTokensDisplay).toBe(1)
    expect(s.apy).toBe(10)
    expect(s.estimatedYearlyYieldDisplay).toBe(10)
    expect(s.supplySymbol).toBe('USDC')
  })

  test('nulls out APY and yield when APY is absent or non-positive', () => {
    const s = buildVaultPositionSummary({
      userPositionDisplay: 100,
      vaultTvlDisplay: 200,
      dfTokensRaw: 0,
      apy: 0,
    })
    expect(s.apy).toBeNull()
    expect(s.estimatedYearlyYieldDisplay).toBeNull()
  })
})
