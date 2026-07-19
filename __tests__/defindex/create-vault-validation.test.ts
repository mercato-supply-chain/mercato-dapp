import { describe, expect, test } from 'bun:test'
import {
  MAX_VAULT_FEE_BPS,
  validateCreateVaultParams,
} from '@/lib/defindex/create-vault-validation'

const G = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const G2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const C = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const C2 = 'CCEE2VAGPXKVIZXTVIT4O5B7GCUDTZTJ5RIXBPJSZ7JWJCJ2TLK75WVW'

function validConfig() {
  return {
    caller: G,
    roles: {
      emergencyManager: G,
      rebalanceManager: G2,
      feeReceiver: G,
      manager: G2,
    },
    vaultFeeBps: 100,
    name: 'Mercato Vault',
    symbol: 'MVLT',
    assets: [
      {
        address: C,
        strategies: [{ address: C2, name: 'HODL', paused: false }],
      },
    ],
    upgradable: true,
  }
}

describe('validateCreateVaultParams', () => {
  test('accepts a well-formed config', () => {
    const result = validateCreateVaultParams(validConfig())
    expect(result.ok).toBe(true)
  })

  test('accepts an optional valid soroswapRouter', () => {
    const result = validateCreateVaultParams({ ...validConfig(), soroswapRouter: C })
    expect(result.ok).toBe(true)
  })

  test('rejects a non-object', () => {
    expect(validateCreateVaultParams(null).ok).toBe(false)
    expect(validateCreateVaultParams('nope').ok).toBe(false)
  })

  test('rejects an invalid caller address', () => {
    const result = validateCreateVaultParams({ ...validConfig(), caller: 'not-an-account' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('caller')
  })

  test('rejects an out-of-range vaultFeeBps', () => {
    const tooHigh = validateCreateVaultParams({ ...validConfig(), vaultFeeBps: MAX_VAULT_FEE_BPS + 1 })
    expect(tooHigh.ok).toBe(false)
    const negative = validateCreateVaultParams({ ...validConfig(), vaultFeeBps: -1 })
    expect(negative.ok).toBe(false)
    const fractional = validateCreateVaultParams({ ...validConfig(), vaultFeeBps: 12.5 })
    expect(fractional.ok).toBe(false)
  })

  test('rejects an overlong name or symbol', () => {
    expect(validateCreateVaultParams({ ...validConfig(), name: 'x'.repeat(33) }).ok).toBe(false)
    expect(validateCreateVaultParams({ ...validConfig(), symbol: 'x'.repeat(11) }).ok).toBe(false)
    expect(validateCreateVaultParams({ ...validConfig(), name: '' }).ok).toBe(false)
  })

  test('rejects a role with a malformed address', () => {
    const config = validConfig()
    config.roles.manager = 'bad'
    const result = validateCreateVaultParams(config)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('roles.manager')
  })

  test('rejects an empty assets array', () => {
    expect(validateCreateVaultParams({ ...validConfig(), assets: [] }).ok).toBe(false)
  })

  test('rejects an asset with an invalid contract address', () => {
    const config = validConfig()
    config.assets[0].address = G // account id where a contract id is required
    const result = validateCreateVaultParams(config)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('assets[0].address')
  })

  test('rejects a strategy with an invalid shape', () => {
    const config = validConfig()
    config.assets[0].strategies = [{ address: C2, name: '', paused: false }]
    expect(validateCreateVaultParams(config).ok).toBe(false)

    const config2 = validConfig()
    // @ts-expect-error intentional bad shape for the test
    config2.assets[0].strategies = [{ address: C2, name: 'ok', paused: 'yes' }]
    expect(validateCreateVaultParams(config2).ok).toBe(false)
  })

  test('rejects an invalid soroswapRouter when present', () => {
    const result = validateCreateVaultParams({ ...validConfig(), soroswapRouter: 'bad' })
    expect(result.ok).toBe(false)
  })

  test('rejects a non-boolean upgradable', () => {
    // @ts-expect-error intentional bad shape for the test
    expect(validateCreateVaultParams({ ...validConfig(), upgradable: 'true' }).ok).toBe(false)
  })
})
