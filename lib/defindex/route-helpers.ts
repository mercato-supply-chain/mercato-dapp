import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defindexErrorMessage } from './api-error'
import {
  getMercatoVaultContractId,
  isDefindexApiConfigured,
  isDefindexConfigured,
} from './config'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from './stellar-address'

/**
 * Shared request-handling helpers for the DeFindex API routes.
 *
 * Every route used to inline the same config guard (503), vault-id validation (500),
 * `caller` validation (400), `amounts` parsing, `slippageBps` default, and a blanket
 * 502 catch. Those concerns now live here exactly once. Each guard returns a
 * discriminated union so callers do `const g = requireX(); if (!g.ok) return g.response`.
 */

type GuardFail = { ok: false; response: NextResponse }

/**
 * Ensure a fully-configured user-facing vault (vault id + API key) and return the
 * validated vault contract id. 503 if unconfigured, 500 if the env vault id is malformed.
 */
export function requireDefindexConfigured(): { ok: true; vaultAddress: string } | GuardFail {
  if (!isDefindexConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Mercato vault is not configured (missing vault id or API key).' },
        { status: 503 },
      ),
    }
  }

  const vaultAddress = getMercatoVaultContractId()
  if (!isLikelyStellarContractId(vaultAddress)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid vault contract id in environment.' },
        { status: 500 },
      ),
    }
  }

  return { ok: true, vaultAddress }
}

/**
 * Ensure the DeFindex API key is configured (used by `submit` and all admin routes,
 * which do not require an env vault id). 503 if missing.
 */
export function requireDefindexApiConfigured(): { ok: true } | GuardFail {
  if (!isDefindexApiConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'DeFindex API is not configured (set DEFINDEX_API_KEY).' },
        { status: 503 },
      ),
    }
  }
  return { ok: true }
}

/** Validate a `caller` value is a well-formed Stellar account id (G…). 400 otherwise. */
export function validateCaller(value: unknown): { ok: true; caller: string } | GuardFail {
  const caller = typeof value === 'string' ? value.trim() : ''
  if (!caller || !isLikelyStellarAccountId(caller)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Valid `caller` (Stellar account) is required.' },
        { status: 400 },
      ),
    }
  }
  return { ok: true, caller }
}

/**
 * Validate a raw `amounts` array: non-empty, every entry a positive finite number.
 *
 * Amounts are on-chain raw units (stroops), which are always integers, so each entry
 * is floored — this deliberately unifies the previous inconsistency where the admin
 * deposit route floored but the user deposit/withdraw routes did not.
 */
export function parseAmounts(value: unknown): { ok: true; amounts: number[] } | GuardFail {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: '`amounts` must be a non-empty number array.' },
        { status: 400 },
      ),
    }
  }

  const amounts: number[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item) || item <= 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Each `amounts` entry must be a positive finite number.' },
          { status: 400 },
        ),
      }
    }
    amounts.push(Math.floor(item))
  }
  return { ok: true, amounts }
}

/** DeFindex slippage tolerance in basis points; defaults to 100 (1%) when absent/invalid. */
export function resolveSlippageBps(value: unknown, fallback = 100): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Best-effort security observability: warn (but do NOT block) when the requested
 * `caller` does not match the authenticated user's known wallet.
 *
 * User-facing routes accept `caller` from the request body and only require it to be
 * a valid Stellar account, so a signed-in user could build (unsigned) transactions
 * naming a third-party `caller`. This is intentionally not enforced — the resulting
 * XDR still requires that caller's own signature to execute, so it is inert without
 * it (see docs/defindex-integration.md, "caller binding"). We log mismatches so the
 * anomaly is visible for triage. `profiles.stellar_public_key` is synced best-effort
 * from the client, so a missing value is treated as "unknown", never a mismatch. This
 * function never throws.
 */
export async function warnIfCallerMismatch(userId: string, caller: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('stellar_public_key')
      .eq('id', userId)
      .maybeSingle()
    const known = typeof data?.stellar_public_key === 'string' ? data.stellar_public_key.trim() : ''
    if (known && known !== caller) {
      console.warn('[defindex] caller does not match the session wallet', { userId, caller, known })
    }
  } catch (error) {
    console.warn('[defindex] caller check skipped (profile lookup failed)', {
      userId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * The HTTP status DeFindex reported for a caught SDK error, if any.
 *
 * The SDK (axios-based) rejects failed requests with the API's response body, which
 * carries a numeric `statusCode` (see `@defindex/sdk` BaseApiError). Network failures
 * reject with a plain Error and have no upstream status.
 */
export function extractUpstreamStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const e = error as { statusCode?: unknown; status?: unknown }
    for (const raw of [e.statusCode, e.status]) {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(n) && n >= 400 && n <= 599) return n
    }
  }
  return null
}

/**
 * Map a caught DeFindex SDK error to the HTTP status our route should return.
 *
 * Differentiates DeFindex-reported failures instead of blanket-502'ing everything:
 * validation (400/422) surfaces as 400, rate limiting as 429, not-found as 404;
 * upstream auth (401/403 — our misconfigured key) and everything else (5xx, network
 * failures, unknown) stay 502 (bad gateway), preserving the previous default.
 */
export function mapDefindexErrorStatus(error: unknown): number {
  const upstream = extractUpstreamStatus(error)
  if (upstream === 400 || upstream === 422) return 400
  if (upstream === 404) return 404
  if (upstream === 429) return 429

  const message = defindexErrorMessage(error)
  if (/rate limit|too many requests/i.test(message)) return 429

  return 502
}

/**
 * Build the error response for a caught DeFindex SDK error and log it server-side.
 *
 * `context` labels the log line (e.g. `deposit`, `admin:rebalance`) so production
 * triage and admin-monitor alerting can attribute failures to a specific route.
 */
export function defindexErrorResponse(error: unknown, context: string): NextResponse {
  const status = mapDefindexErrorStatus(error)
  const message = defindexErrorMessage(error)
  console.error(`[defindex:${context}] request failed (${status})`, {
    message,
    upstreamStatus: extractUpstreamStatus(error),
  })
  return NextResponse.json({ error: message }, { status })
}
