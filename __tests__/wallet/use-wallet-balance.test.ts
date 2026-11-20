import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ConnectedWallet, WalletBalanceSummary } from '@/lib/mercato-wallet'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface GlobalTestScope {
  __pollarWalletBalance?: {
    step: 'idle' | 'loading' | 'loaded' | 'error'
    data?: { balances: Array<{ code?: string; balance?: string }> }
    message?: string
  }
  __pollarTxHistory?: { step: string }
  __pollarRefreshWalletBalance?: () => Promise<void>
  __fetchHorizonBalances?: (publicKey: string) => Promise<WalletBalanceSummary>
}

const g = globalThis as unknown as GlobalTestScope

mock.module('@/providers/pollar-provider', () => ({
  usePollarSession: () => ({
    walletBalance: g.__pollarWalletBalance ?? { step: 'idle' },
    txHistory: g.__pollarTxHistory ?? { step: 'idle' },
    refreshWalletBalance: (...args: unknown[]) => g.__pollarRefreshWalletBalance?.(...args),
  }),
}))

mock.module('@/lib/mercato-wallet', () => ({
  getStellarNetwork: () => 'testnet',
  normalizePollarWalletBalance: (balanceState: unknown) => {
    const state = balanceState as GlobalTestScope['__pollarWalletBalance']
    if (!state || state.step !== 'loaded') return null
    return {
      xlm: '100',
      usdc: '50',
      records: state.data?.balances ?? [],
      source: 'pollar',
      updatedAt: '2026-10-18T00:00:00.000Z',
    }
  },
  fetchHorizonBalances: (publicKey: string) => g.__fetchHorizonBalances!(publicKey),
}))

import { useWalletBalance } from '@/hooks/use-wallet-balance'

const WALLET_A: ConnectedWallet = {
  provider: 'stellar-wallets-kit',
  publicKey: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
  isEmbedded: false,
}

const WALLET_B: ConnectedWallet = {
  provider: 'stellar-wallets-kit',
  publicKey: 'GBBD67IFJCL4PB55KBZZFF5NVWNYT67STG5C2WEXV54B7337BPNIS2BS',
  isEmbedded: false,
}

const WALLET_POLLAR: ConnectedWallet = {
  provider: 'pollar',
  publicKey: 'GCP7R7X335M3F55F6R3I5ZNYQ27G2RMMH62D53D27XQ36M2K625BPMEM',
  isEmbedded: true,
}

const BALANCE_A: WalletBalanceSummary = {
  xlm: '100.0000000',
  usdc: '50.0000000',
  records: [],
  source: 'horizon',
  updatedAt: '2026-10-18T10:00:00.000Z',
}

const BALANCE_B: WalletBalanceSummary = {
  xlm: '250.0000000',
  usdc: '150.0000000',
  records: [],
  source: 'horizon',
  updatedAt: '2026-10-18T10:00:00.000Z',
}

beforeEach(() => {
  g.__pollarWalletBalance = { step: 'idle' }
  g.__pollarTxHistory = { step: 'idle' }
  g.__pollarRefreshWalletBalance = async () => {}
  g.__fetchHorizonBalances = async () => BALANCE_A
})

afterEach(() => {
  cleanup()
})

describe('useWalletBalance', () => {
  test('discards pending manual refresh for wallet A after switching to wallet B', async () => {
    const deferredA = deferred<WalletBalanceSummary>()
    const deferredB = deferred<WalletBalanceSummary>()

    g.__fetchHorizonBalances = (publicKey: string) => {
      if (publicKey === WALLET_A.publicKey) return deferredA.promise
      if (publicKey === WALLET_B.publicKey) return deferredB.promise
      return Promise.resolve(BALANCE_A)
    }

    const { result, rerender } = renderHook(
      ({ wallet }: { wallet: ConnectedWallet | null }) => useWalletBalance(wallet),
      { initialProps: { wallet: WALLET_A } },
    )

    // Trigger manual refresh for wallet A
    let refreshPromiseA: Promise<void>
    act(() => {
      refreshPromiseA = result.current.refreshBalance()
    })

    expect(result.current.balances).toBeNull()

    // Switch to wallet B before A finishes
    rerender({ wallet: WALLET_B })
    expect(result.current.balances).toBeNull()

    // Now resolve A
    await act(async () => {
      deferredA.resolve(BALANCE_A)
      await refreshPromiseA
    })

    // Balances must NOT be set to A's balances
    expect(result.current.balances).toBeNull()

    // Now resolve B's automatic load
    await act(async () => {
      deferredB.resolve(BALANCE_B)
    })

    expect(result.current.balances).toEqual(BALANCE_B)
  })

  test('discards pending manual refresh for wallet A after disconnect', async () => {
    const deferredA = deferred<WalletBalanceSummary>()
    g.__fetchHorizonBalances = () => deferredA.promise

    const { result, rerender } = renderHook(
      ({ wallet }: { wallet: ConnectedWallet | null }) => useWalletBalance(wallet),
      { initialProps: { wallet: WALLET_A } },
    )

    let refreshPromiseA: Promise<void>
    act(() => {
      refreshPromiseA = result.current.refreshBalance()
    })

    // Disconnect wallet
    rerender({ wallet: null })
    expect(result.current.balances).toBeNull()

    // Resolve A
    await act(async () => {
      deferredA.resolve(BALANCE_A)
      await refreshPromiseA
    })

    // Balances must remain null after disconnect
    expect(result.current.balances).toBeNull()
  })

  test('clearBalances remains effective after in-flight refresh settles', async () => {
    const deferredA = deferred<WalletBalanceSummary>()
    g.__fetchHorizonBalances = () => deferredA.promise

    const { result } = renderHook(() => useWalletBalance(WALLET_A))

    let refreshPromise: Promise<void>
    act(() => {
      refreshPromise = result.current.refreshBalance()
    })

    // Call clearBalances while refresh is in flight
    act(() => {
      result.current.clearBalances()
    })

    expect(result.current.balances).toBeNull()

    // Resolve in-flight refresh
    await act(async () => {
      deferredA.resolve(BALANCE_A)
      await refreshPromise
    })

    // Balances must stay null
    expect(result.current.balances).toBeNull()
  })

  test('same-wallet refresh commits successfully when wallet stays connected', async () => {
    g.__fetchHorizonBalances = async () => BALANCE_A

    const { result } = renderHook(() => useWalletBalance(WALLET_A))

    await act(async () => {
      await result.current.refreshBalance()
    })

    expect(result.current.balances).toEqual(BALANCE_A)
  })

  test('slower earlier refresh for the same wallet does not overwrite newer refresh', async () => {
    const slowRefresh = deferred<WalletBalanceSummary>()
    const fastRefresh = deferred<WalletBalanceSummary>()

    let callCount = 0
    g.__fetchHorizonBalances = () => {
      callCount += 1
      return callCount === 1 ? slowRefresh.promise : fastRefresh.promise
    }

    const { result } = renderHook(() => useWalletBalance(WALLET_A))

    let p1: Promise<void>
    let p2: Promise<void>

    act(() => {
      p1 = result.current.refreshBalance()
      p2 = result.current.refreshBalance()
    })

    const updatedBalance: WalletBalanceSummary = {
      ...BALANCE_A,
      xlm: '999.0000000',
    }

    // Faster second refresh resolves first
    await act(async () => {
      fastRefresh.resolve(updatedBalance)
      await p2
    })

    expect(result.current.balances?.xlm).toBe('999.0000000')

    // Slower first refresh resolves later with older value
    await act(async () => {
      slowRefresh.resolve(BALANCE_A)
      await p1
    })

    // Balances must remain the newer value, not overwritten by slow refresh
    expect(result.current.balances?.xlm).toBe('999.0000000')
  })

  test('failed load cannot revive or overwrite balances if wallet switched', async () => {
    const deferredFail = deferred<WalletBalanceSummary>()
    g.__fetchHorizonBalances = (publicKey: string) => {
      if (publicKey === WALLET_A.publicKey) return deferredFail.promise
      return Promise.resolve(BALANCE_B)
    }

    const { result, rerender } = renderHook(
      ({ wallet }: { wallet: ConnectedWallet | null }) => useWalletBalance(wallet),
      { initialProps: { wallet: WALLET_A } },
    )

    let refreshPromise: Promise<void>
    act(() => {
      refreshPromise = result.current.refreshBalance()
    })

    // Switch to wallet B
    act(() => {
      rerender({ wallet: WALLET_B })
    })

    // Reject the pending load for wallet A
    await act(async () => {
      deferredFail.reject(new Error('Network error'))
      await refreshPromise.catch(() => {})
    })

    // Balances will be either null (if B still pending) or BALANCE_B (if B resolved), but never A
    expect(result.current.balances).toEqual(BALANCE_B)
  })

  test('pollar embedded wallet balance bridging respects active wallet ownership', async () => {
    g.__pollarWalletBalance = { step: 'idle' }
    let pollarRefreshCalled = false
    g.__pollarRefreshWalletBalance = async () => {
      pollarRefreshCalled = true
    }

    const { result, rerender } = renderHook(
      ({ wallet }: { wallet: ConnectedWallet | null }) => useWalletBalance(wallet),
      { initialProps: { wallet: WALLET_POLLAR } },
    )

    expect(pollarRefreshCalled).toBe(true)

    // Switch wallet before pollar state changes to loaded
    act(() => {
      rerender({ wallet: WALLET_A })
    })

    // Pollar state now transitions to loaded for the previous session
    await act(async () => {
      g.__pollarWalletBalance = {
        step: 'loaded',
        data: { balances: [{ code: 'XLM', balance: '100' }] },
      }
      rerender({ wallet: WALLET_A })
    })

    // Balances must NOT be set to Pollar's balances because active wallet is WALLET_A
    expect(result.current.balances?.source).not.toBe('pollar')
  })
})
