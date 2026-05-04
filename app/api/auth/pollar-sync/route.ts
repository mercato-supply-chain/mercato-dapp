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

export async function POST(request: Request) {
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

  if (!publishableKey) {
    return NextResponse.json(
      {
        error:
          'POLLAR_PUBLISHABLE_KEY or NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY must be set for server routes (use the same publishable key as in the browser).',
      },
      { status: 503 },
    )
  }

  const verified = await verifyPollarAccessToken({
    accessToken,
    publicKey: stellarPublicKey,
    network,
    publishableApiKey: publishableKey,
    secretApiKey: process.env.POLLAR_SECRET_KEY?.trim(),
    allowedOrigin: clientOriginFromRequest(request),
  })

  if (!verified.ok) {
    const status = verifyFailureStatus(verified.message, verified.status)
    return NextResponse.json({ error: verified.message }, { status })
  }

  if (!email || !isEmailLooksValid(email)) {
    email = syntheticEmbeddedEmail(pollarUserId || stellarPublicKey)
  }

  let admin
  try {
    admin = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Authentication service is not configured' }, { status: 503 })
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const userMetadata: Record<string, unknown> = {
    auth_provider: 'pollar',
    pollar_user_id: pollarUserId || null,
    stellar_public_key: stellarPublicKey,
  }
  if (fullName) userMetadata.full_name = fullName

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: userMetadata,
  })

  if (createError && !isEmailAlreadyExistsError(createError)) {
    return NextResponse.json({ error: createError.message ?? 'Could not create account' }, { status: 500 })
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      data: userMetadata,
    },
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? 'Could not start session' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    email,
    token_hash: linkData.properties.hashed_token,
  })
}
