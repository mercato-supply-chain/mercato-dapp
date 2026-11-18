import type { WalletBalanceState, WalletInfo } from '@pollar/core'

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

/** Classic trustline USDC balance (used for deal funding and wallet display). */
export function parseWalletUsdcBalance(
  balances: WalletBalanceSummary | null | undefined,
): number {
  if (!balances?.usdc) return 0
  const parsed = Number.parseFloat(balances.usdc)
  return Number.isFinite(parsed) ? parsed : 0
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

/**
 * Returns true when the connected wallet provider can sign and submit
 * classic Stellar USDC transactions (e.g. direct deal funding).
 *
 * Both SWK and Pollar support classic tx signing, so this always returns
 * true for any connected provider. The check exists as an explicit gate so
 * future providers can set it to false if needed.
 */
export function canWalletSignClassicTx(
  provider: WalletProviderType | null | undefined,
): boolean {
  if (!provider) return false
  // Both 'stellar-wallets-kit' and 'pollar' support classic Stellar tx signing.
  return provider === 'stellar-wallets-kit' || provider === 'pollar'
}

/**
 * Returns true when the connected wallet provider can sign Soroban / Trustless Work
 * escrow transactions.
 *
 * Pollar does not yet support Soroban contract invocations reliably — escrow
 * deploy and release still require a Stellar Wallets Kit wallet.
 */
export function canWalletSignSorobanTx(
  provider: WalletProviderType | null | undefined,
): boolean {
  if (!provider) return false
  return provider === 'stellar-wallets-kit'
}

/**
 * Returns a human-readable description of what this wallet provider
 * cannot do, if anything. Returns null when the provider supports all
 * required operations.
 */
export function getWalletCapabilityLimitation(
  provider: WalletProviderType | null | undefined,
): string | null {
  if (provider === 'pollar') return PollarWalletKitLimitations
  return null
}

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
  balanceState: WalletBalanceState | null | undefined,
): WalletBalanceSummary | null {
  if (!balanceState || balanceState.step !== 'loaded') return null

  const records = balanceState.data.balances ?? []
  const stellarRecords = records.filter((record) => !record.chain || record.chain === 'STELLAR')
  const xlm = stellarRecords.find((record) => {
    const code = record.code.toUpperCase()
    return code === 'XLM' || record.type === 'native'
  })
  const usdc = stellarRecords.find((record) => record.code.toUpperCase() === 'USDC')

  return {
    xlm: xlm?.balance ?? null,
    usdc: usdc?.balance ?? null,
    records: stellarRecords as unknown as Array<Record<string, unknown>>,
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
} | null): string | null {
  if (!session) return null
  return session.userId ?? session.clientSessionId ?? null
}

export function getEmbeddedWalletStatus(
  wallet: Pick<WalletInfo, 'existsOnStellar' | 'provisioning'> | null,
): WalletStatus {
  if (!wallet) return 'pending'
  if (wallet.provisioning === 'READY' || wallet.existsOnStellar === true) return 'active'
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
