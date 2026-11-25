import { describe, expect, test } from 'bun:test'
import { Networks } from '@stellar/stellar-sdk'
import { getStellarNetworkConfig } from '@/lib/stellar/network-config'

describe('getStellarNetworkConfig', () => {
  test('uses the SDK network passphrases without importing the SDK', () => {
    expect(getStellarNetworkConfig('mainnet').networkPassphrase).toBe(Networks.PUBLIC)
    expect(getStellarNetworkConfig('testnet').networkPassphrase).toBe(Networks.TESTNET)
  })
})
