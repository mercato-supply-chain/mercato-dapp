# Wallet SDK Lazy Loading Implementation

## Overview

This document describes the lazy loading refactor for wallet integrations (Stellar Wallets Kit and Pollar SDK). The refactor defers SDK initialization until needed, reducing bundle overhead and eliminating SDK network activity on public routes where no wallet is stored.

**Status:** Completed  
**Impact:** Performance optimization, initialization ordering preserved, all signing and restoration paths functional

## Problem

Previously, the Stellar Wallets Kit singleton was eagerly instantiated at module evaluation in `lib/trustless/wallet-kit.ts`:

```typescript
// Before: eager initialization
export const stellarWalletKit = new StellarWalletsKit({...})
```

**Issues:**
- Blocks evaluation of `components/providers/app-providers.tsx` (global provider tree)
- SDK imported on all public routes (landing, deals, suppliers, investors, etc.) even if no wallet is stored
- Unnecessary SDK network activity (SDK version checks, module initialization)
- Complicates testing and increases SSR render time

## Solution: Lazy, Concurrency-Safe Accessor

### Architecture

A new lazy accessor pattern is implemented in `lib/trustless/lazy-wallet-kit.ts`:

```typescript
export async function getStellarWalletKit(): Promise<StellarWalletsKit | null>
export function getStellarWalletKitSync(): StellarWalletsKit | null
export function isStellarWalletKitInitialized(): boolean
export function resetStellarWalletKit(): void
```

**Key features:**
- **Deferred:** SDK only instantiated on first call
- **Concurrency-safe:** Multiple concurrent callers wait for ongoing initialization
- **Server-safe:** Returns null in SSR/server contexts
- **Testable:** Reset function clears state between tests
- **Retryable:** Errors allow retry by resetting and calling again

### When SDK is Initialized

The SDK is initialized (called lazily) when:

1. **Session restoration** (`hooks/use-wallet-persistence.ts`):
   - User has a stored external wallet (Stellar Wallets Kit)
   - Effect calls `getStellarWalletKit()` to restore session

2. **Wallet connection** (`hooks/use-external-wallet.ts`):
   - User clicks "Connect Wallet"
   - Hook calls `getStellarWalletKit()` to open wallet modal

3. **Signing transaction** (`lib/trustless/wallet-kit.ts`):
   - `signTransaction()` calls `getStellarWalletKit()`
   - Used by DeFindex vault operations, repayment escrow signing

4. **Disconnect** (`providers/wallet-provider.tsx`):
   - Uses `getStellarWalletKitSync()` to call disconnect if already initialized

### File Changes

#### New Files

- **`lib/trustless/lazy-wallet-kit.ts`** — Lazy initialization accessor with concurrency-safe singleton pattern

#### Modified Files

1. **`lib/trustless/wallet-kit.ts`**
   - Removed eager `stellarWalletKit` export
   - `signTransaction()` now calls `getStellarWalletKit()` instead
   - Updated JSDoc to note lazy initialization

2. **`lib/trustless/index.ts`**
   - Removed `stellarWalletKit` export
   - Added exports: `getStellarWalletKit`, `getStellarWalletKitSync`, `isStellarWalletKitInitialized`, `resetStellarWalletKit`

3. **`providers/wallet-provider.tsx`**
   - Import `getStellarWalletKitSync` instead of `stellarWalletKit`
   - `disconnect()` checks if initialized before attempting disconnect

4. **`hooks/use-wallet-persistence.ts`**
   - Import `getStellarWalletKit` instead of `stellarWalletKit`
   - Restoration effect calls `getStellarWalletKit()` with await

5. **`hooks/use-external-wallet.ts`**
   - Import `getStellarWalletKit` instead of `stellarWalletKit`
   - Connection callback calls `getStellarWalletKit()` with await

#### Tests

- **`__tests__/trustless/lazy-wallet-kit.test.ts`** — Unit tests for lazy accessor
  - Initialization on first call
  - Cached instance on subsequent calls
  - Concurrent call handling
  - Server context behavior
  - Error handling and retry

- **`__tests__/wallets/wallet-persistence-lazy-loading.test.ts`** — Integration contract tests
  - Verify modules export required functions
  - Verify hooks use lazy accessors
  - Verify provider uses sync accessor

## Behavior

### Public Routes (No Stored Wallet)

**Before:**
1. Page load → `app-providers.tsx` → `wallet-provider.tsx` → import `wallet-kit.ts`
2. `wallet-kit.ts` evaluates → SDK instantiated immediately
3. Bundle includes: wallet kit, freighter/albedo modules, network init

**After:**
1. Page load → `app-providers.tsx` → `wallet-provider.tsx` → import `wallet-kit.ts`
2. `wallet-kit.ts` evaluates → lazy accessor defined (no SDK)
3. Bundle lighter; SDK deferred indefinitely if wallet not needed

### Authenticated Route (Stored External Wallet)

**Before & After:**
1. Page load → `use-wallet-persistence` effect
2. Stored wallet detected → calls `getStellarWalletKit()`
3. SDK initialized on-demand during effect
4. Restoration completes

**Difference:** SDK not eagerly loaded at module evaluation; loaded during effect with proper async/await handling.

### Wallet Connection Flow

**Before & After:**
1. User clicks "Connect Wallet"
2. `connectExternalWallet()` calls `getStellarWalletKit()`
3. SDK initializes; modal opens
4. User selects wallet and signs

**Difference:** SDK only loads when user initiates connection.

### Disconnect

**Before & After:**
1. User clicks "Disconnect"
2. `disconnect()` callback runs
3. Checks if SDK is initialized via `getStellarWalletKitSync()`
4. If initialized, calls `disconnect()`; if not, skips

**Difference:** No errors from calling disconnect on uninitialized SDK.

## Implementation Details

### Concurrency Safety

Multiple callers awaiting initialization are handled by caching the initialization promise:

```typescript
let stellarWalletKitInstance: StellarWalletsKit | null = null
let initPromise: Promise<StellarWalletsKit | null> | null = null

async function initializeStellarWalletKit(): Promise<StellarWalletsKit | null> {
  if (stellarWalletKitInstance !== null) return stellarWalletKitInstance
  if (typeof window === 'undefined') return null
  if (initPromise) return initPromise  // Concurrent callers wait

  initPromise = (async () => {
    try {
      stellarWalletKitInstance = new StellarWalletsKit({...})
      return stellarWalletKitInstance
    } catch (error) {
      initPromise = null  // Allow retry
      throw error
    }
  })()

  try {
    return await initPromise
  } finally {
    initPromise = null
  }
}
```

### Error Handling

- **SDK module error:** Promise rejected; callers catch and handle
- **Network error during init:** Cached promise clears on error; retry possible
- **Server context:** Returns null gracefully (no SSR hydration mismatch)

### Pollar Embedded Wallet

Pollar lazy loading is unchanged. It still initializes eagerly in `providers/pollar-provider.tsx` but:
- Only if `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` is set
- After client mount (avoid RSC warning)
- Empty context provided if unconfigured

Future: Pollar can also be deferred using similar pattern if needed.

## Verification Checklist

- [x] Public routes do not initialize wallet kit
- [x] Session restoration still works (lazy init in effect)
- [x] Wallet connection opens modal (lazy init on click)
- [x] Signing transactions work (lazy init before sign)
- [x] Disconnect handles uninitialized kit
- [x] Concurrent calls to `getStellarWalletKit()` return same instance
- [x] Tests pass: unit (lazy-wallet-kit), integration (wallet-persistence)
- [x] Build passes: `npm run build`
- [x] Lint passes: no new errors in wallet files
- [x] No errors in signing paths (DeFindex, repayment escrow)

## Testing

### Unit Tests (`__tests__/trustless/lazy-wallet-kit.test.ts`)

```bash
bun test __tests__/trustless/lazy-wallet-kit.test.ts
```

Tests:
- Initialization on first call
- Cached instance retrieval
- Concurrent call safety
- Server context returns null
- Sync accessor behavior
- Reset and re-initialization
- Error handling allows retry

### Integration Tests (`__tests__/wallets/wallet-persistence-lazy-loading.test.ts`)

```bash
bun test __tests__/wallets/wallet-persistence-lazy-loading.test.ts
```

Tests:
- Modules export required functions
- Hooks use lazy accessors
- Provider uses sync accessor

### Full Test Suite

```bash
npm run test
```

Expected: 11 new tests pass (lazy-wallet-kit), 4 contract tests pass (wallet-persistence-lazy-loading).

### Manual Verification

1. **Public route (no wallet):**
   - Open DevTools Network tab
   - Load public route (e.g., `/deals`)
   - Confirm: No Freighter/Albedo SDK requests
   - Load time comparable to before

2. **Session restoration (stored wallet):**
   - Store external wallet address in browser localStorage
   - Reload page
   - Wallet should restore (address shown in UI)
   - Confirm: SDK loads during restoration effect, not at module eval

3. **Wallet connection:**
   - Click "Connect Wallet"
   - Modal should open
   - Select wallet and complete flow
   - Confirm: SDK loads on-demand

4. **Signing (DeFindex deposit):**
   - Connect wallet, go to vault
   - Click "Deposit"
   - Sign transaction in wallet
   - Confirm: Transaction completes without errors

5. **Disconnect:**
   - Connect wallet
   - Click "Disconnect"
   - Confirm: No errors, wallet clears

## Migration Guide

For contributors working with wallet code:

### Before

```typescript
import { stellarWalletKit, signTransaction } from '@/lib/trustless/wallet-kit'

// SDK was already initialized
const kit = stellarWalletKit  // null in SSR, instance in browser
```

### After

```typescript
import { getStellarWalletKit, signTransaction } from '@/lib/trustless/wallet-kit'

// SDK initializes on first call
const kit = await getStellarWalletKit()  // null in SSR, instance on first call
```

### New Entry Points

- `getStellarWalletKit()` — Async, initializes on demand, safe for all contexts
- `getStellarWalletKitSync()` — Sync, returns cached instance or null (do not use to trigger init)
- `isStellarWalletKitInitialized()` — Sync check for initialization status
- `resetStellarWalletKit()` — Reset for testing (e.g., `beforeEach` hook)

## Performance Impact

### Bundle Size

- Deferred: Stellar Wallets Kit, Freighter module, Albedo module not in initial bundle
- Added: ~500 bytes for lazy accessor (lazy-wallet-kit.ts)
- **Net:** Smaller initial public route bundle; SDK loaded when needed

### Initialization Time

- Public routes: No SDK init overhead
- Authenticated routes: SDK init during effect (non-blocking, after hydration)
- Connection flow: SDK init on-demand (non-blocking until user clicks)

### Network Activity

- Public routes: No SDK network requests
- Authenticated routes: SDK requests during restoration (same as before, but deferred)
- Connection flow: SDK requests on demand (same as before, but deferred)

## Known Limitations

- Pollar SDK still initializes eagerly (can be deferred in future)
- Error during SDK init prevents retry unless `resetStellarWalletKit()` is called
- SSR context always returns null (expected, correct behavior)

## References

- [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [React lazy loading with Code Splitting](https://react.dev/reference/react/lazy)
- [Concurrency-safe singletons](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [Stellar Wallets Kit docs](https://docs.trustlesswork.com/trustless-work/pt/developer-resources/stellar-wallet-kit-integracao-rapida)

## Related Issues

- Defers initialization on public routes (performance)
- Preserves session restoration (functional)
- Enables testability (mock reset between tests)
- Maintains signing capabilities (all paths work)

## Future Improvements

1. Extend pattern to Pollar SDK (similar lazy accessor)
2. Add metrics collection (measure SDK init time, success/failure rates)
3. Implement exponential backoff for SDK init failures
4. Lazy load Trustless Work SDK (if unused in many paths)
