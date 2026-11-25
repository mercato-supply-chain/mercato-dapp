const MERCATO_WALLET_STORAGE_KEY = 'mercato_wallet'
const MERCATO_WALLET_OWNER_KEY = 'mercato_wallet_owner'
const POLLAR_STORAGE_PREFIX = 'pollar:'
const STELLAR_WALLET_KIT_PREFIX = '@StellarWalletsKit/'
const POLLAR_INDEXED_DB_NAME = 'pollar-keys'

export const DEFAULT_WALLET_CLEANUP_TIMEOUT_MS = 1_500

export type ClearWalletSessionsOptions = {
  timeoutMs?: number
}

type DisconnectHandler = () => Promise<void> | void

let activeWalletKitDisconnect: DisconnectHandler | null = null
const activeSessionCleanupHandlers = new Set<DisconnectHandler>()
const revokedPollarSessionKeys = new Set<string>()
const blockedPollarHydrationUsers = new Set<string>()

/**
 * Awaits `task` up to `timeoutMs`, always clearing the timer in `finally` so
 * resolved promises never leave dangling timers and hung SDK calls never deadlock.
 */
export async function runWithBoundedTimeout(
  task: Promise<unknown>,
  timeoutMs: number = DEFAULT_WALLET_CLEANUP_TIMEOUT_MS,
): Promise<void> {
  if (timeoutMs <= 0) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      task.then(
        () => undefined,
        () => undefined,
      ),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

/**
 * Registers a disconnect callback for an already-initialized Stellar Wallets Kit
 * instance so logout on public routes can tear down an active session without
 * statically importing `@creit.tech/stellar-wallets-kit`.
 */
export function registerActiveWalletKitDisconnect(
  handler: DisconnectHandler | null,
): void {
  activeWalletKitDisconnect = handler
}

/**
 * Registers an in-memory wallet/Pollar session cleanup callback for mounted
 * providers so cross-tab sign-out or account switches immediately clear live state.
 */
export function registerActiveWalletSessionCleanup(
  handler: DisconnectHandler,
): () => void {
  activeSessionCleanupHandlers.add(handler)
  return () => {
    activeSessionCleanupHandlers.delete(handler)
  }
}

export function revokePollarSessionKey(sessionKey: string | null | undefined): void {
  if (!sessionKey) return
  revokedPollarSessionKeys.add(sessionKey)
}

export function clearRevokedPollarSessionKey(sessionKey: string | null | undefined): void {
  if (!sessionKey) return
  revokedPollarSessionKeys.delete(sessionKey)
}

export function clearAllRevokedPollarSessionKeys(): void {
  revokedPollarSessionKeys.clear()
}

export function isPollarSessionKeyRevoked(sessionKey: string | null | undefined): boolean {
  if (!sessionKey) return false
  return revokedPollarSessionKeys.has(sessionKey)
}

export function markPollarHydrationBlockedForUser(
  userId: string | null | undefined,
): void {
  if (!userId) return
  blockedPollarHydrationUsers.add(userId)
}

export function clearPollarHydrationBlockForUser(
  userId?: string | null,
): void {
  if (!userId) {
    blockedPollarHydrationUsers.clear()
    return
  }
  blockedPollarHydrationUsers.delete(userId)
}

export function isPollarHydrationBlockedForUser(
  userId: string | null | undefined,
): boolean {
  if (!userId) return false
  return blockedPollarHydrationUsers.has(userId)
}

export function resetRevokedPollarSessions(): void {
  revokedPollarSessionKeys.clear()
  blockedPollarHydrationUsers.clear()
}

export function readStoredWalletOwnerId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const explicitOwner = window.localStorage.getItem(MERCATO_WALLET_OWNER_KEY)
    if (explicitOwner) return explicitOwner
    const raw = window.localStorage.getItem(MERCATO_WALLET_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    return typeof parsed?.userId === 'string' && parsed.userId ? parsed.userId : null
  } catch {
    return null
  }
}

export function writeStoredWalletOwnerId(userId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (userId) {
      window.localStorage.setItem(MERCATO_WALLET_OWNER_KEY, userId)
    } else {
      window.localStorage.removeItem(MERCATO_WALLET_OWNER_KEY)
    }
  } catch {
    // Ignore storage access errors in restricted browsing contexts.
  }
}

function shouldClearKey(key: string): boolean {
  return (
    key === MERCATO_WALLET_STORAGE_KEY ||
    key === MERCATO_WALLET_OWNER_KEY ||
    key.startsWith(POLLAR_STORAGE_PREFIX) ||
    key.startsWith(STELLAR_WALLET_KIT_PREFIX)
  )
}

function clearMatchingStorageKeys(storage: Storage | undefined): void {
  if (!storage) return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && shouldClearKey(key)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      storage.removeItem(key)
    }
  } catch {
    // Ignore storage access errors in restricted browsing contexts.
  }
}

/**
 * Clears persisted Mercato wallet, wallet owner binding, Pollar embedded session,
 * and Stellar Wallets Kit storage keys across browser storage synchronously,
 * triggers Pollar IndexedDB deletion best-effort, and tears down any mounted
 * wallet/Pollar sessions under a bounded timeout so hung SDK calls never deadlock.
 */
export async function clearPersistedWalletSessions(
  options?: ClearWalletSessionsOptions,
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WALLET_CLEANUP_TIMEOUT_MS

  // Step 1: Synchronously wipe browser storage and trigger IndexedDB cleanup before any await.
  if (typeof window !== 'undefined') {
    clearMatchingStorageKeys(window.localStorage)
    clearMatchingStorageKeys(window.sessionStorage)

    try {
      window.indexedDB?.deleteDatabase?.(POLLAR_INDEXED_DB_NAME)
    } catch {
      // Ignore IndexedDB access errors in restricted environments.
    }
  }

  // Kick off registered disconnect/session-cleanup handlers synchronously so in-memory
  // session revocation markers update immediately even if remote SDK logout hangs.
  const pendingTasks: Array<Promise<unknown>> = []

  const disconnect = activeWalletKitDisconnect
  activeWalletKitDisconnect = null
  if (disconnect) {
    try {
      pendingTasks.push(Promise.resolve(disconnect()))
    } catch {
      // Ignore synchronous wallet-kit disconnect errors during sign-out cleanup.
    }
  }

  if (activeSessionCleanupHandlers.size > 0) {
    const handlers = Array.from(activeSessionCleanupHandlers)
    for (const handler of handlers) {
      try {
        pendingTasks.push(Promise.resolve(handler()))
      } catch {
        // Ignore synchronous cleanup handler errors.
      }
    }
  }

  // Step 2: Await remote/SDK teardown with a bounded timeout and guaranteed timer cleanup.
  if (pendingTasks.length > 0) {
    await runWithBoundedTimeout(Promise.allSettled(pendingTasks), timeoutMs)
  }
}
