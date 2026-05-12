import type { TxHistoryState, WalletType } from '@pollar/core'

export type WalletProviderType = 'stellar-wallets-kit' | 'pollar'
export type WalletStatus = 'pending' | 'active'

export interface ConnectedWallet {
  provider: WalletProviderType
  publicKey: string
  walletId?: string
  isEmbedded: boolean
  status?: WalletStatus
  walletName?: string
}

export interface WalletBalanceSummary {
  xlm: string | null
  usdc: string | null
  records: Array<Record<string, unknown>>
  source: 'horizon' | 'pollar' | null
  updatedAt: string | null
}

export interface StoredWalletRecord {
  provider: WalletProviderType
  publicKey: string
  walletId?: string | null
  isEmbedded: boolean
  status?: WalletStatus | null
  walletName?: string | null
}

export const WALLET_STORAGE_KEY = 'mercato_wallet'

export const PollarWalletKitLimitations =
  'Pollar embedded wallets support onboarding, balances, receive flows, and simple Stellar operations, but Trustless Work escrow signing still requires a Stellar Wallets Kit wallet.'

export function getStellarNetwork(): 'mainnet' | 'testnet' {
  return process.env.NEXT_PUBLIC_POLLAR_NETWORK === 'mainnet'
    ? 'mainnet'
    : process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet'
      ? 'mainnet'
      : 'testnet'
}

export function truncatePublicKey(publicKey: string | null | undefined): string | null {
  if (!publicKey) return null
  if (publicKey.length <= 10) return publicKey
  return `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`
}

export function normalizeStoredWallet(raw: unknown): StoredWalletRecord | null {
  if (!raw || typeof raw !== 'object') return null

  const candidate = raw as Record<string, unknown>
  const publicKey = candidate.publicKey ?? candidate.address

  if (typeof publicKey !== 'string' || !publicKey) return null

  const provider =
    candidate.provider === 'pollar' || candidate.provider === 'stellar-wallets-kit'
      ? candidate.provider
      : 'stellar-wallets-kit'

  const status =
    candidate.status === 'pending' || candidate.status === 'active'
      ? candidate.status
      : undefined

  return {
    provider,
    publicKey,
    walletId:
      typeof candidate.walletId === 'string' && candidate.walletId
        ? candidate.walletId
        : typeof candidate.wallet_id === 'string'
          ? candidate.wallet_id
          : null,
    isEmbedded:
      typeof candidate.isEmbedded === 'boolean'
        ? candidate.isEmbedded
        : provider === 'pollar',
    status,
    walletName:
      typeof candidate.walletName === 'string' && candidate.walletName
        ? candidate.walletName
        : typeof candidate.name === 'string'
          ? candidate.name
          : provider === 'pollar'
            ? 'Pollar'
            : 'Freighter',
  }
}

export function loadStoredWallet(): StoredWalletRecord | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY)
    if (!raw) return null
    return normalizeStoredWallet(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveStoredWallet(wallet: StoredWalletRecord | null): void {
  if (typeof window === 'undefined') return

  try {
    if (wallet) {
      window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet))
    } else {
      window.localStorage.removeItem(WALLET_STORAGE_KEY)
    }
  } catch {
    // Ignore localStorage failures in private browsing / blocked storage modes.
  }
}

export function normalizePollarWalletBalance(
  balanceState:
    | {
        step: 'idle' | 'loading' | 'error'
      }
    | {
        step: 'loaded'
        data: {
          balances: Array<Record<string, unknown> & { balance?: string }>
        }
      }
    | null
    | undefined,
): WalletBalanceSummary | null {
  if (!balanceState || balanceState.step !== 'loaded') return null

  const records = balanceState.data.balances ?? []
  // Pollar API returns `code` for the asset identifier (e.g. "XLM", "USDC").
  // Older paths also checked `asset` / `asset_code` for compatibility.
  const xlm = records.find((record) => {
    const value = record as any
    const code = String(value.code ?? value.asset ?? value.asset_code ?? '').toUpperCase()
    return code === 'XLM' || value.type === 'native'
  })
  const usdc = records.find((record) => {
    const value = record as any
    const code = String(value.code ?? value.asset ?? value.asset_code ?? '').toUpperCase()
    return code === 'USDC'
  })

  return {
    xlm: (xlm as any)?.balance ?? null,
    usdc: (usdc as any)?.balance ?? null,
    records,
    source: 'pollar',
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchHorizonBalances(publicKey: string): Promise<WalletBalanceSummary> {
  const { Horizon } = await import('@stellar/stellar-sdk')

  const horizonUrl =
    getStellarNetwork() === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org'

  const server = new Horizon.Server(horizonUrl)
  const account = await server.loadAccount(publicKey)

  const records = account.balances.map((balance) => {
    const value = balance as any
    if (value.asset_type === 'native') {
      return {
        asset: 'XLM',
        balance: value.balance,
        asset_code: 'XLM',
        asset_issuer: null,
      } as Record<string, unknown>
    }

    return {
      asset: value.asset_code,
      balance: value.balance,
      asset_code: value.asset_code,
      asset_issuer: value.asset_issuer,
    } as Record<string, unknown>
  })

  const xlm = records.find((record) => String((record as any).asset_code ?? '') === 'XLM')
  const usdc = records.find((record) => String((record as any).asset_code ?? '') === 'USDC')

  return {
    xlm: (xlm as any)?.balance ?? null,
    usdc: (usdc as any)?.balance ?? null,
    records,
    source: 'horizon',
    updatedAt: new Date().toISOString(),
  }
}

export function getEmbeddedWalletId(session: {
  clientSessionId?: string
  userId?: string | null
  wallet?: { publicKey: string | null; existsOnStellar?: boolean; createdAt?: number }
} | null): string | null {
  if (!session) return null
  return session.clientSessionId ?? session.userId ?? null
}

export function getEmbeddedWalletStatus(session: {
  wallet?: { publicKey: string | null; existsOnStellar?: boolean; createdAt?: number }
  user?: { ready?: boolean }
} | null): WalletStatus {
  if (!session) return 'pending'
  if (session.user?.ready === true) return 'active'
  if (session.wallet?.existsOnStellar === true) return 'active'
  return 'pending'
}

export function isEmbeddedWalletProvider(provider: WalletProviderType | null | undefined): boolean {
  return provider === 'pollar'
}

export function getWalletProviderLabel(
  provider: WalletProviderType | null | undefined,
  isEmbedded: boolean | null | undefined,
): string {
  if (provider === 'pollar' || isEmbedded) return 'Pollar Embedded Wallet'
  if (provider === 'stellar-wallets-kit') return 'Stellar Wallet'
  return 'Wallet'
}

export function getWalletAdapterLabel(walletName?: string | null): string {
  return walletName?.trim() || 'Wallet'
}
