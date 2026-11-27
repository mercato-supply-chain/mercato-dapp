import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyPollarAccessToken, type PollarNetwork } from '@/lib/pollar/verify-access-token'

export const dynamic = 'force-dynamic'

function isEmailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function syntheticEmbeddedEmail(pollarUserId: string): string {
  const safe = pollarUserId.replace(/[^a-zA-Z0-9_-]/g, '') || 'user'
  return `pollar-${safe}@mercato.embedded.invalid`
}

function isEmailAlreadyExistsError(err: { message?: string; code?: string; status?: number }): boolean {
  if (err.code === 'email_exists') return true
  const m = (err.message ?? '').toLowerCase()
  return m.includes('already been registered') || m.includes('already exists') || m.includes('duplicate')
}

type Body = {
  accessToken?: unknown
  stellarPublicKey?: unknown
  email?: unknown
  pollarUserId?: unknown
  firstName?: unknown
  lastName?: unknown
}

function clientOriginFromRequest(request: Request): string | undefined {
  const direct = request.headers.get('origin')?.trim()
  if (direct) return direct.replace(/\/$/, '')

  const referer = request.headers.get('referer')?.trim()
  if (!referer) return undefined
  try {
    return new URL(referer).origin.replace(/\/$/, '')
  } catch {
    return undefined
  }
}

function verifyFailureStatus(message: string, pollarStatus: number): number {
  if (message === 'ORIGIN_NOT_ALLOWED' || message.includes('ORIGIN_NOT_ALLOWED')) return 403
  if (pollarStatus === 401) return 401
  if (pollarStatus >= 400 && pollarStatus < 500) return pollarStatus
  return 502
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; error?: unknown; code?: unknown }
    if (typeof record.message === 'string' && record.message.trim()) return record.message.trim()
    if (typeof record.error === 'string' && record.error.trim()) return record.error.trim()
    if (typeof record.code === 'string' && record.code.trim()) return record.code.trim()
  }
  return fallback
}

function isRateLimitedError(error: { message?: string; code?: string; status?: number }): boolean {
  if (error.status === 429) return true
  const code = (error.code ?? '').toLowerCase()
  if (code.includes('rate_limit')) return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('rate limit') || message.includes('for security purposes')
}

function hashedTokenFromLinkData(linkData: unknown): string | undefined {
  const record = linkData && typeof linkData === 'object' ? (linkData as Record<string, unknown>) : null
  if (!record) return undefined
  const properties = record.properties
  if (properties && typeof properties === 'object') {
    const hashed = (properties as { hashed_token?: unknown }).hashed_token
    if (typeof hashed === 'string' && hashed) return hashed
  }
  const hashed = record.hashed_token
  return typeof hashed === 'string' && hashed ? hashed : undefined
}

export async function POST(request: Request) {
  try {
    return await handlePollarSync(request)
  } catch (error) {
    console.error('[pollar-sync] unhandled error', error)
    return NextResponse.json(
      { error: errorMessage(error, 'Could not link Pollar to your Mercato account') },
      { status: 500 },
    )
  }
}

async function handlePollarSync(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  const stellarPublicKey = typeof body.stellarPublicKey === 'string' ? body.stellarPublicKey.trim() : ''
  let email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const pollarUserId = typeof body.pollarUserId === 'string' ? body.pollarUserId.trim() : ''
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''

  if (!accessToken || !stellarPublicKey) {
    return NextResponse.json({ error: 'accessToken and stellarPublicKey are required' }, { status: 400 })
  }

  const networkEnv = process.env.NEXT_PUBLIC_POLLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  const network: PollarNetwork = networkEnv

  const publishableKey = (
    process.env.POLLAR_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY
  )?.trim()
  const secretKey = process.env.POLLAR_SECRET_KEY?.trim()

  if (!secretKey) {
    return NextResponse.json(
      {
        error: 'POLLAR_SECRET_KEY must be set to verify Pollar sessions on the server.',
      },
      { status: 503 },
    )
  }

  const verified = await verifyPollarAccessToken({
    accessToken,
    publicKey: stellarPublicKey,
    network,
    publishableApiKey: publishableKey ?? secretKey,
    secretApiKey: secretKey,
    allowedOrigin: clientOriginFromRequest(request),
  })

  if (!verified.ok) {
    const status = verifyFailureStatus(verified.message, verified.status)
    return NextResponse.json({ error: verified.message }, { status })
  }

  if ((!email || !isEmailLooksValid(email)) && verified.email && isEmailLooksValid(verified.email)) {
    email = verified.email.toLowerCase()
  }

  if (!email || !isEmailLooksValid(email)) {
    email = syntheticEmbeddedEmail(verified.userId || pollarUserId || stellarPublicKey)
  }

  let admin
  try {
    admin = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Authentication service is not configured' }, { status: 503 })
  }

  const resolvedFirstName = firstName || verified.firstName || ''
  const resolvedLastName = lastName || verified.lastName || ''
  const fullName = [resolvedFirstName, resolvedLastName].filter(Boolean).join(' ').trim()
  const userMetadata: Record<string, unknown> = {
    auth_provider: 'pollar',
    pollar_user_id: verified.userId || pollarUserId || null,
    stellar_public_key: stellarPublicKey,
  }
  if (fullName) userMetadata.full_name = fullName

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: userMetadata,
  })

  if (createError && !isEmailAlreadyExistsError(createError)) {
    const status = isRateLimitedError(createError) ? 429 : 500
    return NextResponse.json(
      { error: errorMessage(createError, 'Could not create account') },
      { status },
    )
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      data: userMetadata,
    },
  })

  const tokenHash = hashedTokenFromLinkData(linkData)

  if (linkError || !tokenHash) {
    const status = linkError && isRateLimitedError(linkError) ? 429 : 500
    return NextResponse.json(
      { error: errorMessage(linkError, 'Could not start session') },
      { status },
    )
  }

  return NextResponse.json({
    email,
    token_hash: tokenHash,
  })
}
