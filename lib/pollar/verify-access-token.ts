const DEFAULT_POLLAR_BASE_URL = 'https://sdk.api.pollar.xyz/v1'

export type PollarNetwork = 'testnet' | 'mainnet'

function buildBalanceUrl(
  base: string,
  network: PollarNetwork,
  publicKey: string,
  apiKeyForQuery: string,
): string {
  const u = new URL(`${base}/wallet/balance`)
  u.searchParams.set('network', network)
  u.searchParams.set('publicKey', publicKey)
  u.searchParams.set('api_key', apiKeyForQuery)
  return u.toString()
}

async function fetchWalletBalanceVerified(params: {
  url: string
  pollarApiKey: string
  accessToken: string
  expectPublicKey: string
  /** Pollar checks this against dashboard allowlisted origins (browser sends it; server fetch must forward it). */
  origin?: string
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const headers: Record<string, string> = {
    'x-pollar-api-key': params.pollarApiKey,
    Authorization: `Bearer ${params.accessToken}`,
  }
  if (params.origin) {
    headers.Origin = params.origin
  }

  const res = await fetch(params.url, { headers })

  let json: {
    success?: boolean
    code?: string
    error?: string
    content?: { publicKey?: string }
  }
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { ok: false, status: res.status || 502, message: 'Invalid response from Pollar' }
  }

  if (json.success === false && json.error) {
    return { ok: false, status: res.status || 401, message: json.error }
  }

  if (res.status === 401) {
    return { ok: false, status: 401, message: json.error || 'Invalid or expired Pollar session' }
  }

  if (!res.ok) {
    const message = json.error || `Pollar API error (${res.status})`
    return { ok: false, status: res.status, message }
  }

  if (!json.success || json.code !== 'SDK_WALLET_BALANCE' || !json.content?.publicKey) {
    return { ok: false, status: 502, message: json.error || 'Unexpected response from Pollar' }
  }

  if (json.content.publicKey !== params.expectPublicKey) {
    return { ok: false, status: 401, message: 'Wallet address does not match Pollar session' }
  }

  return { ok: true }
}

/**
 * Verifies the user session against Pollar (same as browser SDK: x-pollar-api-key + Bearer session JWT).
 * Tries POLLAR_PUBLISHABLE_KEY / NEXT_PUBLIC_*, then POLLAR_SECRET_KEY if Pollar returns API_KEY_NOT_FOUND
 * (some deployments expect the secret on server-to-SDK calls).
 */
export async function verifyPollarAccessToken(params: {
  accessToken: string
  publicKey: string
  network: PollarNetwork
  publishableApiKey: string
  /** Optional; used as fallback x-pollar-api-key when publishable is rejected. */
  secretApiKey?: string
  baseUrl?: string
  /**
   * Must match an origin allowlisted in Pollar dashboard (same URL users open in the browser).
   * Prefer forwarding the browser `Origin` from the incoming Next.js request; use env if missing.
   */
  allowedOrigin?: string
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const rawBase = params.baseUrl ?? process.env.POLLAR_BASE_URL ?? DEFAULT_POLLAR_BASE_URL
  const base = rawBase.replace(/\/$/, '')

  const envOrigin =
    process.env.POLLAR_ALLOWED_ORIGIN?.trim() || process.env.NEXT_PUBLIC_POLLAR_ALLOWED_ORIGIN?.trim()
  const origin = (params.allowedOrigin?.trim() || envOrigin || '').replace(/\/$/, '') || undefined

  const tryKeys = [params.publishableApiKey]
  if (params.secretApiKey?.trim() && params.secretApiKey.trim() !== params.publishableApiKey) {
    tryKeys.push(params.secretApiKey.trim())
  }

  let last: { ok: false; status: number; message: string } | null = null

  for (const pollarApiKey of tryKeys) {
    if (!pollarApiKey) continue
    const url = buildBalanceUrl(base, params.network, params.publicKey, pollarApiKey)
    const result = await fetchWalletBalanceVerified({
      url,
      pollarApiKey,
      accessToken: params.accessToken,
      expectPublicKey: params.publicKey,
      origin,
    })
    if (result.ok) return result

    const isKeyNotFound =
      result.message === 'API_KEY_NOT_FOUND' ||
      result.message.toUpperCase().includes('API_KEY_NOT_FOUND')
    last = result
    if (!isKeyNotFound) return result
  }

  return last ?? { ok: false, status: 502, message: 'Pollar verification failed' }
}
