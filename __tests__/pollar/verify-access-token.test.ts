import { describe, expect, test } from 'bun:test'
import { walletAddressFromTokenVerifyContent } from '@/lib/pollar/verify-access-token'

describe('walletAddressFromTokenVerifyContent', () => {
  test('reads a Stellar address string on wallet', () => {
    expect(
      walletAddressFromTokenVerifyContent({
        wallet: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      }),
    ).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')
  })

  test('reads wallet.address objects from Server API v3', () => {
    expect(
      walletAddressFromTokenVerifyContent({
        wallet: { address: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
      }),
    ).toBe('GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
  })
})
