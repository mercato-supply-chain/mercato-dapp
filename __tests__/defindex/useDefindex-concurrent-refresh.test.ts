import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { MercatoVaultMeta } from '@/hooks/useDefindex'

const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const VAULT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const ASSET = 'CBAMZIF3QGKM4NPOJPOF5WCFJ6CYZ4WSOXHO7M3TZQZLN5VTRQKZ7QYH'

const META: MercatoVaultMeta = {
  vaultAddress: VAULT,
  network: 'testnet',
  name: 'Test Vault',
  symbol: 'MVT',
  apy: 5,
  feesBps: { vaultFee: 0, defindexFee: 0 },
  assets: [{ address: ASSET, symbol: 'USDC' }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// The factories below only touch `globalThis`, so they stay safe regardless of
// how the test runner hoists `mock.module` relative to top-level declarations.
mock.module('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    walletInfo: (globalThis as any).__walletInfo ?? null,
    refreshBalance: (...args: unknown[]) => (globalThis as any).__refreshBalance(...args),
    canSignTransactions: false,
  }),
}))

mock.module('@/hooks/use-vault-meta', () => ({
  useVaultMeta: () => ({
    vaultMeta: null,
    vaultInfoError: null,
    vaultMetaRef: { current: null },
    fetchVaultMetaRef: {
      current: (...args: unknown[]) => (globalThis as any).__fetchVaultMeta(...args),
    },
    setVaultMeta: () => {},
    setVaultInfoError: () => {},
  }),
}))

mock.module('@/hooks/use-vault-balance', () => ({
  useVaultBalance: () => ({
    walletBalance: 0,
    walletRawBalance: 0,
    vaultBalance: 0,
    vaultRawBalance: 0,
    dfTokens: 0,
    isLoadingBalances: false,
    balanceError: null,
    setWalletBalance: () => {},
    setWalletRawBalance: () => {},
    setVaultBalance: () => {},
    setVaultRawBalance: () => {},
    setDfTokens: () => {},
    setBalanceError: () => {},
    getVaultBalance: async () => 0,
    loadUserBalancesRef: {
      current: (...args: unknown[]) => (globalThis as any).__loadUserBalances(...args),
    },
  }),
}))

mock.module('@/lib/trustless/wallet-kit', () => ({
  signTransaction: async () => '',
}))

mock.module('@/lib/defindex/config', () => ({
  getMercatoVaultContractId: () => VAULT,
  isDefindexConfigured: () => true,
}))

import { useDefindex } from '@/hooks/useDefindex'

const g = globalThis as any

beforeEach(() => {
  g.__walletInfo = { address: ACCOUNT }
  g.__refreshBalance = async () => {}
  g.__fetchVaultMeta = async () => null
  g.__loadUserBalances = async () => ({ vaultBalance: 0, walletBalance: 0 })
})

afterEach(() => {
  cleanup()
  mock.restore()
})

describe('useDefindex#refreshBalances', () => {
  test('starts the wallet refresh and the vault-metadata resolution in the same tick', async () => {
    const walletDeferred = deferred<void>()
    const metaDeferred = deferred<MercatoVaultMeta | null>()

    const refreshBalanceMock = mock(() => walletDeferred.promise)
    let metaCalls = 0
    const fetchVaultMetaMock = mock(() => {
      metaCalls += 1
      // The first call is the mount effect: keep it pending so the auto-load
      // never resolves and cannot interfere with the assertion below.
      if (metaCalls === 1) return new Promise<MercatoVaultMeta | null>(() => {})
      return metaDeferred.promise
    })
    const loadUserBalancesMock = mock(async () => ({ vaultBalance: 0, walletBalance: 0 }))

    g.__refreshBalance = refreshBalanceMock
    g.__fetchVaultMeta = fetchVaultMetaMock
    g.__loadUserBalances = loadUserBalancesMock

    const { result } = renderHook(() => useDefindex())
    await act(async () => {})

    const metaCallsBefore = metaCalls
    let refreshPromise!: Promise<{ vaultBalance: number; walletBalance: number }>
    act(() => {
      refreshPromise = result.current.refreshBalances()
    })

    expect(refreshBalanceMock).toHaveBeenCalledTimes(1)
    // Metadata resolution started while the wallet refresh promise is still pending.
    expect(metaCalls).toBeGreaterThan(metaCallsBefore)
    // The dependent load must not run until both independent operations settle.
    expect(loadUserBalancesMock).not.toHaveBeenCalled()

    await act(async () => {
      metaDeferred.resolve(META)
      walletDeferred.resolve()
      await refreshPromise
    })

    // The dependent request receives the resolved asset address.
    expect(loadUserBalancesMock).toHaveBeenCalledWith(ACCOUNT, ASSET)
  })

  test('preserves the missing-metadata fallback (undefined asset address)', async () => {
    g.__refreshBalance = mock(async () => {})
    g.__fetchVaultMeta = mock(async () => null)
    const loadUserBalancesMock = mock(async () => ({ vaultBalance: 0, walletBalance: 0 }))
    g.__loadUserBalances = loadUserBalancesMock

    const { result } = renderHook(() => useDefindex())
    await act(async () => {})

    await act(async () => {
      await result.current.refreshBalances()
    })

    expect(loadUserBalancesMock).toHaveBeenCalledWith(ACCOUNT, undefined)
  })

  test('still starts metadata resolution when the wallet refresh rejects', async () => {
    const walletDeferred = deferred<void>()
    const walletError = new Error('wallet refresh failed')
    const refreshBalanceMock = mock(() => walletDeferred.promise)
    let metaCalls = 0
    const fetchVaultMetaMock = mock(() => {
      metaCalls += 1
      if (metaCalls === 1) return new Promise<MercatoVaultMeta | null>(() => {})
      return new Promise<MercatoVaultMeta | null>(() => {})
    })

    g.__refreshBalance = refreshBalanceMock
    g.__fetchVaultMeta = fetchVaultMetaMock

    const { result } = renderHook(() => useDefindex())
    await act(async () => {})

    const metaCallsBefore = metaCalls
    let refreshPromise!: Promise<{ vaultBalance: number; walletBalance: number }>
    act(() => {
      refreshPromise = result.current.refreshBalances()
    })

    expect(metaCalls).toBeGreaterThan(metaCallsBefore)

    walletDeferred.reject(walletError)
    await expect(refreshPromise).rejects.toThrow('wallet refresh failed')
  })
})
