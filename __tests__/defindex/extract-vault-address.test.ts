import { describe, expect, test } from 'bun:test'
import {
  buildVaultEnvLines,
  extractVaultFromCreateVaultResponse,
  extractVaultFromSubmitResponse,
  resolveDeployedVaultAddress,
} from '@/lib/defindex/extract-vault-address'

const CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const CONTRACT2 = 'CCEE2VAGPXKVIZXTVIT4O5B7GCUDTZTJ5RIXBPJSZ7JWJCJ2TLK75WVW'

describe('extractVaultFromCreateVaultResponse', () => {
  test('reads a contract id from simulationResponse', () => {
    expect(extractVaultFromCreateVaultResponse({ simulationResponse: CONTRACT })).toBe(CONTRACT)
  })

  test('returns null for missing or invalid values', () => {
    expect(extractVaultFromCreateVaultResponse({ simulationResponse: 'nope' })).toBeNull()
    expect(extractVaultFromCreateVaultResponse(null)).toBeNull()
    expect(extractVaultFromCreateVaultResponse({})).toBeNull()
  })
})

describe('extractVaultFromSubmitResponse', () => {
  test('prefers result.value', () => {
    expect(extractVaultFromSubmitResponse({ result: { value: CONTRACT } })).toBe(CONTRACT)
  })

  test('falls back through value, simulationResponse, vaultAddress', () => {
    expect(extractVaultFromSubmitResponse({ value: CONTRACT })).toBe(CONTRACT)
    expect(extractVaultFromSubmitResponse({ simulationResponse: CONTRACT })).toBe(CONTRACT)
    expect(extractVaultFromSubmitResponse({ vaultAddress: CONTRACT })).toBe(CONTRACT)
  })

  test('returns null when nothing valid is present', () => {
    expect(extractVaultFromSubmitResponse({ result: { value: 'bad' } })).toBeNull()
    expect(extractVaultFromSubmitResponse(null)).toBeNull()
  })
})

describe('resolveDeployedVaultAddress', () => {
  test('prefers the on-chain submit result over the simulation', () => {
    const resolved = resolveDeployedVaultAddress(
      { simulationResponse: CONTRACT2 },
      { result: { value: CONTRACT } },
    )
    expect(resolved).toBe(CONTRACT)
  })

  test('falls back to the create simulation when submit has none', () => {
    expect(resolveDeployedVaultAddress({ simulationResponse: CONTRACT2 }, {})).toBe(CONTRACT2)
  })

  test('returns null when neither payload carries an address', () => {
    expect(resolveDeployedVaultAddress({}, {})).toBeNull()
  })
})

describe('buildVaultEnvLines', () => {
  test('emits both the public and server env var lines', () => {
    const lines = buildVaultEnvLines(CONTRACT)
    expect(lines.publicVar).toBe(`NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS=${CONTRACT}`)
    expect(lines.serverVar).toBe(`MERCATO_DEFINDEX_VAULT_ADDRESS=${CONTRACT}`)
    expect(lines.block).toBe(`${lines.publicVar}\n${lines.serverVar}`)
  })
})
