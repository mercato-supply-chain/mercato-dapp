import type { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { registerActiveWalletKitDisconnect } from '@/lib/wallet/session-cleanup'

/**
 * Lazy, concurrency-safe accessor for the Stellar Wallets Kit singleton.
 *
 * Both SDK module evaluation and instantiation are deferred until first access
 * (e.g., wallet connection, signing, or external session restoration) so routes
 * like `/auth/login` and `/auth/sign-up` do not eagerly bundle Stellar Wallets Kit.
 *
 * Implementation is inspired by React 18 + Next.js lazy loading patterns:
 * @see https://nextjs.org/docs/app/guides/lazy-loading
 * @see https://react.dev/reference/react/lazy
 */

const isTestnet =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK !== 'mainnet'

let stellarWalletKitInstance: StellarWalletsKit | null = null
let initPromise: Promise<StellarWalletsKit | null> | null = null

/**
 * Initialize the Stellar Wallets Kit singleton on first call.
 * Subsequent calls return the cached instance or wait for ongoing initialization.
 * Safe for concurrent callers; only one initialization runs.
 *
 * @returns Promise resolving to the wallet kit instance, or null if called in a non-browser context.
 */
async function initializeStellarWalletKit(): Promise<StellarWalletsKit | null> {
  // Return cached instance if already initialized.
  if (stellarWalletKitInstance !== null) {
    return stellarWalletKitInstance
  }

  // Server-side guard: do not initialize outside browser context.
  if (typeof window === 'undefined') {
    return null
  }

  // Concurrent callers wait for ongoing initialization.
  if (initPromise) {
    return initPromise
  }

  // Start initialization with dynamic SDK import so initial route chunks omit SWK.
  initPromise = (async () => {
    try {
      const {
        StellarWalletsKit: StellarWalletsKitCtor,
        WalletNetwork,
        FREIGHTER_ID,
        AlbedoModule,
        FreighterModule,
      } = await import('@creit.tech/stellar-wallets-kit')

      const instance = new StellarWalletsKitCtor({
        network: isTestnet ? WalletNetwork.TESTNET : WalletNetwork.PUBLIC,
        selectedWalletId: FREIGHTER_ID,
        modules: [new FreighterModule(), new AlbedoModule()],
      })
      stellarWalletKitInstance = instance
      registerActiveWalletKitDisconnect(async () => {
        if (stellarWalletKitInstance === instance) {
          stellarWalletKitInstance = null
        }
        initPromise = null
        registerActiveWalletKitDisconnect(null)
        await instance.disconnect()
      })
      return stellarWalletKitInstance
    } catch (error) {
      // Clear the promise on error so retries can attempt re-initialization.
      initPromise = null
      throw error
    }
  })()

  try {
    return await initPromise
  } finally {
    // Clear the promise after resolution/rejection so concurrent callers see the cached instance or retry.
    initPromise = null
  }
}

/**
 * Get the Stellar Wallets Kit instance.
 * Initializes on first call; subsequent calls return the cached instance or resolve concurrently.
 *
 * @returns Promise resolving to the wallet kit instance, or null if called in a non-browser context.
 * @throws If initialization fails (e.g., SDK module error, network issue during construction).
 */
export function getStellarWalletKit(): Promise<StellarWalletsKit | null> {
  return initializeStellarWalletKit()
}

/**
 * Synchronously retrieve the cached Stellar Wallets Kit instance if already initialized.
 * Returns null if not yet initialized or in a server context.
 *
 * Used internally by disconnect and server-context checks; callers should prefer getStellarWalletKit.
 */
export function getStellarWalletKitSync(): StellarWalletsKit | null {
  return stellarWalletKitInstance
}

/**
 * Synchronously check if the Stellar Wallets Kit has been initialized.
 * Useful for conditional logic that must not trigger initialization.
 */
export function isStellarWalletKitInitialized(): boolean {
  return stellarWalletKitInstance !== null
}

/**
 * Reset the wallet kit instance and initialization state.
 * Useful for testing or cleanup after unrecoverable errors.
 */
export function resetStellarWalletKit(): void {
  stellarWalletKitInstance = null
  initPromise = null
  registerActiveWalletKitDisconnect(null)
}
