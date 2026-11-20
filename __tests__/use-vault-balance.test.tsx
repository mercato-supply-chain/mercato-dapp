import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

const vaultFetch = mock(async (_address: string) => ({
  underlyingTotal: 0,
  underlyingTotalRaw: 0,
  dfTokens: 0,
  vaultAddress: 'vault',
  network: 'testnet',
}))
const sacFetch = mock(async (_address: string, _asset: string) => ({
  displayBalance: 0,
  rawBalance: '0',
}))

mock.module('@/lib/defindex/vault-cache', () => ({
  hasClientVaultConfigured: () => true,
  vaultBalanceRequest: { fetch: vaultFetch },
  sacBalanceRequest: { fetch: sacFetch },
  isRateLimitMessage: (message: string) => /rate limit/i.test(message),
}))

const { useVaultBalance } = await import('@/hooks/use-vault-balance')

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useVaultBalance request ownership', () => {
  beforeEach(() => {
    vaultFetch.mockReset()
    sacFetch.mockReset()
    vaultFetch.mockImplementation(async () => ({
      underlyingTotal: 0,
      underlyingTotalRaw: 0,
      dfTokens: 0,
      vaultAddress: 'vault',
      network: 'testnet',
    }))
    sacFetch.mockImplementation(async () => ({ displayBalance: 0, rawBalance: '0' }))
  })

  test('keeps account B balances when account A resolves later', async () => {
    const vaultA = deferred<{ underlyingTotal: number; underlyingTotalRaw: number; dfTokens: number; vaultAddress: string; network: string }>()
    const walletA = deferred<{ displayBalance: number; rawBalance: string }>()
    const vaultB = deferred<{ underlyingTotal: number; underlyingTotalRaw: number; dfTokens: number; vaultAddress: string; network: string }>()
    const walletB = deferred<{ displayBalance: number; rawBalance: string }>()

    vaultFetch.mockImplementation((address) => address === 'A' ? vaultA.promise : vaultB.promise)
    sacFetch.mockImplementation((address) => address === 'A' ? walletA.promise : walletB.promise)

    const { result } = renderHook(() => useVaultBalance())
    let loadA!: Promise<unknown>
    let loadB!: Promise<unknown>

    await act(async () => {
      loadA = result.current.loadUserBalancesRef.current('A', 'asset')
      loadB = result.current.loadUserBalancesRef.current('B', 'asset')
      vaultB.resolve({ underlyingTotal: 22, underlyingTotalRaw: 220, dfTokens: 2, vaultAddress: 'vault', network: 'testnet' })
      walletB.resolve({ displayBalance: 33, rawBalance: '330' })
      await loadB
      vaultA.resolve({ underlyingTotal: 11, underlyingTotalRaw: 110, dfTokens: 1, vaultAddress: 'vault', network: 'testnet' })
      walletA.resolve({ displayBalance: 44, rawBalance: '440' })
      await loadA
    })

    expect(result.current.vaultBalance).toBe(22)
    expect(result.current.vaultRawBalance).toBe(220)
    expect(result.current.dfTokens).toBe(2)
    expect(result.current.walletBalance).toBe(33)
    expect(result.current.walletRawBalance).toBe(330)
    expect(result.current.isLoadingBalances).toBe(false)
  })

  test('does not use account A cache as a rate-limit fallback for account B', async () => {
    vaultFetch.mockImplementation(async (address) => {
      if (address === 'A') {
        return { underlyingTotal: 17, underlyingTotalRaw: 170, dfTokens: 7, vaultAddress: 'vault', network: 'testnet' }
      }
      throw new Error('Rate limit exceeded')
    })
    sacFetch.mockImplementation(async (address) => ({
      displayBalance: address === 'A' ? 19 : 0,
      rawBalance: address === 'A' ? '190' : '0',
    }))

    const { result } = renderHook(() => useVaultBalance())
    await act(async () => {
      await result.current.loadUserBalancesRef.current('A', 'asset')
    })
    await act(async () => {
      await result.current.loadUserBalancesRef.current('B', 'asset')
    })

    expect(result.current.vaultBalance).toBe(0)
    expect(result.current.vaultRawBalance).toBe(0)
    expect(result.current.dfTokens).toBe(0)
    expect(result.current.walletBalance).toBe(0)
  })

  test('an older same-account refresh cannot clear loading or replace the newer result', async () => {
    const oldVault = deferred<{ underlyingTotal: number; underlyingTotalRaw: number; dfTokens: number; vaultAddress: string; network: string }>()
    const oldWallet = deferred<{ displayBalance: number; rawBalance: string }>()
    const newVault = deferred<{ underlyingTotal: number; underlyingTotalRaw: number; dfTokens: number; vaultAddress: string; network: string }>()
    const newWallet = deferred<{ displayBalance: number; rawBalance: string }>()
    let vaultCalls = 0
    let walletCalls = 0
    vaultFetch.mockImplementation(() => (++vaultCalls === 1 ? oldVault.promise : newVault.promise))
    sacFetch.mockImplementation(() => (++walletCalls === 1 ? oldWallet.promise : newWallet.promise))

    const { result } = renderHook(() => useVaultBalance())
    let oldLoad!: Promise<unknown>
    let newLoad!: Promise<unknown>
    await act(async () => {
      oldLoad = result.current.loadUserBalancesRef.current('A', 'asset')
      newLoad = result.current.loadUserBalancesRef.current('A', 'asset')
      oldVault.resolve({ underlyingTotal: 1, underlyingTotalRaw: 10, dfTokens: 1, vaultAddress: 'vault', network: 'testnet' })
      oldWallet.resolve({ displayBalance: 2, rawBalance: '20' })
      await oldLoad
    })

    expect(result.current.isLoadingBalances).toBe(true)
    expect(result.current.vaultBalance).toBe(0)
    expect(result.current.walletBalance).toBe(0)

    await act(async () => {
      newVault.resolve({ underlyingTotal: 8, underlyingTotalRaw: 80, dfTokens: 8, vaultAddress: 'vault', network: 'testnet' })
      newWallet.resolve({ displayBalance: 9, rawBalance: '90' })
      await newLoad
    })

    expect(result.current.isLoadingBalances).toBe(false)
    expect(result.current.vaultBalance).toBe(8)
    expect(result.current.walletBalance).toBe(9)
  })

  test('changing the asset invalidates the previous asset request', async () => {
    const oldVault = deferred<{ underlyingTotal: number; underlyingTotalRaw: number; dfTokens: number; vaultAddress: string; network: string }>()
    const oldWallet = deferred<{ displayBalance: number; rawBalance: string }>()
    const newVault = deferred<{ underlyingTotal: number; underlyingTotalRaw: number; dfTokens: number; vaultAddress: string; network: string }>()
    const newWallet = deferred<{ displayBalance: number; rawBalance: string }>()
    let vaultCallsForAsset = 0
    vaultFetch.mockImplementation(() => (++vaultCallsForAsset === 1 ? oldVault.promise : newVault.promise))
    sacFetch.mockImplementation((_address, asset) => asset === 'asset-old' ? oldWallet.promise : newWallet.promise)

    const { result } = renderHook(() => useVaultBalance())
    let oldLoad!: Promise<unknown>
    let newLoad!: Promise<unknown>
    await act(async () => {
      oldLoad = result.current.loadUserBalancesRef.current('A', 'asset-old')
      newLoad = result.current.loadUserBalancesRef.current('A', 'asset-new')
      newVault.resolve({ underlyingTotal: 3, underlyingTotalRaw: 30, dfTokens: 3, vaultAddress: 'vault', network: 'testnet' })
      newWallet.resolve({ displayBalance: 4, rawBalance: '40' })
      await newLoad
      oldVault.resolve({ underlyingTotal: 100, underlyingTotalRaw: 1000, dfTokens: 100, vaultAddress: 'vault', network: 'testnet' })
      oldWallet.resolve({ displayBalance: 200, rawBalance: '2000' })
      await oldLoad
    })

    expect(result.current.vaultBalance).toBe(3)
    expect(result.current.vaultRawBalance).toBe(30)
    expect(result.current.dfTokens).toBe(3)
    expect(result.current.walletBalance).toBe(4)
  })

  test('keeps a successful wallet balance when the vault request fails', async () => {
    vaultFetch.mockImplementation(async () => {
      throw new Error('Vault service unavailable')
    })
    sacFetch.mockImplementation(async () => ({ displayBalance: 12.34, rawBalance: '1234' }))

    const { result } = renderHook(() => useVaultBalance())
    await act(async () => {
      await result.current.loadUserBalancesRef.current('A', 'asset')
    })

    expect(result.current.walletBalance).toBe(12.34)
    expect(result.current.walletRawBalance).toBe(1234)
    expect(result.current.vaultBalance).toBe(0)
    expect(result.current.balanceError).toBe('Vault service unavailable')
    expect(result.current.isLoadingBalances).toBe(false)
  })

  test('disconnect invalidation prevents pending requests from restoring balances', async () => {
    const vaultPending = deferred<{ underlyingTotal: number; underlyingTotalRaw: number; dfTokens: number; vaultAddress: string; network: string }>()
    const walletPending = deferred<{ displayBalance: number; rawBalance: string }>()
    vaultFetch.mockImplementation(() => vaultPending.promise)
    sacFetch.mockImplementation(() => walletPending.promise)

    const { result } = renderHook(() => useVaultBalance())
    let load!: Promise<unknown>
    await act(async () => {
      load = result.current.loadUserBalancesRef.current('A', 'asset')
      result.current.resetBalances()
      vaultPending.resolve({ underlyingTotal: 50, underlyingTotalRaw: 500, dfTokens: 5, vaultAddress: 'vault', network: 'testnet' })
      walletPending.resolve({ displayBalance: 60, rawBalance: '600' })
      await load
    })

    expect(result.current.vaultBalance).toBe(0)
    expect(result.current.walletBalance).toBe(0)
    expect(result.current.dfTokens).toBe(0)
    expect(result.current.isLoadingBalances).toBe(false)
  })
})
