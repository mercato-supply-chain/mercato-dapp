import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
  getStellarWalletKit,
  getStellarWalletKitSync,
  isStellarWalletKitInitialized,
  resetStellarWalletKit,
} from '@/lib/trustless/lazy-wallet-kit'

// Mock the wallet kit SDK
mock.module('@creit.tech/stellar-wallets-kit', () => ({
  StellarWalletsKit: mock((options: any) => {
    return {
      options,
      signTransaction: mock(async () => ({ signedTxXdr: 'signed' })),
      disconnect: mock(async () => undefined),
    }
  }),
  WalletNetwork: {
    TESTNET: 'test',
    PUBLIC: 'public',
  },
  FREIGHTER_ID: 'freighter',
  AlbedoModule: class {},
  FreighterModule: class {},
}))

describe('lazy-wallet-kit', () => {
  beforeEach(() => {
    resetStellarWalletKit()
    // Simulate browser environment
    if (typeof window === 'undefined') {
      globalThis.window = {} as any
    }
  })

  afterEach(() => {
    resetStellarWalletKit()
  })

  describe('getStellarWalletKit', () => {
    it('initializes wallet kit on first call', async () => {
      const kit1 = await getStellarWalletKit()
      expect(kit1).not.toBeNull()
      expect(kit1).toHaveProperty('signTransaction')
    })

    it('returns cached instance on subsequent calls', async () => {
      const kit1 = await getStellarWalletKit()
      const kit2 = await getStellarWalletKit()
      expect(kit1).toBe(kit2)
    })

    it('handles concurrent calls safely', async () => {
      const results = await Promise.all([
        getStellarWalletKit(),
        getStellarWalletKit(),
        getStellarWalletKit(),
      ])
      expect(results[0]).toBe(results[1])
      expect(results[1]).toBe(results[2])
    })

    it('returns null in server context', async () => {
      // Simulate server context by removing window
      const originalWindow = globalThis.window
      // @ts-expect-error test
      delete globalThis.window
      resetStellarWalletKit()

      const kit = await getStellarWalletKit()
      expect(kit).toBeNull()

      // Restore window
      globalThis.window = originalWindow
    })
  })

  describe('getStellarWalletKitSync', () => {
    it('returns null before initialization', () => {
      const kit = getStellarWalletKitSync()
      expect(kit).toBeNull()
    })

    it('returns cached instance after initialization', async () => {
      await getStellarWalletKit()
      const kit = getStellarWalletKitSync()
      expect(kit).not.toBeNull()
      expect(kit).toHaveProperty('signTransaction')
    })
  })

  describe('isStellarWalletKitInitialized', () => {
    it('returns false before initialization', () => {
      expect(isStellarWalletKitInitialized()).toBe(false)
    })

    it('returns true after initialization', async () => {
      await getStellarWalletKit()
      expect(isStellarWalletKitInitialized()).toBe(true)
    })
  })

  describe('resetStellarWalletKit', () => {
    it('clears cached instance and initialization state', async () => {
      await getStellarWalletKit()
      expect(isStellarWalletKitInitialized()).toBe(true)

      resetStellarWalletKit()
      expect(isStellarWalletKitInitialized()).toBe(false)
      expect(getStellarWalletKitSync()).toBeNull()
    })

    it('allows re-initialization after reset', async () => {
      const kit1 = await getStellarWalletKit()
      resetStellarWalletKit()
      const kit2 = await getStellarWalletKit()

      expect(kit1).not.toBe(kit2)
      expect(kit2).not.toBeNull()
    })
  })

  describe('error handling', () => {
    it('allows retry on initialization failure', async () => {
      let callCount = 0
      mock.module('@creit.tech/stellar-wallets-kit', () => ({
        StellarWalletsKit: mock(() => {
          callCount++
          if (callCount === 1) {
            throw new Error('SDK initialization failed')
          }
          return {
            signTransaction: mock(async () => ({ signedTxXdr: 'signed' })),
            disconnect: mock(async () => undefined),
          }
        }),
        WalletNetwork: {
          TESTNET: 'test',
          PUBLIC: 'public',
        },
        FREIGHTER_ID: 'freighter',
        AlbedoModule: class {},
        FreighterModule: class {},
      }))

      resetStellarWalletKit()

      // First call fails
      try {
        await getStellarWalletKit()
      } catch (error) {
        expect(String(error)).toContain('SDK initialization failed')
      }

      // After reset, can retry
      resetStellarWalletKit()
      const kit = await getStellarWalletKit()
      expect(kit).not.toBeNull()
    })
  })
})
