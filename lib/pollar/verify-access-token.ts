const DEFAULT_POLLAR_SERVER_API = 'https://server.api.pollar.xyz/v3'

export type PollarNetwork = 'testnet' | 'mainnet'

export type PollarTokenVerifySuccess = {
  ok: true
  userId?: string
  walletAddress?: string
  email?: string
  firstName?: string
  lastName?: string
}

export type PollarTokenVerifyFailure = {
  ok: false
  status: number
  message: string
}

function serverApiBase(raw?: string): string {
  const value = (raw ?? process.env.POLLAR_SERVER_API_URL ?? DEFAULT_POLLAR_SERVER_API).replace(
    /\/$/,
    '',
  )
  if (value.endsWith('/v3') || value.endsWith('/v1')) return value
  return `${value}/v3`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function walletAddressFromTokenVerifyContent(content: unknown): string | undefined {
  const c = asRecord(content)
  if (!c) return undefined
  if (typeof c.wallet === 'string' && c.wallet.startsWith('G')) return c.wallet
  const wallet = asRecord(c.wallet)
  if (typeof wallet?.address === 'string') return wallet.address
  if (typeof wallet?.publicKey === 'string') return wallet.publicKey
  if (typeof c.publicKey === 'string') return c.publicKey
  return undefined
}

function profileField(content: unknown, key: string): string | undefined {
  const c = asRecord(content)
  const profile = asRecord(c?.profile)
  const value = profile?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function userIdFromContent(content: unknown): string | undefined {
  const c = asRecord(content)
  if (typeof c?.userId === 'string' && c.userId) return c.userId
  if (typeof c?.user_id === 'string' && c.user_id) return c.user_id
  return undefined
}

function verifyFailureMessage(code: string | undefined, fallback: string): string {
  if (code === 'SDK_AUTH_TOKEN_EXPIRED' || code === 'SDK_AUTH_INVALID_TOKEN') {
    return 'Invalid or expired Pollar session'
  }
  if (code === 'SDK_TOKEN_WRONG_APPLICATION') {
    return 'Pollar token does not belong to this application'
  }
  return fallback
}

/**
 * Validates an SDK access token with Pollar Server API `POST /v3/tokens/verify`.
 * User tokens are DPoP-bound; calling sdk-api `/v3/wallet/balance` with Bearer always 401s.
 */
export async function verifyPollarAccessToken(params: {
  accessToken: string
  publicKey: string
  network: PollarNetwork
  publishableApiKey: string
  secretApiKey?: string
  baseUrl?: string
  allowedOrigin?: string
}): Promise<PollarTokenVerifySuccess | PollarTokenVerifyFailure> {
  const secret = params.secretApiKey?.trim()
  if (!secret) {
    return {
      ok: false,
      status: 503,
      message: 'POLLAR_SECRET_KEY must be set to verify Pollar sessions on the server.',
    }
  }

  const url = `${serverApiBase(params.baseUrl)}/tokens/verify`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pollar-api-key': secret,
      },
      body: JSON.stringify({ token: params.accessToken }),
    })
  } catch {
    return { ok: false, status: 502, message: 'Could not reach Pollar to verify the session' }
  }

  let json: {
    success?: boolean
    code?: string
    error?: string
    message?: string
    content?: unknown
  }
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { ok: false, status: res.status || 502, message: 'Invalid response from Pollar' }
  }

  if (!res.ok || json.success === false) {
    const status = res.status === 403 ? 403 : res.status === 401 ? 401 : res.status >= 400 ? res.status : 502
    return {
      ok: false,
      status: status >= 400 && status < 600 ? status : 502,
      message: verifyFailureMessage(
        json.code,
        json.error || json.message || json.code || 'Invalid or expired Pollar session',
      ),
    }
  }

  if (json.code !== 'SERVER_TOKEN_VERIFIED') {
    return {
      ok: false,
      status: 502,
      message: json.error || json.message || 'Unexpected response from Pollar',
    }
  }

  const walletAddress = walletAddressFromTokenVerifyContent(json.content)
  if (walletAddress && walletAddress !== params.publicKey) {
    return { ok: false, status: 401, message: 'Wallet address does not match Pollar session' }
  }

  const content = asRecord(json.content)
  const network = content?.network
  if (typeof network === 'string' && network.toLowerCase() !== params.network) {
    return { ok: false, status: 401, message: 'Pollar session network does not match this app' }
  }

  return {
    ok: true,
    userId: userIdFromContent(json.content),
    walletAddress,
    email: profileField(json.content, 'mail') ?? profileField(json.content, 'email'),
    firstName: profileField(json.content, 'first_name') ?? profileField(json.content, 'firstName'),
    lastName: profileField(json.content, 'last_name') ?? profileField(json.content, 'lastName'),
  }
}
