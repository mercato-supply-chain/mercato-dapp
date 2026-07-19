import { describe, expect, test } from 'bun:test'
import type { VaultInfoResponse } from '@defindex/sdk'
import {
  buildVaultMonitorAlerts,
  resolveMonitorVaultAddress,
  type VaultMonitorAssetRow,
  type VaultMonitorPayload,
} from '@/lib/defindex/vault-monitor'

const CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const CONTRACT2 = 'CCEE2VAGPXKVIZXTVIT4O5B7GCUDTZTJ5RIXBPJSZ7JWJCJ2TLK75WVW'
const STRATEGY = 'CAQ6PAG4X6L7LJVGOKSQ6RU2LADWK4EQXRJGMUWL7SECS7LXUEQLM5U7'

describe('resolveMonitorVaultAddress', () => {
  test('accepts a valid override contract id', () => {
    const r = resolveMonitorVaultAddress(CONTRACT, `  ${CONTRACT2}  `)
    expect(r.vaultAddress).toBe(CONTRACT2)
    expect(r.error).toBeUndefined()
  })

  test('rejects an invalid override', () => {
    const r = resolveMonitorVaultAddress(CONTRACT, 'not-a-contract')
    expect(r.vaultAddress).toBeNull()
    expect(r.error).toBeTruthy()
  })

  test('falls back to the configured vault when no override', () => {
    const r = resolveMonitorVaultAddress(CONTRACT, null)
    expect(r.vaultAddress).toBe(CONTRACT)
  })

  test('errors when no vault is configured and no override is given', () => {
    const r = resolveMonitorVaultAddress('', null)
    expect(r.vaultAddress).toBeNull()
    expect(r.error).toContain('No vault configured')
  })

  test('errors when the configured vault id is malformed', () => {
    const r = resolveMonitorVaultAddress('bad-id', null)
    expect(r.vaultAddress).toBeNull()
    expect(r.error).toBeTruthy()
  })
})

function assetRow(overrides: Partial<VaultMonitorAssetRow> = {}): VaultMonitorAssetRow {
  return {
    address: CONTRACT,
    name: 'USDC',
    symbol: 'USDC',
    idleDisplay: 10,
    investedDisplay: 90,
    totalDisplay: 100,
    idleRaw: '100000000',
    investedRaw: '900000000',
    totalRaw: '1000000000',
    idlePercent: 10,
    strategies: [
      { address: STRATEGY, name: 'HODL', paused: false, allocatedDisplay: 90, allocatedRaw: '900000000' },
    ],
    ...overrides,
  }
}

function info(overrides: Partial<VaultInfoResponse> = {}): VaultInfoResponse {
  return {
    assets: [{ address: CONTRACT, strategies: [{ address: STRATEGY, name: 'HODL', paused: false }] }],
    apy: 5,
    ...overrides,
  } as unknown as VaultInfoResponse
}

const HEALTHY_TOTALS: VaultMonitorPayload['totals'] = {
  tvlDisplay: 100,
  idleDisplay: 10,
  investedDisplay: 90,
  idlePercent: 10,
}
const HEALTHY_OPTS = { envConfigured: true, addressMatchesEnv: true, apiHealthy: true }

const ids = (alerts: { id: string }[]) => alerts.map((a) => a.id)

describe('buildVaultMonitorAlerts', () => {
  test('a fully healthy vault produces no alerts', () => {
    const alerts = buildVaultMonitorAlerts(info(), [assetRow()], HEALTHY_TOTALS, HEALTHY_OPTS)
    expect(alerts).toEqual([])
  })

  test('flags an unreachable API', () => {
    const alerts = buildVaultMonitorAlerts(info(), [assetRow()], HEALTHY_TOTALS, {
      ...HEALTHY_OPTS,
      apiHealthy: false,
    })
    expect(ids(alerts)).toContain('api-unhealthy')
  })

  test('flags missing and mismatched env wiring', () => {
    const missing = buildVaultMonitorAlerts(info(), [assetRow()], HEALTHY_TOTALS, {
      ...HEALTHY_OPTS,
      envConfigured: false,
    })
    expect(ids(missing)).toContain('env-missing')

    const mismatch = buildVaultMonitorAlerts(info(), [assetRow()], HEALTHY_TOTALS, {
      ...HEALTHY_OPTS,
      addressMatchesEnv: false,
    })
    expect(ids(mismatch)).toContain('env-mismatch')
  })

  test('flags zero TVL and high idle cash', () => {
    const zero = buildVaultMonitorAlerts(
      info(),
      [assetRow()],
      { ...HEALTHY_TOTALS, tvlDisplay: 0 },
      HEALTHY_OPTS,
    )
    expect(ids(zero)).toContain('zero-tvl')

    const idle = buildVaultMonitorAlerts(
      info(),
      [assetRow()],
      { ...HEALTHY_TOTALS, idlePercent: 55 },
      HEALTHY_OPTS,
    )
    expect(ids(idle)).toContain('high-idle')
  })

  test('flags paused strategies with a per-strategy id', () => {
    const alerts = buildVaultMonitorAlerts(
      info(),
      [assetRow({ strategies: [{ address: STRATEGY, name: 'HODL', paused: true, allocatedDisplay: 0, allocatedRaw: '0' }] })],
      HEALTHY_TOTALS,
      HEALTHY_OPTS,
    )
    expect(ids(alerts)).toContain(`paused-${STRATEGY}`)
  })

  test('flags a vault with no configured strategies', () => {
    const alerts = buildVaultMonitorAlerts(
      info({ assets: [{ address: CONTRACT, strategies: [] }] } as unknown as VaultInfoResponse),
      [assetRow({ strategies: [] })],
      HEALTHY_TOTALS,
      HEALTHY_OPTS,
    )
    expect(ids(alerts)).toContain('no-strategies')
  })

  test('flags a zero APY when funds are invested', () => {
    const alerts = buildVaultMonitorAlerts(
      info({ apy: 0 } as unknown as VaultInfoResponse),
      [assetRow()],
      HEALTHY_TOTALS,
      HEALTHY_OPTS,
    )
    expect(ids(alerts)).toContain('zero-apy')
  })
})
